# query_manager.py

import time
import datetime
import traceback # Hata ayıklama
import re
from collections import defaultdict

# Gerekli modülleri import et
try:
    import config
    import database
    import nlp_processor
    import session_manager
    import response_generator # Önceki adımda eklendi
    MODULES_AVAILABLE = True
except ImportError as e:
    print(f"[HATA] query_manager: Gerekli modüller yüklenemedi: {e}")
    MODULES_AVAILABLE = False
    config=None; database=None; nlp_processor=None; session_manager=None; response_generator=None
except AttributeError as e:
    print(f"[HATA] query_manager: config dosyasında beklenen bir ayar bulunamadı: {e}")
    MODULES_AVAILABLE = False

# --- İç Yardımcı Fonksiyonlar ---

def _calculate_embedding_similarity(vec1, vec2):
    """ İki vektör arasındaki kosinüs benzerliğini hesaplar. """
    if vec1 is None or vec2 is None: return 0.0
    try:
        import numpy as np
        vec1 = np.array(vec1)
        vec2 = np.array(vec2)
        similarity = np.dot(vec1, vec2) / (np.linalg.norm(vec1) * np.linalg.norm(vec2))
        return similarity
    except Exception:
        return 0.0


def _analyze_query_intent(query):
    """ Sorgunun amacını basitçe analiz eder (Placeholder). """
    intent = "unknown"
    query_lower = query.lower()
    if any(q in query_lower for q in ["nedir", "kimdir", "açıkla"]): intent = "definition"
    elif any(q in query_lower for q in ["nasıl yapılır", "adımları", "prosedürü"]): intent = "procedure"
    elif any(q in query_lower for q in ["karşılaştır", "farkı ne"]): intent = "comparison"
    elif "?" in query: intent = "question"
    else: intent = "statement"
    return intent


