# database.py

from pymongo import MongoClient, ASCENDING, DESCENDING, TEXT
from pymongo.errors import ConnectionFailure, OperationFailure, ConfigurationError
from bson.objectid import ObjectId # String ID'leri ObjectId'ye çevirmek için
import datetime
import time

# Yapılandırmayı config dosyasından al
try:
    import config
except ImportError:
    print("[HATA] database: 'config.py' dosyası bulunamadı.")
    # Acil durum için minimum yapılandırma
    config = type('obj', (object,), {
        'MONGO_URI': "mongodb://localhost:27017/",
        'DB_NAME': "dinamik_bilgi_modeli",
        'COLLECTION_BILGI': "bilgi_parcaciklari",
        'COLLECTION_SOHBET': "sohbet_gecmisi",
        'COLLECTION_GERIBILDIRIM': "geri_bildirimler",
        'COLLECTION_DIL_KURALLARI': "dil_kurallari",
        'VECTOR_DIMENSION': 768 # Geçerli bir varsayılan
    })()
    print("[UYARI] database: Varsayılan DB/Koleksiyon adları kullanılacak.")

# --- Bağlantı Yönetimi ---
# Bağlantıyı modül seviyesinde tutup tekrar tekrar kurmaktan kaçınalım
_db_client = None
_db_instance = None
_last_ping_time = 0
PING_INTERVAL = 60 # Saniyede bir ping atarak bağlantıyı kontrol et

def get_db_connection():
    """ Singleton benzeri bir yapıyla mevcut DB bağlantısını döndürür veya yenisini kurar. """
    global _db_client, _db_instance, _last_ping_time
    current_time = time.time()

    # Eğer bağlantı varsa ve son ping üzerinden belirli bir süre geçtiyse tekrar ping at
    if _db_instance and (current_time - _last_ping_time > PING_INTERVAL):
        try:
             _db_client.admin.command('ping')
             _last_ping_time = current_time # Ping başarılı, zamanı güncelle
             # print("[Debug DB] Ping başarılı.") # Debug
             return _db_instance
        except (ConnectionFailure, Exception) as e:
             print(f"[Uyarı] DB Bağlantısı kontrolü başarısız: {e}. Yeniden bağlanılacak...")
             _db_client = None # Bağlantı koptuysa sıfırla
             _db_instance = None

    # Bağlantı yoksa veya kopmuşsa yeniden kur
    if not _db_client:
        try:
            # print(f"[Database] MongoDB'ye bağlanılıyor: {config.MONGO_URI}") # Çok sık loglamamak için kapalı
            _db_client = MongoClient(config.MONGO_URI,
                                     serverSelectionTimeoutMS=5000, # Bağlantı zaman aşımı
                                     connectTimeoutMS=5000,        # Bağlantı zaman aşımı
                                     socketTimeoutMS=10000)       # İşlem zaman aşımı
            # Bağlantıyı doğrula
            _db_client.admin.command('ping')
            _db_instance = _db_client[config.DB_NAME]
            _last_ping_time = time.time() # Başarılı bağlantı zamanı
            print(f"[Database] '{config.DB_NAME}' veritabanına başarıyla bağlanıldı (veya bağlantı tazelendi).")
        except ConnectionFailure as e:
            print(f"[HATA] MongoDB sunucusuna ({config.MONGO_URI}) bağlanılamadı: {e}")
            _db_client = None
            _db_instance = None
            return None
        except ConfigurationError as e:
            print(f"[HATA] MongoDB yapılandırma hatası (örn: SRV kaydı?): {e}")
            _db_client = None
            _db_instance = None
            return None
        except Exception as e:
            print(f"[HATA] Veritabanı bağlantısında beklenmedik hata: {e}")
            _db_client = None
            _db_instance = None
            return None

    return _db_instance

def close_db_connection():
    """ Açık olan MongoDB bağlantısını kapatır (Uygulama kapanırken çağrılabilir). """
    global _db_client, _db_instance
    if _db_client:
        try:
            _db_client.close()
            print("[Database] MongoDB bağlantısı kapatıldı.")
        except Exception as e:
            print(f"[HATA] MongoDB bağlantısı kapatılırken hata: {e}")
        finally:
             _db_client = None
             _db_instance = None

