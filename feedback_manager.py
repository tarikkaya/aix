# feedback_manager.py

import datetime

# Gerekli modülleri import etmeyi dene
try:
    import config
    import database
    from bson.objectid import ObjectId # String ID'leri ObjectId'ye çevirmek için
    MODULES_AVAILABLE = True
    print("[Feedback Manager] Gerekli modüller başarıyla yüklendi.")
except ImportError as e:
    print(f"[HATA] feedback_manager: Gerekli modüller ('config', 'database', 'bson') yüklenemedi: {e}")
    print("       Lütfen bu dosyaların/kütüphanelerin mevcut olduğundan emin olun.")
    MODULES_AVAILABLE = False
    # Hata durumunda diğer fonksiyonların çalışmaması için sahte nesneler
    config = type('obj', (object,), {'COLLECTION_GERIBILDIRIM': "geri_bildirimler", 'COLLECTION_BILGI': "bilgi_parcaciklari"})()
    database = None
    ObjectId = None
except AttributeError as e:
    print(f"[HATA] feedback_manager: config dosyasında beklenen bir ayar bulunamadı: {e}")
    MODULES_AVAILABLE = False
    database = None # database de kullanılamaz
    ObjectId = None


# Kullanıcı geri bildirim türlerini standart veritabanı durumlarına çeviren harita
FEEDBACK_TO_STATUS_MAP = {
    "doğru": "dogrulandi",
    "onaylanmış": "dogrulandi",
    "düzeltilmiş": "dogrulandi", # Düzeltme sonrası doğrulandı kabul edilebilir
    "hatalı": "hatali",
    "hatalı ama yaklaşmış": "hatali", # Ayrı bir statü de olabilir, şimdilik 'hatali'
    "silinen": "kullanilmiyor", # Kullanım dışı bırak
    "anlamsız": "kullanilmiyor", # Kullanım dışı bırak
    "atla": None, # Durumu değiştirme
    # Gelecekte eklenebilecek diğer geri bildirim türleri
}

def log_and_update_feedback(doc_id, feedback_type, session_id, comment=None, corrected_text=None):
    """
    Kullanıcı geri bildirimini veritabanına loglar ve ilgili bilgi parçasının
    doğrulama durumunu (validation_status) günceller.

    Args:
        doc_id (str or ObjectId): Geri bildirim verilen belgenin string veya ObjectId türünden ID'si.
        feedback_type (str): Kullanıcının verdiği geri bildirim türü ('doğru', 'hatalı' vb.).
        session_id (str): Geri bildirimin yapıldığı oturumun ID'si.
        comment (str, optional): Kullanıcının ek yorumu.
        corrected_text (str, optional): Eğer 'düzeltilmiş' tipindeyse, önerilen doğru metin.

    Returns:
        bool: Loglama ve (gerekliyse) güncelleme işlemi genel olarak başarılıysa True.
    """
    if not MODULES_AVAILABLE or not database or not ObjectId:
        print("[HATA] Gerekli modüller/nesneler yüklenemediği için geri bildirim işlenemiyor.")
        return False

    processed_doc_id = None
    if doc_id:
        try:
            # ID'nin geçerli bir ObjectId olduğundan emin olalım
            processed_doc_id = ObjectId(doc_id)
        except Exception:
            print(f"[Uyarı] Geri bildirim için geçersiz belge ID'si: {doc_id}")
            # Belge ID'si olmadan loglama yapabiliriz ama güncelleme yapamayız.

    feedback_type_lower = feedback_type.lower()

    # 1. Adım: Geri bildirimi ayrı bir koleksiyona logla
    feedback_doc = {
        "document_id": processed_doc_id, # İlişkili belge ID'si (varsa)
        "feedback_type": feedback_type_lower,
        "session_id": session_id,
        "timestamp": datetime.datetime.now(datetime.timezone.utc),
        "comment": comment,
        "corrected_text": corrected_text # Düzeltilmiş metin (varsa)
    }
    feedback_log_id = database.add_feedback(feedback_doc)

    if not feedback_log_id:
        print(f"[HATA] Geri bildirim logu (Belge ID: {doc_id}) veritabanına kaydedilemedi.")
        # Loglama başarısızsa işlemi başarısız kabul edelim
        return False

    # 2. Adım: Bilgi parçasının doğrulama durumunu güncelle (eğer ID geçerliyse ve tip gerektiriyorsa)
    new_status = FEEDBACK_TO_STATUS_MAP.get(feedback_type_lower)

    if new_status and processed_doc_id:
        # database.py içindeki güncelleme fonksiyonunu çağır
        success = database.update_bilgi_validation(processed_doc_id, new_status, session_id)
        if not success:
            # Güncelleme başarısız olsa bile loglama başarılı olduğu için True dönebiliriz,
            # ancak bir uyarı loglamak iyi olur.
            print(f"[Uyarı] Geri bildirim loglandı (ID: {feedback_log_id}) ancak belge durumu güncellenemedi (ID: {doc_id}).")
        # return success # Sadece güncelleme başarısına mı bağlı olmalı?
        return True # Loglama başarılıysa True dönelim şimdilik
    elif feedback_type_lower == "atla":
        # Atla durumunda sadece loglama yapılır, güncelleme olmaz. Loglama başarılı.
        return True
    elif not processed_doc_id and new_status:
         # Geçerli ID yoksa durumu güncelleyemeyiz ama loglama başarılı.
         return True
    else:
        # Bilinmeyen feedback_type veya durum değişikliği gerektirmeyen tip. Loglama başarılı.
        # print(f"[Bilgi] Bilinmeyen veya durum değiştirmeyen geri bildirim tipi: {feedback_type}")
        return True