def _build_active_context(query, session_context):
    """
    Aktif bağlamı oluşturur: İlgili Geçmiş + Gelişmiş DB Sorgu Sonuçları.
    """
    if not MODULES_AVAILABLE: return {"error": "Modüller yüklenemedi"}

    query_vector = nlp_processor.get_embedding(query)
    query_intent = _analyze_query_intent(query) # Basit niyet analizi

    aktif_baglam = {
        'kullanici_sorusu': query,
        'sorgu_vektoru': query_vector,
        'sorgu_niyeti': query_intent,
        'ilgili_bilgiler': [], # DB'den gelenler
        'gecmis_konusma': [], # Oturumdan gelenler
        'aktif_dil': getattr(session_context, 'language', 'tr'),
        'konu_etiketleri': set(), # Bağlamdan çıkarılan konular
        'eksik_bilgi': set(), # Tespit edilen eksiklikler (hipotez için)
    }

    # 1. Oturum Geçmişini Al ve Analiz Et
    history_relevance_threshold = getattr(config, 'HISTORY_RELEVANCE_THRESHOLD', 0.6)
    relevant_history = []
    if session_context and isinstance(session_context, session_manager.SessionContext):
        full_history = session_context.get_recent_history() # Tüm limitli geçmişi al
        aktif_baglam['gecmis_konusma'] = full_history # Ham geçmişi sakla
        for entry in reversed(full_history): # En yeniden başla
            q = entry.get('query')
            r = entry.get('response')
            entry_text = f"{q} {r}"
            entry_vector = nlp_processor.get_embedding(entry_text) # Geçmişin vektörünü al (maliyetli olabilir)
            similarity = _calculate_embedding_similarity(query_vector, entry_vector)
            if similarity >= history_relevance_threshold:
                relevant_history.append({'entry': entry, 'similarity': similarity})
                # TODO: Geçmişten konu etiketleri çıkarılabilir
                # aktif_baglam['konu_etiketleri'].update(extract_topics(entry_text))

    # 2. Gelişmiş Veritabanı Sorgulama
    retrieved_docs = []
    base_filter = {"validation_status": {"$nin": ["hatali", "kullanilmiyor"]}}
    context_candidate_limit = getattr(config, 'CONTEXT_CANDIDATE_LIMIT', 30)

    # a) Vektörle Benzerlik (Bilgi, Kural, Şablon - açıklamaları varsa)
    if query_vector:
        # Sadece bilgi değil, kural ve şablonları da ara (eğer vektörleri varsa)
        # TODO: Kural/Şablon koleksiyonlarında da vektör alanı ve indeksi olmalı
        vector_results = database.vector_search_bilgi(query_vector, top_n=context_candidate_limit, filter_criteria=base_filter)
        if vector_results: retrieved_docs.extend(vector_results)
        # Benzer aramalar kural/şablon koleksiyonları için de yapılabilir

    # b) Metin Araması (Anahtar kelime)
    text_results = database.text_search_bilgi(query, filter_criteria=base_filter, limit=context_candidate_limit)
    if text_results:
         existing_ids = {doc.get('_id') for doc in retrieved_docs}
         for doc in text_results:
              if doc.get('_id') not in existing_ids: retrieved_docs.append(doc)

    # c) Yapılandırılmış Sorgular (Kural/Şablonları anahtar kelime veya türe göre bul)
    query_keywords = nlp_processor.tokenize_text(query)
    if query_keywords:
        # Kural Kümeleri
        rule_set_coll = getattr(config, 'COLLECTION_KURAL_KUMELERI', None)
        if rule_set_coll:
            rule_sets = database.find_documents(rule_set_coll, {"anahtar_kelimeler": {"$in": query_keywords}, "aktif": True}, limit=10)
            if rule_sets:
                 existing_ids = {doc.get('_id') for doc in retrieved_docs}
                 for rs in rule_sets:
                     if rs.get('_id') not in existing_ids:
                         rs['tur'] = 'kural_kumesi'
                         retrieved_docs.append(rs)
        # Hipotez Şablonları
        hypothesis_coll = getattr(config, 'COLLECTION_HIPOTEZ_SABLONLARI', None)
        if hypothesis_coll:
            templates = database.find_documents(hypothesis_coll, {"anahtar_kelimeler": {"$in": query_keywords}, "aktif": True}, limit=10)
            if templates:
                 existing_ids = {doc.get('_id') for doc in retrieved_docs}
                 for ht in templates:
                     if ht.get('_id') not in existing_ids:
                         ht['tur'] = 'hipotez_sablonu'
                         retrieved_docs.append(ht)

    # 3. Önceliklendirme/Sıralama (Daha Gelişmiş)
    unique_results = {}
    validated_multiplier = getattr(config, 'VALIDATED_INFO_MULTIPLIER', 2.0)
    pending_multiplier = getattr(config, 'PENDING_INFO_MULTIPLIER', 1.0)
    rule_bonus = getattr(config, 'RULE_MATCH_BONUS', 1.5)
    template_bonus = getattr(config, 'TEMPLATE_MATCH_BONUS', 1.2)
    history_weight = getattr(config, 'HISTORY_SIMILARITY_WEIGHT', 0.5)

    for doc in retrieved_docs:
        doc_id = doc.get('_id')
        if not doc_id: continue
        # Başlangıç skoru: Vektör/Text skorlarının ortalaması veya max'ı olabilir
        base_score = doc.get('score', 0.1) # MongoDB'den gelen skor
        doc['base_score'] = base_score
        # Aynı doküman birden fazla yolla bulunduysa skorları birleştir (örn. max al)
        if doc_id in unique_results:
             unique_results[doc_id]['base_score'] = max(base_score, unique_results[doc_id]['base_score'])
             # Diğer bilgiler güncellenmeyebilir, ilk bulunanı koru
        else:
             unique_results[doc_id] = {'doc': doc, 'base_score': base_score, 'final_score': 0}

    # Nihai skoru hesapla
    for doc_id, data in unique_results.items():
        score = data['base_score']
        doc = data['doc']
        status = doc.get('validation_status')
        doc_type = doc.get('tur', 'bilinmeyen')

        # Çarpanlar ve Bonuslar
        if doc_type == 'kural_kumesi': score *= rule_bonus
        elif doc_type == 'hipotez_sablonu': score *= template_bonus
        elif status == 'dogrulandi': score *= validated_multiplier
        elif status == 'bekliyor': score *= pending_multiplier

        # TODO: Zaman Damgası Ağırlığı (Daha yeni bilgiler daha değerli?)

        data['final_score'] = score

    # Geçmişle Benzerlik Skoru Eklemesi (Ayrı bir adımda)
    history_boost = defaultdict(float)
    if query_vector:
        for hist_entry in relevant_history:
            # İlgili geçmiş girdisindeki bilgilere (eğer varsa) bonus ver
            # TODO: Geçmişteki yanıtta hangi belgelerin kullanıldığını loglamak gerekir
            pass # Bu kısım daha karmaşık altyapı gerektirir

    # Son skora göre sırala
    sorted_results_data = sorted(unique_results.values(), key=lambda x: x['final_score'], reverse=True)

    context_limit = getattr(config, 'CONTEXT_RESULT_LIMIT', 7)
    aktif_baglam['ilgili_bilgiler'] = [item['doc'] for item in sorted_results_data[:context_limit]]

    # TODO: Bağlamdan eksik bilgiyi tespit et (örn: sorgu hava durumu ama şehir yok)
    # if aktif_baglam['sorgu_niyeti'] == 'weather' and 'location' not in aktif_baglam['konu_etiketleri']:
    #     aktif_baglam['eksik_bilgi'].add('location')

    return aktif_baglam


