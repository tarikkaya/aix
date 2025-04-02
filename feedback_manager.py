# feedback_manager.py

import datetime
import traceback  # Hata ayıklama

try:
    import config
    import database
    from bson.objectid import ObjectId  # String ID <-> ObjectId dönüşümü için
    from pymongo import ASCENDING, DESCENDING  # Sıralama yönleri için
    MODULES_AVAILABLE = True
except ImportError as e:
    print(f"[HATA] feedback_manager: Gerekli modüller yüklenemedi: {e}")
    MODULES_AVAILABLE = False
    config = None; database = None; ObjectId = None; ASCENDING = 1; DESCENDING = -1
except AttributeError as e:
    print(f"[HATA] feedback_manager: config dosyasında beklenen bir ayar bulunamadı: {e}")
    MODULES_AVAILABLE = False


# Geri bildirim türlerini standart durumlara çeviren harita (küçük harfe çevirilip boşlukları alınır)
FEEDBACK_TO_STATUS_MAP = {
    "doğru": "dogrulandi",
    "evet": "dogrulandi",        # 'E' tuşu için
    "onaylandı": "dogrulandi",
    "düzeltilmiş": "dogrulandi",  # Düzeltme sonrası genellikle doğrulanmış kabul edilir
    "hatalı": "hatali",
    "hayır": "hatali",           # 'H' tuşu için
    "yanlış": "hatali",
    "hatalı ama yaklaşmış": "hatali",  # Daha detaylı bir statü eklenebilir
    "silinen": "kullanilmiyor",   # Kullanım dışı bırakmak için
    "sil": "kullanilmiyor",       # 'S' tuşu için
    "anlamsız": "kullanilmiyor",  # Anlamsız olarak işaretlenenler
    "atla": None,                # 'A' tuşu durumu değiştirmez
}


def log_and_update_feedback(doc_id, feedback_type, session_id, comment=None, corrected_text=None):
    """
    Kullanıcı geri bildirimini loglar ve ilgili bilgi parçasının
    doğrulama durumunu günceller.

    Args:
        doc_id (str or ObjectId): Geri bildirim verilen belgenin ID'si.
        feedback_type (str): Kullanıcının verdiği geri bildirim ('doğru', 'hatalı' vb.).
        session_id (str): Geri bildirimin yapıldığı oturumun ID'si.
        comment (str, optional): Kullanıcının ek yorumu.
        corrected_text (str, optional): Önerilen doğru metin.

    Returns:
        bool: İşlem başarılıysa True, aksi halde False.
    """
    if not MODULES_AVAILABLE or not database or not ObjectId:
        print("[HATA] Feedback Manager başlatılamadı (modül/ObjectId eksik).")
        return False

    processed_doc_id = None
    if doc_id:
        try:
            processed_doc_id = ObjectId(doc_id)
        except Exception:
            print(f"[Uyarı] Feedback Manager: Geçersiz belge ID formatı: {doc_id}.")

    feedback_type_lower = str(feedback_type).lower().strip() if feedback_type else ""

    # 1. Geri bildirimi logla
    feedback_doc = {
        "document_id": processed_doc_id,
        "feedback_type": feedback_type_lower,
        "session_id": str(session_id) if session_id else None,
        "timestamp": datetime.datetime.now(datetime.timezone.utc),
        "comment": str(comment).strip() if comment else None,
        "corrected_text": str(corrected_text).strip() if corrected_text else None
    }
    feedback_log_id = database.add_feedback(feedback_doc)
    if not feedback_log_id:
        print(f"[HATA] Geri bildirim logu kaydedilemedi (Belge ID: {doc_id}).")
        return False

    # 2. Bilgi parçasının durumunu güncelle
    new_status = FEEDBACK_TO_STATUS_MAP.get(feedback_type_lower)
    update_success = False
    if new_status and processed_doc_id:
        update_success = database.update_bilgi_validation(processed_doc_id, new_status, str(session_id))
        if not update_success:
            print(f"[Uyarı] Geri bildirim loglandı (ID: {feedback_log_id}) ancak belge durumu güncellenemedi (ID: {doc_id}).")

    # 3. Adaptasyon mantığı (gelecekte burada tetiklenebilir)
    # trigger_adaptation(processed_doc_id, feedback_type_lower)

    return True


