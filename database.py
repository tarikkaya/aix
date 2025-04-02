# database.py

import datetime
import time
import traceback  # Hata ayıklama

# Gerekli kütüphaneleri ve yapılandırmayı import etmeyi dene
try:
    from pymongo import MongoClient, ASCENDING, DESCENDING, TEXT
    from pymongo.errors import ConnectionFailure, OperationFailure, ConfigurationError
    from bson.objectid import ObjectId  # String ID <-> ObjectId dönüşümü için
    import config
    # Temel config değerlerinin varlığını kontrol et
    required_db_configs = [
        'MONGO_URI', 'DB_NAME', 'COLLECTION_BILGI',
        'COLLECTION_SOHBET', 'COLLECTION_GERIBILDIRIM', 'COLLECTION_DIL_KURALLARI'
    ]
    missing_configs = [cfg for cfg in required_db_configs if not hasattr(config, cfg)]
    if missing_configs:
        raise AttributeError(f"config.py dosyasında şu ayarlar eksik: {', '.join(missing_configs)}")
    MODULES_AVAILABLE = True
except ImportError as e:
    print(f"[HATA] database: Gerekli modüller yüklenemedi (pymongo, bson?): {e}")
    MODULES_AVAILABLE = False
    config = None; MongoClient = None; ASCENDING = 1; DESCENDING = -1; TEXT = 'text'; ObjectId = None
    ConnectionFailure = Exception; OperationFailure = Exception; ConfigurationError = Exception
except AttributeError as e:
    print(f"[HATA] database: config dosyasında beklenen bir ayar bulunamadı: {e}")
    MODULES_AVAILABLE = False
    config = None
except Exception as e:
    print(f"[HATA] database: Başlangıçta beklenmedik hata: {e}")
    MODULES_AVAILABLE = False
    config = None


# --- Bağlantı Yönetimi (Singleton Benzeri) ---
_db_client = None     # MongoClient nesnesi
_db_instance = None   # Veritabanı nesnesi (db)
_last_ping_time = 0   # Son başarılı bağlantı kontrol zamanı
PING_INTERVAL = getattr(config, 'DB_PING_INTERVAL', 60) if config else 60


def get_db_connection():
    """
    Mevcut MongoDB veritabanı bağlantısını döndürür. Bağlantı yoksa veya
    kopmuşsa yeniden kurmayı dener. Başarısız olursa None döner.
    """
    global _db_client, _db_instance, _last_ping_time
    if not config:
        return None

    current_time = time.time()

    # Mevcut bağlantıyı periyodik olarak test et
    if _db_instance and (current_time - _last_ping_time > PING_INTERVAL):
        if _db_client:
            try:
                _db_client.admin.command('ping')
                _last_ping_time = current_time
                return _db_instance
            except (ConnectionFailure, Exception) as e:
                print(f"[Uyarı] DB Bağlantı kontrolü başarısız ({type(e).__name__}). Yeniden bağlanılacak...")
                close_db_connection()

    # Bağlantı yoksa yeniden kur
    if not _db_client:
        try:
            mongo_uri = getattr(config, 'MONGO_URI')
            db_name = getattr(config, 'DB_NAME')

            _db_client = MongoClient(
                mongo_uri,
                serverSelectionTimeoutMS=getattr(config, 'DB_SERVER_TIMEOUT', 5000),
                connectTimeoutMS=getattr(config, 'DB_CONNECT_TIMEOUT', 5000),
                socketTimeoutMS=getattr(config, 'DB_SOCKET_TIMEOUT', 10000),
                uuidRepresentation='standard'
            )
            _db_client.admin.command('ping')
            _db_instance = _db_client[db_name]
            _last_ping_time = time.time()
            print(f"[Database] '{db_name}' veritabanına başarıyla bağlanıldı.")
        except (ConnectionFailure, ConfigurationError) as e:
            print(f"[HATA] MongoDB sunucusuna ({mongo_uri}) bağlanılamadı/yapılandırılamadı: {e}")
            close_db_connection()
            return None
        except Exception as e:
            print(f"[HATA] Veritabanı bağlantısında beklenmedik hata: {e}")
            traceback.print_exc(limit=1)
            close_db_connection()
            return None

    return _db_instance


def close_db_connection():
    """ Açık olan MongoDB bağlantısını güvenli bir şekilde kapatır. """
    global _db_client, _db_instance
    if _db_client:
        try:
            _db_client.close()
        except Exception as e:
            print(f"[HATA] MongoDB bağlantısı kapatılırken hata: {e}")
        finally:
            _db_client = None
            _db_instance = None


