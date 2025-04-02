# query_manager.py

import time
import datetime

# Gerekli modülleri ve yapılandırmayı import et
try:
    import config
    import database
    import nlp_processor
    import session_manager # SessionContext sınıfı için
    # import emotion_processor # Daha sonra eklenecek duygu analizi
    # import task_manager # Çoklu görevler için (task_manager kullanacaksa döngüsel import olmamalı)
    MODULES_AVAILABLE = True
    print("[Query Manager] Gerekli modüller başarıyla yüklendi.")
except ImportError as e:
    print(f"[HATA] query_manager: Gerekli modüller yüklenemedi: {e}")
    MODULES_AVAILABLE = False
    # Çalışmaya devam edebilmesi için None ataması yapalım
    config = None
    database = None
    nlp_processor = None
    session_manager = None
except AttributeError as e:
    print(f"[HATA] query_manager: config dosyasında beklenen bir ayar bulunamadı: {e}")
    MODULES_AVAILABLE = False


# --- Bağlam Yönetimi Alt Fonksiyonu (Detaylı Tasarım GEREKLİ) ---
def _build_active_context(query, session_context):
    """
    Verilen sorgu ve oturum bilgisiyle aktif bağlam paketini oluşturur.
    Geçmişi alır, vektör ve kelime araması yapar, sonuçları birleştirir/önceliklendirir.
    """
    if not MODULES_AVAILABLE: return {"error": "Modüller yüklenemedi"}

    aktif_baglam = {
        'kullanici_sorusu': query,
        'ilgili_bilgiler': [], # Birleştirilmiş ve sıralanmış sonuçlar
        'gecmis_konusma': [], # Bellekteki geçmiş
        'duygu_niyet': None   # Gelecekteki analiz sonucu
    }

    # 1. Geçmişi Al (Bellekten)
    if session_context and isinstance(session_context, session_manager.SessionContext):
        # Son N konuşmayı alalım (limit session_manager'da)
        aktif_baglam['gecmis_konusma'] = session_context.get_recent_history()

    # 2. Vektör Araması Yap
    query_vector = nlp_processor.get_embedding(query)
    vector_results = []
    if query_vector:
        # Sadece doğrulanmış veya bekleyenleri ara, hatalı/kullanılmayanları dışarıda bırak
        filter_criteria = {"validation_status": {"$nin": ["hatali", "kullanilmiyor"]}}
        # database.py'deki vektör arama fonksiyonunu çağır (top_n = 5 örnek)
        vector_results = database.vector_search_bilgi(query_vector, top_n=5, filter_criteria=filter_criteria)

    # 3. Kelime/Metin Araması Yap
    text_results = []
    filter_criteria_text = {"validation_status": {"$nin": ["hatali", "kullanilmiyor"]}}
    # database.py'deki metin arama fonksiyonunu çağır (limit = 5 örnek)
    text_results = database.text_search_bilgi(query, filter_criteria=filter_criteria_text, limit=5)

    # 4. Birleştirme ve Önceliklendirme Mantığı (BASİT ÖRNEK - GELİŞTİRİLMELİ)
    # --- GEREKLİ: Burası sizin özel yordamınızın ana parçalarından biri olacak ---
    combined_results = {} # Sonuçları ID bazlı birleştirelim
    result_limit = 5      # Sonuçta en fazla kaç bilgi parçası tutulacak

    # Vektör sonuçlarını ekle (skorlarıyla)
    for doc in vector_results:
        doc_id = doc.get('_id')
        if doc_id:
            doc['search_type'] = 'vector'
            doc['relevance_score'] = doc.get('score', 0) # Vektör benzerlik skoru
            combined_results[doc_id] = doc

    # Metin arama sonuçlarını ekle (vektörde yoksa veya skoru artırarak)
    for doc in text_results:
        doc_id = doc.get('_id')
        if doc_id:
            text_score = doc.get('score', 0) # Metin arama skoru
            if doc_id in combined_results:
                # Zaten vektörde varsa, skorları birleştirebiliriz (basit toplama?)
                combined_results[doc_id]['relevance_score'] += text_score
                combined_results[doc_id]['search_type'] += '+text'
            else:
                # Vektörde yoksa yeni ekle
                doc['search_type'] = 'text'
                doc['relevance_score'] = text_score
                combined_results[doc_id] = doc

    # Önceliklendirme: relevance_score'a göre + validation_status'a göre
    def calculate_priority(item):
        score = item.get('relevance_score', 0)
        status = item.get('validation_status')
        if status == 'dogrulandi':
            score += 1.0 # Doğrulanmışlara öncelik ver (basit bonus)
        elif status == 'bekliyor':
            score += 0.1 # Bekleyenlere küçük bonus
        # 'hatali' ve 'kullanilmiyor' zaten filtrelenmişti
        return score

    # Hesaplanan önceliğe göre sırala (en yüksek önce)
    sorted_results = sorted(combined_results.values(), key=calculate_priority, reverse=True)

    # En alakalı ilk N tanesini al
    aktif_baglam['ilgili_bilgiler'] = sorted_results[:result_limit]

    # 5. Duygu/Niyet Analizi (Eklenecek)
    # aktif_baglam['duygu_niyet'] = emotion_processor.analyze_emotion(query)

    # print(f"[Debug Context] Oluşturulan Bağlam: {aktif_baglam}") # Detaylı debug
    return aktif_baglam