def get_record_for_validation(skip_ids=None):
    """
    Kullanıcının doğrulaması için uygun bir kayıt (önce 'bekliyor',
    sonra en eski 'dogrulandi') bulur ve döndürür.
    Atlanan ID'leri tekrar göstermemeye çalışır.

    Args:
        skip_ids (list, optional): Bu oturumda kullanıcının 'Atla' dediği ID'lerin listesi.

    Returns:
        dict or None: Doğrulanacak belge veya bulunamazsa None.
    """
    if not MODULES_AVAILABLE or not database or not ObjectId: return None

    processed_skip_ids = []
    if skip_ids:
        # Gelen ID'leri ObjectId'ye çevir, geçersizleri atla
        for sid in skip_ids:
            try:
                processed_skip_ids.append(ObjectId(sid))
            except Exception:
                pass # Geçersiz ID'yi görmezden gel

    # Öncelik 1: 'bekliyor' durumunda olanlar (atlananlar hariç)
    query_filter_pending = {"validation_status": "bekliyor"}
    if processed_skip_ids:
        query_filter_pending["_id"] = {"$nin": processed_skip_ids}

    try:
        pending_records = database.find_bilgi(config.COLLECTION_BILGI, query_filter_pending, limit=1)
        if pending_records:
            # print(f"[Debug Feedback] Doğrulama için 'bekliyor' bulundu: {pending_records[0]['_id']}")
            return pending_records[0] # find_bilgi liste döndürür varsayımı

        # Öncelik 2: 'dogrulandi' durumunda olanlardan en eski doğrulanmış olan (atlananlar hariç)
        query_filter_oldest = {"validation_status": "dogrulandi"}
        if processed_skip_ids:
            query_filter_oldest["_id"] = {"$nin": processed_skip_ids}

        # last_validated_ts alanına göre artan sırada (ASCENDING) sırala
        oldest_validated = database.find_bilgi(
            config.COLLECTION_BILGI,
            query_filter_oldest,
            sort_by=[("last_validated_ts", ASCENDING)], # pymongo.ASCENDING
            limit=1
        )
        if oldest_validated:
             # print(f"[Debug Feedback] Doğrulama için en eski 'dogrulandi' bulundu: {oldest_validated[0]['_id']}")
             return oldest_validated[0]

        # Hiç uygun kayıt bulunamadıysa
        return None

    except Exception as e:
        print(f"[HATA] Doğrulama için kayıt aranırken hata: {e}")
        return None