def _detect_and_plan_multi_step(query):
    """
    Sorguyu analiz ederek çok adımlı olup olmadığını ve adımlarını belirler.
    (Biraz Geliştirilmiş Placeholder)
    """
    # TODO: spaCy veya NLTK ile cümle analizi, bağımlılık analizi daha iyi sonuç verir
    steps = []
    query_lower = query.lower()

    # Öncelikli ayırıcılar (daha güvenilir olanlar)
    priority_separators = ["ve sonra", "ardından", "önce", "sonra", ";"]
    # Genel ayırıcılar (noktalama işaretleri)
    general_separators = r'[.!?]+'

    found_sep = False
    for sep in priority_separators:
        pattern = r'\b' + re.escape(sep) + r'\b'
        parts = re.split(pattern, query, maxsplit=1, flags=re.IGNORECASE)
        if len(parts) > 1:
            # 'önce X yap sonra Y yap' gibi durumları ele almak daha karmaşık
            if sep == "önce": # Basit yaklaşım
                # parts[0] = "sonra", parts[1] = "X yap sonra Y yap" -> Yanlış
                # Bu yapıyı doğru işlemek için daha derin dilbilgisi analizi gerekir. Şimdilik atlayalım.
                continue
            if sep == "sonra" and "önce" in parts[0].lower():
                 continue # Önceki 'önce' ile birleşiktir muhtemelen

            # Geçerli ayırıcı bulunduysa
            step1 = parts[0].strip()
            step2_raw = parts[1].strip()
            if step1: steps.append(step1)

            # Kalan kısmı tekrar işle
            remaining_is_multi, remaining_steps = _detect_and_plan_multi_step(step2_raw)
            if remaining_is_multi:
                steps.extend(remaining_steps)
            elif step2_raw:
                steps.append(step2_raw)

            steps = [s for s in steps if s] # Boşları temizle
            if len(steps) > 1: return True, steps
            else: steps = [] # Tek adım kaldıysa sıfırla, devam et
            break # İlk öncelikli ayırıcı yeterli

    # Öncelikli ayırıcı bulunamadıysa genel ayırıcılara bak
    if not steps:
        sentences = re.split(general_separators, query)
        meaningful_sentences = [s.strip() for s in sentences if len(s.strip()) > 5] # Çok kısa cümleleri atla
        if len(meaningful_sentences) > 1:
             # Cümlelerin birbiriyle bağlantılı olup olmadığını kontrol etmek gerekir (örn. zamirler)
             # Şimdilik basitçe tüm cümleleri adım kabul edelim
             steps = meaningful_sentences

    return len(steps) > 1, steps


def _evaluate_rule_conditions(conditions, aktif_baglam):
    """ Kural koşullarını aktif bağlama göre değerlendirir (BASİT ÖRNEK). """
    if not conditions or not isinstance(conditions, dict): return True # Koşul yoksa geçerli

    match_all = conditions.get('$match', 'all') == 'all' # 'all' veya 'any'
    results = []

    for key, value in conditions.items():
        if key == '$match': continue
        condition_met = False
        try:
            if key == 'intent_is': condition_met = aktif_baglam['sorgu_niyeti'] == value
            elif key == 'query_contains': condition_met = value.lower() in aktif_baglam['kullanici_sorusu'].lower()
            elif key == 'context_has_type': condition_met = any(doc.get('tur') == value for doc in aktif_baglam['ilgili_bilgiler'])
            elif key == 'context_missing_type': condition_met = not any(doc.get('tur') == value for doc in aktif_baglam['ilgili_bilgiler'])
            elif key == 'context_has_keyword': condition_met = any(value.lower() in doc.get('metin','').lower() for doc in aktif_baglam['ilgili_bilgiler'])
            # ... daha fazla koşul türü eklenebilir (history_mentions, context_has_entity, etc.)
        except Exception as e: print(f"[Hata Kural Koşulu] {key}: {e}")
        results.append(condition_met)

    if not results: return True # Hiç koşul yoksa
    if match_all: return all(results)
    else: return any(results)