# --- Genel Veri Ekleme ---
def add_document(collection_name, document):
    """ Belirtilen koleksiyona tek bir doküman ekler. """
    db = get_db_connection()
    if not db: return None
    try:
        # Zaman damgası gibi otomatik alanlar eklenebilir
        if 'eklenme_zamani' not in document:
             document['eklenme_zamani'] = datetime.datetime.now(datetime.timezone.utc)
        result = db[collection_name].insert_one(document)
        return result.inserted_id
    except Exception as e:
        print(f"[HATA] '{collection_name}' koleksiyonuna belge eklenirken hata: {e}")
        return None

# --- Özel Veri Ekleme/Güncelleme Fonksiyonları ---
def add_bilgi(bilgi_document):
    """ bilgi_parcaciklari koleksiyonuna ekler. """
    return add_document(config.COLLECTION_BILGI, bilgi_document)

def add_sohbet_entry(sohbet_document):
    """ sohbet_gecmisi koleksiyonuna ekler. """
    # Oturum ID ve timestamp olmalı
    if 'session_id' not in sohbet_document or 'timestamp' not in sohbet_document:
        print("[Uyarı] Sohbet kaydında session_id veya timestamp eksik.")
        # Eksikse ekleyebiliriz ama mantık diğer modülde olmalı
    return add_document(config.COLLECTION_SOHBET, sohbet_document)

def add_feedback(feedback_document):
    """ geri_bildirimler koleksiyonuna ekler. """
    return add_document(config.COLLECTION_GERIBILDIRIM, feedback_document)

def update_bilgi_validation(doc_id_str, new_status, session_id):
    """ Belirtilen ID'li bilginin doğrulama durumunu vb. günceller. """
    db = get_db_connection()
    if not db: return False
    try:
        doc_id = ObjectId(doc_id_str)
        update_data = {
            "$set": {
                "validation_status": new_status,
                "last_validated_ts": datetime.datetime.now(datetime.timezone.utc),
                "validated_by_session": session_id
            }
        }
        result = db[config.COLLECTION_BILGI].update_one({"_id": doc_id}, update_data)
        if result.matched_count == 0:
             print(f"[Uyarı] ID ile belge bulunamadı, güncelleme yapılmadı: {doc_id_str}")
             return False
        # print(f"[DB] Belge {doc_id_str} durumu güncellendi: {new_status}") # Debug
        return result.modified_count > 0 or result.matched_count > 0 # Eşleştiyse ama değişmediyse de True dönebiliriz
    except Exception as e:
        print(f"[HATA] Bilgi doğrulama durumu güncellenirken hata (ID: {doc_id_str}): {e}")
        return False

# --- Veri Okuma / Arama Fonksiyonları ---

def get_language_rules():
    """ Dil kurallarını veritabanından önceliğe göre sıralı alır. """
    db = get_db_connection()
    if not db: return []
    try:
        rules = list(db[config.COLLECTION_DIL_KURALLARI].find().sort("priority", DESCENDING))
        return rules
    except Exception as e:
        print(f"[HATA] Dil kuralları okunurken hata: {e}")
        return []

def get_recent_sohbet(session_id, limit):
    """ Belirli bir oturumun son konuşmalarını zaman damgasına göre alır. """
    db = get_db_connection()
    if not db: return []
    try:
        # Zaman damgasına göre en yeni limit kadarını al
        history = list(db[config.COLLECTION_SOHBET].find(
            {"session_id": session_id}
        ).sort("timestamp", DESCENDING).limit(limit))
        # Sonuçlar en yeniden en eskiye doğrudur, kullanacak olan yer bunu bilmeli
        # Veya burada ters çevirebiliriz: return history[::-1]
        return history
    except Exception as e:
        print(f"[HATA] Sohbet geçmişi okunurken hata (Session: {session_id}): {e}")
        return []

def find_bilgi_by_id(doc_id_str):
    """ Verilen ID'ye sahip bilgi parçasını bulur. """
    db = get_db_connection()
    if not db: return None
    try:
        doc_id = ObjectId(doc_id_str)
        return db[config.COLLECTION_BILGI].find_one({"_id": doc_id})
    except Exception as e:
        print(f"[HATA] ID ile bilgi aranırken hata (ID: {doc_id_str}): {e}")
        return None