# --- Doğrudan Çalıştırma Testleri ---
if __name__ == "__main__":
    print("--- Feedback Manager Testi Başladı ---")

    # Test için sahte modüller
    if not MODULES_AVAILABLE:
        print("Sahte DB modülü kullanılıyor...")
        from bson.objectid import ObjectId
        MOCK_DB_FEEDBACK = []
        MOCK_DB_BILGI = {
            "605c7d77a1d2e3f4a5b6c7d8": {"metin": "Bekleyen örnek", "validation_status": "bekliyor"},
            "705c7d77a1d2e3f4a5b6c7d9": {"metin": "Doğrulanmış eski", "validation_status": "dogrulandi", "last_validated_ts": datetime.datetime(2024, 1, 1)}
        }
        class MockDatabase:
            def add_feedback(self, doc):
                fb_id = ObjectId()
                doc['_id'] = fb_id
                MOCK_DB_FEEDBACK.append(doc)
                print(f"  -> [Sahte DB] add_feedback: {doc}")
                return fb_id
            def update_bilgi_validation(self, doc_id, status, sid):
                str_id = str(doc_id)
                print(f"  -> [Sahte DB] update_bilgi_validation: ID={str_id}, Status={status}, Session={sid}")
                if str_id in MOCK_DB_BILGI:
                    MOCK_DB_BILGI[str_id]['validation_status'] = status
                    MOCK_DB_BILGI[str_id]['last_validated_ts'] = datetime.datetime.now(datetime.timezone.utc)
                    return True
                return False
            def find_bilgi(self, coll, query, limit=1, sort_by=None):
                 print(f"  -> [Sahte DB] find_bilgi: Coll={coll}, Query={query}, Limit={limit}, Sort={sort_by}")
                 results = []
                 # Basit filtreleme ve sıralama simülasyonu
                 status_filter = query.get("validation_status")
                 nin_filter = query.get("_id", {}).get("$nin", [])
                 str_nin_filter = {str(oid) for oid in nin_filter}

                 candidates = []
                 for doc_id_str, doc_data in MOCK_DB_BILGI.items():
                      if doc_id_str in str_nin_filter: continue
                      if status_filter and doc_data.get("validation_status") != status_filter: continue
                      # Sahte _id ekleyerek döndür
                      data_with_id = doc_data.copy()
                      data_with_id['_id'] = ObjectId(doc_id_str)
                      candidates.append(data_with_id)

                 # Sıralama (sadece timestamp için basit simülasyon)
                 if sort_by and sort_by[0][0] == "last_validated_ts" and sort_by[0][1] == ASCENDING:
                      candidates.sort(key=lambda x: x.get("last_validated_ts", datetime.datetime.max))

                 return candidates[:limit] # Limite göre döndür

        database = MockDatabase()
        MODULES_AVAILABLE = True

    test_doc_id_pending = "605c7d77a1d2e3f4a5b6c7d8"
    test_doc_id_validated = "705c7d77a1d2e3f4a5b6c7d9"
    test_session = "test-feedback-session"

    print("\nGeri bildirim loglama ve güncelleme testi:")
    log_and_update_feedback(test_doc_id_pending, "doğru", test_session, comment="İlk onay")
    log_and_update_feedback(test_doc_id_pending, "hatalı", test_session)
    log_and_update_feedback(test_doc_id_validated, "anlamsız", test_session)
    log_and_update_feedback(test_doc_id_validated, "atla", test_session) # Durumu değiştirmemeli

    print("\nDB Durumu (Simülasyon):")
    print(MOCK_DB_BILGI)
    print("\nFeedback Logları (Simülasyon):")
    for log in MOCK_DB_FEEDBACK: print(f"  {log}")

    print("\nDoğrulama için kayıt getirme testi:")
    print("İlk getirme (bekleyen olmalı):")
    record1 = get_record_for_validation()
    if record1: print(f"  -> Bulundu: ID={record1.get('_id')} Status={record1.get('validation_status')}")
    else: print("  -> Bulunamadı.")

    print("\n'Bekleyen' atlanarak getirme (eski doğrulanmış olmalı):")
    record2 = get_record_for_validation(skip_ids=[test_doc_id_pending])
    if record2: print(f"  -> Bulundu: ID={record2.get('_id')} Status={record2.get('validation_status')}")
    else: print("  -> Bulunamadı.")

    # Hatalı işaretlenen kaydın durumunu simüle edelim
    MOCK_DB_BILGI[test_doc_id_pending]['validation_status'] = 'hatali'
    MOCK_DB_BILGI[test_doc_id_validated]['validation_status'] = 'dogrulandi' # Tekrar doğrulanmış yapalım
    MOCK_DB_BILGI[test_doc_id_validated]['last_validated_ts'] = datetime.datetime(2023, 1, 1)

    print("\nSadece eski doğrulanmış varken getirme:")
    record3 = get_record_for_validation()
    if record3: print(f"  -> Bulundu: ID={record3.get('_id')} Status={record3.get('validation_status')}")
    else: print("  -> Bulunamadı.")

    print("\n--- Feedback Manager Testi Tamamlandı ---")