def _apply_rule_set(rule_set_doc, aktif_baglam):
    """
    Verilen kural kümesindeki kuralları sırayla değerlendirir ve ilk eşleşeni uygular.
    """
    print(f"[Bilgi] Kural Kümesi Değerlendiriliyor: {rule_set_doc.get('kume_id')}")
    kurallar = rule_set_doc.get('kurallar', [])
    if not isinstance(kurallar, list): return None # Geçersiz kural yapısı

    # Kuralları önceliğe göre sırala (varsa)
    kurallar.sort(key=lambda x: x.get('oncelik', 0), reverse=True)

    for kural in kurallar:
        kural_id = kural.get('kural_id', 'Adsız Kural')
        kosullar = kural.get('kosullar')
        eylemler = kural.get('eylemler') # Eylemler listesi olabilir

        if not eylemler: continue # Eylem yoksa atla

        # Koşulları değerlendir
        if _evaluate_rule_conditions(kosullar, aktif_baglam):
            print(f"  -> Kural Eşleşti: {kural_id}")
            # İlk eşleşen kuralın eylemlerini gerçekleştir (şimdilik ilk eylemi alalım)
            # GEREKLİ: Tüm eylemleri işleyen daha karmaşık mantık
            eylem = eylemler[0] if isinstance(eylemler, list) and eylemler else eylemler if isinstance(eylemler, dict) else None
            if not eylem: continue

            eylem_tipi = eylem.get('tip')
            eylem_degeri = eylem.get('deger')

            # Eylem tiplerine göre sonuç üret
            if eylem_tipi == 'yanit_ver':
                return {
                    "type": "rule_applied",
                    "data": {
                        "kural_id": kural_id,
                        "kume_id": rule_set_doc.get('kume_id'),
                        "sonuc": eylem_degeri # Yanıt metni veya şablon ID'si olabilir
                        # ResponseGenerator bu sonucu işleyebilir
                    }
                }
            elif eylem_tipi == 'bilgi_getir':
                # Belirtilen filtre ile DB'den ek bilgi getir
                doc = database.find_one_document('COLLECTION_BILGI', eylem_degeri or {})
                if doc: return {"type": "fact_found", "data": doc} # Bulunan bilgiyi döndür
            elif eylem_tipi == 'yeni_sorgu_yap':
                 # Bu daha karmaşık, state makinesi gerektirebilir. Şimdilik pass.
                 pass
            # ... başka eylem tipleri ...

            # Eşleşen kural bulundu ve işlendi, döngüden çık
            return None # Veya işlenen eylemin sonucunu döndür
    return None # Eşleşen kural bulunamadı


def _apply_hypothesis_template(template_doc, aktif_baglam):
    """
    Verilen hipotez şablonunu aktif bağlama göre uygular (Jinja2 ile).
    """
    print(f"[Bilgi] Hipotez Şablonu Değerlendiriliyor: {template_doc.get('sablon_id')}")
    tetikleyici_kosullar = template_doc.get('tetikleyici')

    # Tetikleyici koşulları kontrol et
    if _evaluate_rule_conditions(tetikleyici_kosullar, aktif_baglam):
        print(f"  -> Tetikleyici Eşleşti!")
        sablon_icerigi = template_doc.get('metin') # Jinja2 formatında olmalı
        if not sablon_icerigi: return None

        # Şablonu doldurmak için bağlam hazırla
        # _prepare_template_context benzeri bir yapı kullanılabilir
        template_context = {
            'baglam': aktif_baglam,
            'data': template_doc # Şablonun kendi verileri de kullanılabilir
        }
        # Jinja2 ile şablonu doldur
        try:
             # Basit Jinja env kullan (ResponseGenerator'daki gibi)
             from jinja2 import Environment
             jinja_env_hypo = Environment()
             template = jinja_env_hypo.from_string(sablon_icerigi)
             hipotez_metni = template.render(template_context)
             return {
                 "type": "hypothesis_generated",
                 "data": {
                     "sablon_id": template_doc.get('sablon_id'),
                     "hipotez": hipotez_metni
                 }
             }
        except Exception as e:
             print(f"[Hata Hipotez Şablonu] Doldurma hatası: {e}")
             return None
    return None # Tetikleyici eşleşmedi