def _get_collection(collection_config_key):
    """ Verilen config anahtarına karşılık gelen koleksiyon nesnesini döndürür. """
    db = get_db_connection()
    if not db:
        return None
    if not config or not hasattr(config, collection_config_key):
        print(f"[HATA] Config yüklenemedi veya koleksiyon anahtarı eksik: {collection_config_key}")
        return None
    coll_name = getattr(config, collection_config_key, None)
    if not coll_name or not isinstance(coll_name, str):
        print(f"[HATA] Config'de geçersiz veya eksik koleksiyon adı: {collection_config_key} -> {coll_name}")
        return None
    return db[coll_name]


def add_document(collection_config_key, document):
    """ Belirtilen koleksiyona tek doküman ekler, ObjectId döndürür. """
    collection = _get_collection(collection_config_key)
    if not collection or not isinstance(document, dict):
        return None
    try:
        document.setdefault('eklenme_zamani', datetime.datetime.now(datetime.timezone.utc))
        result = collection.insert_one(document)
        return result.inserted_id
    except Exception as e:
        print(f"[HATA] '{getattr(config, collection_config_key, '?')}' koleksiyonuna belge eklenirken: {e}")
        return None


def find_one_document(collection_config_key, query_filter, projection=None):
    """ Filtreye uyan ilk dokümanı bulur (veya None). """
    collection = _get_collection(collection_config_key)
    if not collection or not isinstance(query_filter, dict):
        return None
    try:
        return collection.find_one(query_filter, projection=projection)
    except Exception as e:
        print(f"[HATA] '{getattr(config, collection_config_key, '?')}' koleksiyonunda arama (find_one: {query_filter}): {e}")
        return None


def find_documents(collection_config_key, query_filter, projection=None, sort_by=None, limit=0):
    """ Filtreye uyan dokümanları listeler. """
    collection = _get_collection(collection_config_key)
    if not collection or not isinstance(query_filter, dict):
        return []
    try:
        cursor = collection.find(query_filter, projection=projection)
        if sort_by and isinstance(sort_by, list):
            cursor = cursor.sort(sort_by)
        if limit > 0 and isinstance(limit, int):
            cursor = cursor.limit(limit)
        return list(cursor)
    except Exception as e:
        print(f"[HATA] '{getattr(config, collection_config_key, '?')}' koleksiyonunda arama (find: {query_filter}): {e}")
        return []


def update_one_document(collection_config_key, query_filter, update_data, upsert=False):
    """ Filtreye uyan ilk dokümanı günceller (veya upsert yapar). """
    collection = _get_collection(collection_config_key)
    if not collection or not isinstance(query_filter, dict) or not isinstance(update_data, dict):
        return None
    try:
        if not any(k.startswith('$') for k in update_data.keys()):
            print(f"[Uyarı] Güncelleme verisi MongoDB operatörü içermiyor: {list(update_data.keys())}")
        result = collection.update_one(query_filter, update_data, upsert=upsert)
        return result
    except Exception as e:
        print(f"[HATA] '{getattr(config, collection_config_key, '?')}' koleksiyonunda güncelleme (filter: {query_filter}): {e}")
        return None


def delete_many_documents(collection_config_key, query_filter):
    """ Filtreye uyan tüm dokümanları siler. """
    collection = _get_collection(collection_config_key)
    if not collection or not isinstance(query_filter, dict):
        return None
    try:
        result = collection.delete_many(query_filter)
        return result
    except Exception as e:
        print(f"[HATA] '{getattr(config, collection_config_key, '?')}' koleksiyonunda silme (filter: {query_filter}): {e}")
        return None


# --- Uygulamaya Özel Sarmalayıcı Fonksiyonlar ---
def add_bilgi(bilgi_document):
    return add_document('COLLECTION_BILGI', bilgi_document)


def add_sohbet_entry(sohbet_document):
    return add_document('COLLECTION_SOHBET', sohbet_document)


def add_feedback(feedback_document):
    return add_document('COLLECTION_GERIBILDIRIM', feedback_document)


def update_bilgi_validation(doc_id, new_status, session_id):
    """
    Bilgi parçasının doğrulama durumunu günceller.
    """
    processed_id = None
    if isinstance(doc_id, ObjectId):
        processed_id = doc_id
    elif isinstance(doc_id, str):
        try:
            processed_id = ObjectId(doc_id)
        except Exception:
            pass
    if not processed_id:
        print(f"[HATA] Geçersiz Belge ID formatı (update_bilgi_validation): {doc_id}")
        return False

    query_filter = {"_id": processed_id}
    update_content = {
        "$set": {
            "validation_status": str(new_status) if new_status else "bekliyor",
            "last_validated_ts": datetime.datetime.now(datetime.timezone.utc),
            "validated_by_session": str(session_id) if session_id else None
        }
    }
    result = update_one_document('COLLECTION_BILGI', query_filter, update_content)
    return result is not None and result.acknowledged and result.matched_count > 0