# --- Soru Yanıtlama Çekirdek Mantığı (Detaylı Tasarım GEREKLİ) ---
def _execute_qna_logic(kullanici_sorusu, aktif_baglam):
    """
    Aktif bağlamı kullanarak soruyu yanıtlamak için üzerinde anlaşılan
    mantık akışını (a-f adımları) uygular.
    """
    if not aktif_baglam or not kullanici_sorusu:
        return getattr(config, 'DEFAULT_FALLBACK_RESPONSE', "Bağlam veya soru işlenemedi.")

    ilgili_bilgiler = aktif_baglam.get('ilgili_bilgiler', [])

    # Adım 1: Doğrudan Cevap Arama (S-C Tipi)
    for bilgi in ilgili_bilgiler: # Öncelik sırasına göre geliyorlar
        if bilgi.get('tur') == 'soru-cevap':
            # --- GEREKLİ 1: Soru Eşleştirme Mantığı ---
            # Gelen `kullanici_sorusu` ile bu `bilgi`'deki asıl soru nasıl eşleşir?
            # Vektör benzerliği mi? Anahtar kelime mi? Tam eşleşme mi?
            # Şimdilik, eğer bu bilgi arama sonuçlarında üstteyse, alakalı kabul edelim.
            stored_answer = bilgi.get('icerik') # Veya cevap özel bir alanda mı?
            if stored_answer:
                 print("[Debug Logic] Adım 1: Doğrudan S-C bulundu.")
                 return stored_answer

    # Adım 2: Kural Uygulama
    for kural in ilgili_bilgiler:
        if kural.get('tur') == 'kural':
            # --- GEREKLİ 2: Kural Koşulunu Değerlendirme Mantığı ---
            kosul = kural.get('kural_kosulu')
            sonuc = kural.get('kural_sonucu')
            # Örnek: Koşul, soruda veya bulunan diğer bilgilerde geçiyor mu?
            # Bu mantık çok detaylı tasarlanmalı.
            if kosul and sonuc and kosul.lower() in kullanici_sorusu.lower(): # Çok basit örnek
                 print("[Debug Logic] Adım 2: Kural tetiklendi.")
                 return sonuc

    # Adım 3: Prosedür Tanıma
    for prosedur in ilgili_bilgiler:
        if prosedur.get('tur') == 'prosedür':
             # --- GEREKLİ 3: Sorunun Prosedür İsteği Olduğunu Anlama ---
             prosedur_adi = prosedur.get('prosedur_adi')
             adımlar = prosedur.get('adim_listesi')
             # Örnek: Prosedür adı soruda geçiyorsa
             if prosedur_adi and adımlar and prosedur_adi.lower() in kullanici_sorusu.lower():
                  print("[Debug Logic] Adım 3: Prosedür bulundu.")
                  yanıt = f"{prosedur_adi} için adımlar:\n" + "\n".join([f"- {adim}" for adim in adımlar])
                  return yanıt

    # Adım 4: En İyi Bilgiden Çıkarım ('gerçek' tipi)
    for bilgi in ilgili_bilgiler: # Sıralı geliyorlar
        if bilgi.get('tur') == 'gerçek':
             # --- GEREKLİ 4: İçerikten Cevap Çıkarma Mantığı ---
             # Şimdilik, bulunan en alakalı 'gerçek' bilginin tamamını döndür.
             print("[Debug Logic] Adım 4: En iyi 'gerçek' bilgi kullanıldı.")
             return bilgi.get('metin', "İlgili bilgi bulundu ancak içerik detayı eksik.") # 'metin' alanını varsayalım

    # Adım 5: Temel Sentezleme (İsteğe bağlı geliştirme)
    # Birden fazla sonucu birleştirme mantığı buraya gelebilir.

    # Adım 6: Fallback
    # --- GEREKLİ 5: Gelişmiş Fallback Mantığı ---
    # Örn: Geçmişe bakma, kullanıcıya sorma. Şimdilik standart mesaj.
    print("[Debug Logic] Adım 6: Fallback.")
    return getattr(config, 'DEFAULT_FALLBACK_RESPONSE', "Üzgünüm, bu konuda bir yanıt bulamadım.")