def _execute_dynamic_procedural_inference(aktif_baglam):
    """
    Çekirdek çıkarım mantığı: Bağlama göre cevap/kural/prosedür/çıkarım yapar.
    Sonucu yapısal olarak döndürür.
    """
    kullanici_sorusu = aktif_baglam.get('kullanici_sorusu', '')
    if not kullanici_sorusu:
        return {"type": "fallback", "data": {"sebep": "Soru eksik."}}

    ilgili_bilgiler = aktif_baglam.get('ilgili_bilgiler', []) # Öncelikli liste

    # Öncelik sırası:
    # 1. Doğrudan Cevap / Prosedür (En alakalı ilk belgeye göre)
    # 2. Kural Kümeleri (İlk eşleşen kural)
    # 3. Hipotez Şablonları (İlk tetiklenen şablon)
    # 4. En iyi 'Gerçek' Bilgi
    # 5. Fallback

    # Adım 1: Doğrudan Cevap / Prosedür
    for bilgi in ilgili_bilgiler:
        tur = bilgi.get('tur')
        if tur == 'soru-cevap':
            # TODO: Daha iyi eşleştirme (Embedding benzerliği?)
            soru_anahtar = bilgi.get('soru_veya_anahtar', '').lower()
            if soru_anahtar and soru_anahtar in kullanici_sorusu.lower():
                return {"type": "qa_found", "data": bilgi}
        elif tur == 'prosedür':
             prosedur_adi = bilgi.get('prosedur_adi', '').lower()
             if prosedur_adi and prosedur_adi in kullanici_sorusu.lower():
                  return {"type": "procedure_found", "data": bilgi}

    # Adım 2: Kural Kümeleri Uygulama
    for bilgi in ilgili_bilgiler:
        if bilgi.get('tur') == 'kural_kumesi':
            kural_sonucu = _apply_rule_set(bilgi, aktif_baglam)
            if kural_sonucu: return kural_sonucu # İlk başarılı kural uygulamasını döndür

    # Adım 3: Hipotez Şablonları Uygulama
    for bilgi in ilgili_bilgiler:
         if bilgi.get('tur') == 'hipotez_sablonu':
             hipotez_sonucu = _apply_hypothesis_template(bilgi, aktif_baglam)
             if hipotez_sonucu: return hipotez_sonucu # İlk başarılı hipotezi döndür

    # Adım 4: En İyi 'Gerçek' Bilgiyi Sunma
    for bilgi in ilgili_bilgiler:
        if bilgi.get('tur') == 'gerçek':
             return {"type": "fact_found", "data": bilgi}

    # Adım 5: Nihai Fallback
    return {"type": "fallback", "data": {"sebep": "Uygun bilgi, kural veya şablon bulunamadı."}}


def _execute_step_sequence(steps, session_context, prompt_definition=None):
     """ Verilen adımları sırayla yürütür, bağlamı korur. """
     print(f"[Bilgi] Çok adımlı görev yürütülüyor ({len(steps)} adım)...")
     step_responses = []
     # Son adımın sonucunu değil, tüm adımların bir özetini döndürebiliriz
     final_outcome = {
         "type": "multi_step_result",
         "data": {
             "completed_steps": [],
             "final_summary": "Görev adımları işlendi."
         }
     }
     last_successful_inference = None

     for i, step_query in enumerate(steps):
          step_num = i + 1
          print(f"  -> Adım {step_num}/{len(steps)}: '{step_query[:80]}...'")
          # _process_single_query'yi çağır
          step_inference_result = _process_single_query(step_query, session_context)

          # Yanıtı üret (kullanıcıya gösterilmese bile loglama/bağlam için önemli)
          step_response_text = response_generator.generate_response(step_inference_result, session_context, prompt_definition)

          # Oturumu manuel güncelle
          if session_context and isinstance(session_context, session_manager.SessionContext):
               session_context.add_entry(step_query, step_response_text)

          # Sonuçları kaydet
          final_outcome["data"]["completed_steps"].append({
              "query": step_query,
              "inference_type": step_inference_result.get('type'),
              "response": step_response_text
          })
          if step_inference_result.get('type') != 'fallback':
              last_successful_inference = step_inference_result # Son başarılı sonucu sakla

     # Özet olarak son başarılı yanıtı veya genel bir mesajı kullanabiliriz
     if last_successful_inference:
          # Son başarılı adımın yanıtını tekrar üretip özet olarak verebiliriz
          final_summary_response = response_generator.generate_response(last_successful_inference, session_context, prompt_definition)
          final_outcome["data"]["final_summary"] = f"Son adım sonucu: {final_summary_response}"
     else:
          final_outcome["data"]["final_summary"] = "Tüm adımlar işlendi ancak belirgin bir sonuç bulunamadı."

     print(f"[Bilgi] Çok adımlı görev tamamlandı.")
     return final_outcome # Tüm adımların sonucunu içeren yapıyı döndür