def get_language_rules():
    """ Dil kurallarını önceliğe göre sıralı alır. """
    return find_documents('COLLECTION_DIL_KURALLARI', {}, sort_by=[("priority", DESCENDING)])


def get_recent_sohbet(session_id, limit):
    """ Belirli oturumun son N konuşmasını, en yeni önce alır. """
    if not isinstance(limit, int) or limit <= 0:
        limit = 1
    return find_documents(
        'COLLECTION_SOHBET',
        {"session_id": str(session_id) if session_id else None},
        sort_by=[("timestamp", DESCENDING)],
        limit=limit
    )


def find_bilgi_by_id(doc_id_str):
    """ String ID ile bilgi parçası arar. """
    try:
        doc_id = ObjectId(doc_id_str)
    except Exception:
        return None
    return find_one_document('COLLECTION_BILGI', {"_id": doc_id})


def text_search_bilgi(search_term, filter_criteria=None, limit=5):
    """ Bilgi koleksiyonunda metin araması yapar. """
    if not isinstance(search_term, str) or not search_term:
        return []
    if limit <= 0:
        limit = 5
    query_filter = {"$text": {"$search": search_term}}
    if filter_criteria and isinstance(filter_criteria, dict):
        query_filter.update(filter_criteria)
    projection = {'score': {'$meta': 'textScore'}}
    sort_order = [('score', {'$meta': 'textScore'})]
    try:
        return find_documents('COLLECTION_BILGI', query_filter, projection=projection, sort_by=sort_order, limit=limit)
    except OperationFailure as op_fail:
        print(f"[HATA] Metin araması (index?): {op_fail}")
        return []
    except Exception as e:
        print(f"[HATA] Metin araması ('{search_term}'): {e}")
        return []


def vector_search_bilgi(query_vector, top_n=5, filter_criteria=None):
    """
    Vektör araması yapar. (Atlas Vector Search veya uyumlu ortam/indeks gerekir.)
    BU FONKSİYON ORTAMA ÖZEL AYAR GEREKTİRİR!
    """
    db = get_db_connection()
    if not db:
        return []
    vector_dim = getattr(config, 'VECTOR_DIMENSION', -1)
    if not query_vector or not isinstance(query_vector, list) or (vector_dim > 0 and len(query_vector) != vector_dim):
        print("[Uyarı] Geçersiz sorgu vektörü.")
        return []
    if top_n <= 0:
        top_n = 5

    coll_bilgi = _get_collection('COLLECTION_BILGI')
    if not coll_bilgi:
        return []
    vector_index_name = "vector_index_default"
    vector_field_name = "vektor"
    num_candidates = top_n * 15

    pipeline = [
        {
            '$vectorSearch': {
                'index': vector_index_name,
                'queryVector': query_vector,
                'path': vector_field_name,
                'numCandidates': num_candidates,
                'limit': top_n,
                'filter': filter_criteria if filter_criteria else {}
            }
        },
        {
            '$project': {
                '_id': 1,
                'metin': 1,
                'tur': 1,
                'validation_status': 1,
                'kaynak': 1,
                'eklenme_zamani': 1,
                'last_validated_ts': 1,
                'score': {'$meta': 'vectorSearchScore'}
            }
        }
    ]

    try:
        return list(coll_bilgi.aggregate(pipeline))
    except OperationFailure as op_fail:
        print(f"[HATA] Vektör araması operasyon hatası! İndeks: '{vector_index_name}'. Atlas Vector Search yapılandırıldı mı?")
        print(f"       Hata: {op_fail}")
        return []
    except Exception as e:
        print(f"[HATA] Vektör araması sırasında: {e}")
        traceback.print_exc(limit=1)
        return []


# --- Adaptasyon İçin Gelecekteki Fonksiyonlar (Taslak) ---
# def find_rules(context): ...
# def find_templates(context): ...
# def update_priority_score(rule_or_template_id, feedback_score): ...


# --- Doğrudan Çalıştırma Testleri ---
if __name__ == "__main__":
    print("--- Database Modül Testi Başladı ---")
    if MODULES_AVAILABLE and config:
        db_conn = get_db_connection()
        if db_conn:
            print("\nDil Kuralları Test:")
            rules = get_language_rules()
            print(f"  -> Bulunan kural sayısı: {len(rules)}")
            if rules:
                print(f"  -> İlk kural: {rules[0]}")
            else:
                print("  -> Hiç dil kuralı bulunamadı veya DB hatası.")
            close_db_connection()
        else:
            print("Veritabanına bağlanılamadı.")
    else:
        print("Gerekli modüller (config?) yüklenemedi.")
    print("--- Database Modül Testi Tamamlandı ---")