def get_record_for_validation(skip_ids=None):
    """
    Kullanıcının doğrulaması için uygun bir kayıt bulur.
    Strateji: Önce 'bekliyor', sonra 'en_eski_dogrulanmis'.

    Args:
        skip_ids (list of str): Atlanacak belge ID'leri.

    Returns:
        dict or None: Doğrulanacak belge veya None.
    """
    if not MODULES_AVAILABLE or not database or not ObjectId:
        print("[HATA] Feedback Manager başlatılamadı. Kayıt getirilemiyor.")
        return None

    processed_skip_ids = []
    if skip_ids and isinstance(skip_ids, list):
        for sid in skip_ids:
            try:
                processed_skip_ids.append(ObjectId(sid))
            except Exception:
                pass

    strategy = getattr(config, 'VALIDATION_STRATEGY', 'bekliyor_sonra_en_eski')
    record_to_return = None

    try:
        if 'bekliyor' in strategy:
            query_filter_pending = {"validation_status": "bekliyor"}
            if processed_skip_ids:
                query_filter_pending["_id"] = {"$nin": processed_skip_ids}
            pending_records = database.find_documents('COLLECTION_BILGI', query_filter_pending, limit=1)
            if pending_records:
                record_to_return = pending_records[0]

        if record_to_return is None and 'en_eski_dogrulanmis' in strategy:
            query_filter_oldest = {"validation_status": "dogrulandi"}
            if processed_skip_ids:
                query_filter_oldest["_id"] = {"$nin": processed_skip_ids}
            oldest_validated = database.find_documents(
                'COLLECTION_BILGI',
                query_filter_oldest,
                sort_by=[("last_validated_ts", ASCENDING)],
                limit=1
            )
            if oldest_validated:
                record_to_return = oldest_validated[0]

        return record_to_return

    except Exception as e:
        print(f"[HATA] Doğrulama için kayıt aranırken hata: {e}")
        traceback.print_exc(limit=1)
        return None