def _process_single_query(query, session_context):
     """ Tek bir sorguyu işleyen iç mantık (çoklu adım hariç). """
     # Aktif Bağlamı Oluştur (Artık daha zengin)
     aktif_baglam = _build_active_context(query, session_context)
     if aktif_baglam.get("error"):
         return {"type": "fallback", "data": {"sebep": aktif_baglam["error"]}}

     # Dinamik Yordamsal Çıkarım Mantığını Çalıştır (Artık daha yetenekli)
     inference_result = _execute_dynamic_procedural_inference(aktif_baglam)
     return inference_result


# --- Ana Sorgu İşleme Fonksiyonu ---
def process_query(query, session_context, prompt_definition=None):
    """
    Ana sorgu işleme fonksiyonu. Daha gelişmiş mantık içerir.
    """
    if not MODULES_AVAILABLE or not response_generator:
        return "Sistem modülleri veya yanıt üretici yüklenemedi."

    start_time = time.time()
    final_response = getattr(config, 'DEFAULT_FALLBACK_RESPONSE', "İşlem hatası.")
    inference_result = None

    try:
        # 1. Çok Adımlı Görev Tespiti ve Yürütme
        is_multi_step, steps = _detect_and_plan_multi_step(query)
        if is_multi_step:
            inference_result = _execute_step_sequence(steps, session_context, prompt_definition)
        else:
            # 2. Tek Adımlı Sorgu İşleme
            inference_result = _process_single_query(query, session_context)

        # 3. Yanıtı Son Haline Getir / Formatla (Gelişmiş Response Generator ile)
        final_response = response_generator.generate_response(inference_result, session_context, prompt_definition)

        # 4. Etkileşimi Kaydet (process_query içinde sadece tek/son adım loglanır)
        # _execute_step_sequence içinde adımlar zaten loglanıyor (belleğe)
        if not is_multi_step: # Sadece tek adımlıysa burada logla
            if session_context and isinstance(session_context, session_manager.SessionContext):
                session_id = session_context.get_session_id()
                session_lang = session_context.get_language()
                session_context.add_entry(query, final_response) # Bellek
                try: # DB Log
                    timestamp = datetime.datetime.now(datetime.timezone.utc)
                    database.add_sohbet_entry({"session_id": session_id, "timestamp": timestamp,"tur": "kullanici", "metin": query, "dil": session_lang})
                    database.add_sohbet_entry({"session_id": session_id, "timestamp": timestamp,"tur": "sistem", "metin": final_response, "dil": session_lang})
                except Exception as log_error: print(f"[Hata] Sohbet loglama hatası: {log_error}")

    except Exception as main_err:
         print(f"[HATA] Query Manager ana işlem hatası: {main_err}")
         traceback.print_exc()
         # Hata durumunda da fallback şablonunu kullanmayı dene
         error_inference = {"type": "fallback", "data": {"sebep": f"İç Hata: {main_err}"}}
         try:
             final_response = response_generator.generate_response(error_inference, session_context, None)
         except Exception:
             final_response = getattr(config, 'DEFAULT_FALLBACK_RESPONSE', "Beklenmedik bir hata oluştu.")


    end_time = time.time()
    # print(f"[QM] Süre: {end_time - start_time:.3f} sn.")
    return final_response

# --- Doğrudan Çalıştırma Testleri ---
if __name__ == "__main__":
    # ... (Test bloğu öncekiyle benzer, ancak daha gelişmiş mantığı
    #      ve yapısal sonuçları test edecek şekilde güncellenmeli) ...
    print("--- Query Manager Testi Başladı (v3 - Gelişmiş Mantık) ---")
    # ... (Test kodu buraya eklenebilir) ...
    print("\n--- Query Manager Testi Tamamlandı (v3 - Gelişmiş Mantık) ---")