# --- Ana Sorgu İşleme Fonksiyonu ---
def process_query(query, session_context, prompt_definition=None):
    """
    Ana sorgu işleme fonksiyonu. Bağlamı oluşturur, çekirdek mantığı çalıştırır,
    yanıtı formatlar ve etkileşimi kaydeder.

    Args:
        query (str): Kullanıcının sorgu metni.
        session_context (SessionContext): Aktif oturum bağlam nesnesi.
        prompt_definition (str, optional): Varsa prompt tanımı.

    Returns:
        str: Modelin ürettiği yanıt.
    """
    if not MODULES_AVAILABLE:
        return "Sistem modülleri yüklenemediği için sorgu işlenemiyor."

    start_time = time.time()
    print(f"\n[Query Manager] Sorgu alınıyor: '{query[:100]}...'") # Loglama

    # 1. Aktif Bağlamı Oluştur (Arama ve Birleştirme)
    aktif_baglam = _build_active_context(query, session_context)
    if aktif_baglam.get("error"):
         return aktif_baglam["error"]

    # 2. Çekirdek Mantığı Çalıştır (Soru Yanıtlama / Görev Yürütme)
    # --- GEREKLİ: Burada sorgu tipine göre farklı execute_* fonksiyonları çağrılabilir ---
    # Şimdilik sadece QnA varsayıyoruz
    raw_response = _execute_qna_logic(query, aktif_baglam)

    # 3. Yanıtı Son Haline Getir
    final_response = raw_response # Şimdilik direkt kullan

    # Prompt tanımı varsa uygula (Basit örnek)
    if prompt_definition:
         # --- GEREKLİ: Prompt uygulama mantığı ---
         final_response += f"\n[Not: '{prompt_definition}' prompt'u dikkate alınarak yanıt verildi.]"

    # Duygu analizi sonucu varsa yanıta ton ekle (Basit örnek)
    # emotion_data = aktif_baglam.get('duygu_niyet')
    # if emotion_data:
    #     final_response = apply_emotion_to_response(final_response, emotion_data) # Bu fonksiyon yazılmalı

    # 4. Etkileşimi Kaydet (Hem bellek içi hem kalıcı DB)
    if session_context and isinstance(session_context, session_manager.SessionContext):
        # Bellek içi geçmişe ekle
        session_context.add_entry(query, final_response)
        # Kalıcı veritabanına logla
        try:
            user_log = {
                "session_id": session_context.get_session_id(),
                "timestamp": datetime.datetime.now(datetime.timezone.utc),
                "tur": "kullanici",
                "metin": query,
                "dil": session_context.get_language()
            }
            database.add_sohbet_entry(user_log)

            system_log = {
                "session_id": session_context.get_session_id(),
                "timestamp": datetime.datetime.now(datetime.timezone.utc),
                "tur": "sistem",
                "metin": final_response,
                "dil": session_context.get_language(),
                # Belki kullanılan bağlam bilgileri de loglanabilir (debug/analiz için)
                # "kullanilan_bilgi_idler": [str(b['_id']) for b in aktif_baglam.get('ilgili_bilgiler', [])]
            }
            database.add_sohbet_entry(system_log)
        except Exception as log_error:
            print(f"[Hata] Sohbet geçmişi loglanırken hata: {log_error}")


    end_time = time.time()
    print(f"[Query Manager] Yanıt üretildi ({end_time - start_time:.3f} saniye).")

    return final_response


# --- Doğrudan Çalıştırma Testleri ---
if __name__ == "__main__":
    print("--- Query Manager Testi Başladı ---")
    print("    UYARI: Bu test, diğer modüllerin (config, database, nlp_processor, session_manager)")
    print("           düzgün çalıştığını ve MongoDB'nin erişilebilir olduğunu varsayar.")
    print("           Tam fonksiyonellik için ana 'model.py' script'i kullanılmalıdır.")

    # Test için temel kurulumu yapmaya çalışalım
    if not MODULES_AVAILABLE:
        print("\nModüller yüklenemediği için test yapılamıyor.")
    elif not database.get_db_connection(): # DB bağlantısını test et
        print("\nVeritabanı bağlantısı kurulamadığı için test yapılamıyor.")
    elif not nlp_processor.init_nlp(): # NLP modelini yüklemeyi dene
        print("\nNLP işlemcisi başlatılamadığı için test yapılamıyor.")
    else:
        print("\nTest ortamı hazır görünüyor...")
        # Basit bir oturum başlatalım
        test_session = session_manager.SessionContext(language='tr')

        test_queries = [
            "MongoDB nedir?",
            "Bu konuda bilgim yok", # Fallback test
            "kurulum nasıl yapılır?" # Prosedür testi (varsa)
        ]

        for q in test_queries:
            print("-" * 20)
            response = process_query(q, test_session)
            print(f"Soru : {q}")
            print(f"Yanıt: {response}")

        database.close_db_connection() # Test bitince bağlantıyı kapat

    print("\n--- Query Manager Testi Tamamlandı ---")