# --- Doğrudan Çalıştırma Testleri ---
if __name__ == "__main__":
    print("--- Feedback Manager Testi Başladı ---")
    print("    UYARI: Bu test, sahte (mock) DB ve ObjectId kullanır.")

    # Sahte modüller
    if not MODULES_AVAILABLE:
        print("Sahte DB ve ObjectId modülleri oluşturuluyor...")
        class MockObjectId:
            _instance_counter = 0
            def __init__(self, id_str=None):
                if id_str:
                    self.id_str = str(id_str)
                else:
                    MockObjectId._instance_counter += 1
                    self.id_str = f"mock_oid_{MockObjectId._instance_counter}"
            def __str__(self): return self.id_str
            def __repr__(self): return f"MockObjectId('{self.id_str}')"
            def __eq__(self, other): return isinstance(other, MockObjectId) and self.id_str == other.id_str
            def __hash__(self): return hash(self.id_str)
        ObjectId = MockObjectId
        MODULES_AVAILABLE = True

        MOCK_DB_FEEDBACK_LOG_FM_MAIN = []
        MOCK_DB_BILGI_STORE_FM_MAIN = {
            "bekleyen_id_1": {"_id": ObjectId("bekleyen_id_1"), "metin": "Bekleyen Test FM 1", "validation_status": "bekliyor"},
            "dogru_eski_id_1": {"_id": ObjectId("dogru_eski_id_1"), "metin": "Doğrulanmış Eski FM 1", "validation_status": "dogrulandi", "last_validated_ts": datetime.datetime(2023, 11, 15)},
            "dogru_yeni_id_1": {"_id": ObjectId("dogru_yeni_id_1"), "metin": "Doğrulanmış Yeni FM 1", "validation_status": "dogrulandi", "last_validated_ts": datetime.datetime(2024, 3, 10)}
        }
        class MockDatabaseModuleFMMain:
            def add_feedback(self, doc):
                fb_id = ObjectId()
                doc['_id'] = fb_id
                MOCK_DB_FEEDBACK_LOG_FM_MAIN.append(doc)
                print(f"    -> [Sahte DB] add_feedback: Tip={doc.get('feedback_type')}, DocID={doc.get('document_id')}")
                return fb_id
            def update_bilgi_validation(self, doc_id_obj, status, sid):
                str_id = str(doc_id_obj)
                print(f"    -> [Sahte DB] update_bilgi_validation: ID={str_id}, Status={status}")
                if str_id in MOCK_DB_BILGI_STORE_FM_MAIN:
                    MOCK_DB_BILGI_STORE_FM_MAIN[str_id]['validation_status'] = status
                    MOCK_DB_BILGI_STORE_FM_MAIN[str_id]['last_validated_ts'] = datetime.datetime.now(datetime.timezone.utc)
                    return True
                return False
            def find_documents(self, coll_key, query, projection=None, sort_by=None, limit=0):
                results = []
                if coll_key == getattr(config, 'COLLECTION_BILGI', 'bilgi_parcaciklari'):
                    status_filter = query.get("validation_status")
                    nin_filter_obj = query.get("_id", {}).get("$nin", [])
                    candidates = []
                    for doc_id_str, doc_data in MOCK_DB_BILGI_STORE_FM_MAIN.items():
                        doc_id_obj = ObjectId(doc_id_str)
                        if doc_id_obj in nin_filter_obj:
                            continue
                        if status_filter and doc_data.get("validation_status") != status_filter:
                            continue
                        data_with_id = doc_data.copy()
                        data_with_id['_id'] = doc_id_obj
                        candidates.append(data_with_id)
                    if sort_by and sort_by[0][0] == "last_validated_ts" and sort_by[0][1] == ASCENDING:
                        candidates.sort(key=lambda x: x.get("last_validated_ts", datetime.datetime.max))
                    results = candidates
                return results[:limit] if limit > 0 else results

        database = MockDatabaseModuleFMMain()
        config = type('obj', (object,), {
            'COLLECTION_GERIBILDIRIM': "geri_bildirimler",
            'COLLECTION_BILGI': "bilgi_parcaciklari",
            'VALIDATION_STRATEGY': 'bekliyor_sonra_en_eski'
        })()

    test_doc_pending_str = "bekleyen_id_1"
    test_doc_valid1_str = "dogru_eski_id_1"
    test_doc_valid2_str = "dogru_yeni_id_1"
    test_session_id = "test-feedback-main-001"

    print("\nGeri bildirim loglama ve güncelleme testi:")
    log_and_update_feedback(test_doc_pending_str, "evet", test_session_id)   # bekliyor -> dogrulandi
    log_and_update_feedback(test_doc_valid1_str, "hatalı", test_session_id)  # dogrulandi -> hatali
    log_and_update_feedback(test_doc_valid2_str, "sil", test_session_id)     # dogrulandi -> kullanilmiyor

    print("\nVeritabanı Durumu (Simülasyon Sonrası):")
    if 'MOCK_DB_BILGI_STORE_FM_MAIN' in locals():
        for k, v in MOCK_DB_BILGI_STORE_FM_MAIN.items():
            print(f"  ID: {k}, Durum: {v.get('validation_status')}")

    print("\nDoğrulama için kayıt getirme testi:")
    print("1. Getirme (Bekleyen yok, 'dogru_eski_id_1' 'hatali' ise sonuç None olmalı):")
    record1 = get_record_for_validation()
    if record1:
        print(f"  -> Bulundu: ID={record1.get('_id')}")
    else:
        print("  -> Uygun kayıt bulunamadı (Beklenen).")

    MOCK_DB_BILGI_STORE_FM_MAIN[test_doc_pending_str]["validation_status"] = 'bekliyor'
    MOCK_DB_BILGI_STORE_FM_MAIN[test_doc_valid1_str]["validation_status"] = 'dogrulandi'
    MOCK_DB_BILGI_STORE_FM_MAIN[test_doc_valid1_str]["last_validated_ts"] = datetime.datetime(2023, 1, 1)
    MOCK_DB_BILGI_STORE_FM_MAIN[test_doc_valid2_str]["validation_status"] = 'dogrulandi'
    MOCK_DB_BILGI_STORE_FM_MAIN[test_doc_valid2_str]["last_validated_ts"] = datetime.datetime(2024, 1, 1)

    print("\n2. Getirme (bekleyen var):")
    record2 = get_record_for_validation()
    if record2:
        print(f"  -> Bulundu: ID={record2.get('_id')}, Durum: {record2.get('validation_status')}")
    else:
        print("  -> Bulunamadı.")

    print("\n3. 'bekleyen_id_1' atlanarak getirme (en eski doğrulanmış 'dogru_eski_id_1' gelmeli):")
    record3 = get_record_for_validation(skip_ids=[test_doc_pending_str])
    if record3:
        print(f"  -> Bulundu: ID={record3.get('_id')}, Durum: {record3.get('validation_status')}")
    else:
        print("  -> Bulunamadı.")

    print("\n--- Feedback Manager Testi Tamamlandı ---")
