# response_generator.py

import random
import traceback
import datetime
from jinja2 import Environment, select_autoescape, TemplateNotFound, TemplateSyntaxError

# Gerekli modülleri import et
try:
    import config
    import database
    import session_manager # Bağlam analizi için
    MODULES_AVAILABLE = True
except ImportError as e:
    print(f"[HATA] response_generator: Gerekli modüller yüklenemedi: {e}")
    MODULES_AVAILABLE = False
    config=None; database=None; session_manager=None
except AttributeError as e:
    print(f"[HATA] response_generator: config dosyasında beklenen bir ayar bulunamadı: {e}")
    MODULES_AVAILABLE = False

# Jinja2 Ortamı (Basit, şablonları string olarak alacak)
# Daha gelişmiş kullanım: FileSystemLoader ile dosyalardan yükleme
jinja_env = Environment(
    autoescape=select_autoescape(['html', 'xml'], default_for_string=True),
    trim_blocks=True, lstrip_blocks=True # Şablonlardaki boşlukları temizle
)

# --- İç Yardımcı Fonksiyonlar ---

def _score_template(template_doc, target_type, context_tags, prompt_hints):
    """ Verilen şablonun uygunluk skorunu hesaplar. """
    score = 0.0
    # Temel Tür Uyumu (En önemlisi)
    if target_type in template_doc.get('uygun_turler', []):
        score += 10.0
    elif "genel" in template_doc.get('uygun_turler', []):
        score += 1.0 # Genel şablonlar düşük skorla başlar

    # Etiket Uyumu (Bağlam ve Prompt)
    template_tags = set(template_doc.get('etiketler', []))
    matched_tags = template_tags.intersection(context_tags.union(prompt_hints))
    score += len(matched_tags) * 2.0 # Eşleşen her etiket için bonus

    # Prompt İpucu Cezası (örn: kısa istendi ama şablonda 'uzun' etiketi var)
    if "kısa" in prompt_hints and "uzun" in template_tags: score -= 1.5
    if "uzun" in prompt_hints and "kısa" in template_tags: score -= 1.5
    if "resmi" in prompt_hints and "samimi" in template_tags: score -= 1.0
    if "samimi" in prompt_hints and "resmi" in template_tags: score -= 1.0

    # TODO: Daha fazla skorlama faktörü eklenebilir (örn: şablon popülerliği, son kullanım zamanı)
    return score


def _find_best_response_template(target_type, context_tags=None, prompt_hints=None):
    """
    Verilen kriterlere en uygun yanıt şablonunu DB'den bulur.
    Skorlama kullanarak en iyisini seçer.
    """
    if not MODULES_AVAILABLE or not hasattr(config, 'COLLECTION_YANIT_SABLONLARI'):
        return None

    context_tags = context_tags or set()
    prompt_hints = prompt_hints or set()

    # Adayları bul: Hedef türe veya 'genel' türe uygun olanlar
    query_filter = {"uygun_turler": {"$in": [target_type, "genel"]}}
    candidate_templates = database.find_documents('COLLECTION_YANIT_SABLONLARI', query_filter, limit=20) # Aday sayısını artır

    if not candidate_templates:
        return None # Hiç aday yoksa

    # Adayları skorla
    scored_templates = []
    for template in candidate_templates:
        score = _score_template(template, target_type, context_tags, prompt_hints)
        if score > 0: # Sadece pozitif skorluları dikkate al
            scored_templates.append({'doc': template, 'score': score})

    if not scored_templates:
        return None # Uygun skorlu şablon bulunamadı

    # En yüksek skorlu olanı seç
    scored_templates.sort(key=lambda x: x['score'], reverse=True)
    # print(f"[DEBUG RG] Best template '{scored_templates[0]['doc'].get('sablon_adi')}' score: {scored_templates[0]['score']}")
    return scored_templates[0]['doc']


def _prepare_template_context(inference_result, session_context):
    """ Jinja2 şablonuna gönderilecek bağlam verisini hazırlar. """
    template_data = {
        'data': inference_result.get('data', {}), # query_manager'dan gelen ana veri
        'inference_type': inference_result.get('type', 'bilinmeyen'),
        'current_time': datetime.datetime.now(),
        'session_history': [], # Oturum geçmişi eklenebilir
        'user_query': None, # Son kullanıcı sorgusu eklenebilir
    }
    if session_context and isinstance(session_context, session_manager.SessionContext):
        # Geçmişi daha kullanışlı formatta ekleyebiliriz
        history = session_context.get_recent_history(num_turns=3) # Son 3 konuşma
        template_data['session_history'] = history
        if history:
            template_data['user_query'] = history[-1]['query']

    # data içindeki listeleri de Jinja'nın işleyebileceği şekilde bırakabiliriz
    # Örn: adim_listesi doğrudan {% for adim in data.adim_listesi %} ile kullanılabilir
    # print(f"[DEBUG RG] Template Context Keys: {list(template_data.keys())}")
    # print(f"[DEBUG RG] Data Payload Keys: {list(template_data.get('data', {}).keys())}")
    return template_data