def text_search_bilgi(search_term, filter_criteria=None, limit=5):
    """ Bilgi koleksiyonunda metin araması yapar (Text Index gerekli). """
    db = get_db_connection()
    if not db: return []
    try:
        query_filter = {"$text": {"$search": search_term}}
        if filter_criteria and isinstance(filter_criteria, dict):
            query_filter.update(filter_criteria) # Ek filtreleri ekle

        results = list(db[config.COLLECTION_BILGI].find(
            query_filter,
            {'score': {'$meta': 'textScore'}}
        ).sort([('score', {'$meta': 'textScore'})]).limit(limit))
        return results
    except OperationFailure as op_fail:
         print(f"[HATA] Metin araması başarısız (Text index kurulu ve doğru mu?): {op_fail}")
         return []
    except Exception as e:
        print(f"[HATA] Metin araması sırasında hata ('{search_term}'): {e}")
        return []

def vector_search_bilgi(query_vector, top_n=5, filter_criteria=None):
    """
    Verilen sorgu vektörüne en yakın bilgi parçacıklarını bulur.
    MongoDB Atlas Vector Search veya uyumlu ortam gerektirir.
    Bu fonksiyon sadece bir örnektir, gerçek implementasyon değişebilir.
    """
    db = get_db_connection()
    if not db: return []
    if not query_vector or not isinstance(query_vector, list):
        print("[Uyarı] Geçersiz sorgu vektörü sağlandı.")
        return []

    # Atlas Vector Search $vectorSearch (veya $search) aggregasyonu örneği
    # Gerçek indeks adı ve alan adları config'den veya parametre olarak alınmalı
    vector_index_name = "vector_index" # Atlas'ta tanımlanan indeksin adı
    vector_field_name = "vektor"       # Vektörün saklandığı alan
    num_candidates = top_n * 10        # Performans için yaklaşık arama adayı sayısı

    pipeline = [
        {
            '$vectorSearch': {
                'index': vector_index_name,
                'queryVector': query_vector,
                'path': vector_field_name,
                'numCandidates': num_candidates,
                'limit': top_n
            }
            # Atlas Search için filter operatörü buraya eklenebilir:
            # 'filter': filter_criteria if filter_criteria else {}
        },
        # Yüksek skorlu olanları ve sadece gerekli alanları al
        {
            '$project': {
                '_id': 1,
                'metin': 1,
                'tur': 1,
                'anahtar_kelimeler': 1, # Belki lazım olur
                'validation_status': 1,
                'score': { '$meta': 'vectorSearchScore' }
            }
        }
    ]
    # Eğer filter_criteria varsa ve $vectorSearch içinde desteklenmiyorsa (eski sürümler?),
    # $vectorSearch'ten sonra bir $match aşaması eklenebilir, ancak daha az verimli olur.
    # if filter_criteria:
    #    pipeline.insert(1, {'$match': filter_criteria})


    try:
        results = list(db[config.COLLECTION_BILGI].aggregate(pipeline))
        return results
    except OperationFailure as op_fail:
        print(f"[HATA] Vektör araması operasyon hatası (Atlas Vector Search/İndeks ('{vector_index_name}') doğru yapılandırılmış mı?): {op_fail}")
        return []
    except Exception as e:
        print(f"[HATA] Vektör araması sırasında beklenmedik hata: {e}")
        return []

# --- Doğrudan Çalıştırma Testleri ---
if __name__ == "__main__":
    print("--- Database Modül Testi Başladı ---")
    db_conn = get_db_connection()
    if db_conn:
        print("\nDil Kuralları Test:")
        rules = get_language_rules()
        print(f"  -> Bulunan kural sayısı: {len(rules)}")
        if rules: print(f"  -> İlk kural: {rules[0]}")

        print("\nBağlantı Kapatma Testi:")
        close_db_connection()
        # Tekrar bağlantı testi
        print("Tekrar bağlanılıyor...")
        db_conn_2 = get_db_connection()
        if db_conn_2:
            print("Tekrar bağlantı başarılı.")
            close_db_connection()
        else:
            print("Tekrar bağlanılamadı.")

    else:
        print("Veritabanına bağlanılamadığı için testler yapılamadı.")

    print("\n--- Database Modül Testi Tamamlandı ---")