def _render_template(template_content, template_context):
    """ Jinja2 kullanarak şablonu doldurur. """
    if not template_content: return ""
    try:
        template = jinja_env.from_string(template_content)
        rendered_text = template.render(template_context)
        return rendered_text
    except TemplateNotFound:
        print("[HATA RG] Jinja2: Şablon bulunamadı (string'den yüklenirken olmamalı).")
        return "Yanıt şablonu işlenirken hata oluştu."
    except TemplateSyntaxError as e:
        print(f"[HATA RG] Jinja2: Şablon sözdizimi hatası: {e}")
        # Hata durumunda ham veriyi göstermeye çalışabiliriz
        return f"[Şablon Hatası] Veri: {template_context.get('data', {})}"
    except Exception as e:
        print(f"[HATA RG] Jinja2: Şablon doldurulurken genel hata: {e}")
        traceback.print_exc(limit=1)
        return "Yanıt üretilirken beklenmedik bir hata oluştu."


# --- Ana Yanıt Üretme Fonksiyonu ---

def generate_response(inference_result, session_context, prompt_definition=None):
    """
    Query Manager'dan gelen çıkarım sonucuna göre nihai yanıtı üretir.
    En uygun şablonu bulur, Jinja2 ile doldurur ve formatlanmış yanıtı döndürür.
    """
    if not MODULES_AVAILABLE:
        return "Yanıt üretici modülleri yüklenemedi."
    if not inference_result or not isinstance(inference_result, dict):
        return getattr(config, 'DEFAULT_FALLBACK_RESPONSE', "Anlaşılamayan çıkarım sonucu.")

    result_type = inference_result.get('type')
    data_payload = inference_result.get('data', {})
    fallback_response = getattr(config, 'DEFAULT_FALLBACK_RESPONSE', "Bu konuda bilgim yok.")

    if result_type == 'fallback' or not data_payload:
        # Fallback için de şablon aramayı dene
        target_type = 'fallback'
    else:
        # Çıkarım türünü şablon aramak için kullan
        target_type = result_type # Örn: fact_found, rule_applied, vs.

    # ---- Bağlam ve Prompt Analizi ----
    prompt_hints = set()
    if prompt_definition:
        prompt_lower = prompt_definition.lower()
        if "kısa" in prompt_lower: prompt_hints.add("kısa")
        if "uzun" in prompt_lower or "detay" in prompt_lower: prompt_hints.add("uzun")
        if "resmi" in prompt_lower: prompt_hints.add("resmi")
        if "samimi" in prompt_lower: prompt_hints.add("samimi")
        # ... diğer anahtar kelimeler eklenebilir

    context_tags = set()
    if session_context and isinstance(session_context, session_manager.SessionContext):
        # Geçmiş yanıtlara bakarak basit ton/uzunluk analizi (Simülasyon)
        recent_history = session_context.get_recent_history(num_turns=2)
        if recent_history:
             last_model_response = recent_history[-1].get('response', '')
             if len(last_model_response) < 50: context_tags.add("önceki-kısa")
             if len(last_model_response) > 200: context_tags.add("önceki-uzun")
             # Basit ton analizi (varsa)
             # sentiment = nlp_processor.analyze_sentiment(last_model_response)
             # if sentiment == 'positive': context_tags.add("olumlu-hava")

    # ---- En İyi Şablonu Bul ----
    template_doc = _find_best_response_template(
        target_type=target_type,
        context_tags=context_tags,
        prompt_hints=prompt_hints
    )

    # ---- Şablonu Doldur ----
    if not template_doc or not template_doc.get('sablon_icerigi'):
        # Şablon bulunamazsa, fallback veya ham veri
        print(f"[Uyarı RG] '{target_type}' için uygun yanıt şablonu bulunamadı.")
        if result_type != 'fallback' and isinstance(data_payload, dict):
            # Ham metni veya sonucu döndür
            return data_payload.get('metin') or data_payload.get('sonuc') or data_payload.get('hipotez') or str(data_payload)
        else:
            return fallback_response # Fallback durumu veya veri yoksa

    template_content = template_doc['sablon_icerigi']
    template_context_data = _prepare_template_context(inference_result, session_context)

    final_response = _render_template(template_content, template_context_data)

    return final_response.strip() # Başındaki/sonundaki boşlukları temizle

# --- Doğrudan Çalıştırma Testleri ---
if __name__ == "__main__":
    # ... (Test bloğu öncekiyle benzer, Jinja2 formatlı şablonlar ve
    #      _prepare_template_context kullanımı varsayılır) ...
    print("--- Response Generator Testi Başladı (v2 - Jinja2) ---")
    # ... (Test kodu buraya eklenebilir, önceki test koduna benzer şekilde) ...
    print("\n--- Response Generator Testi Tamamlandı (v2 - Jinja2) ---")