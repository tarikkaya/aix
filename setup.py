# setup.py

import sys
import subprocess
import importlib.util
import time
import re # Paket adı ayıklama için
import traceback # Hata loglama

# pymongo importları setup_database fonksiyonu içinde yapılacak

# Yapılandırma dosyasını import etmeyi ve kontrol etmeyi dene
try:
    import config
    print("[Setup] 'config.py' başarıyla yüklendi.")
    required_configs_for_setup = [
        'MONGO_URI', 'DB_NAME', 'REQUIRED_PACKAGES', 'DEFAULT_LANGUAGE_RULES',
        'COLLECTION_BILGI', 'COLLECTION_SOHBET', 'COLLECTION_GERIBILDIRIM',
        'COLLECTION_DIL_KURALLARI', 'VECTOR_DIMENSION',
        'COLLECTION_KURAL_KUMELERI', 'COLLECTION_HIPOTEZ_SABLONLARI',
        'COLLECTION_YANIT_SABLONLARI'
    ]
    missing_configs = [cfg for cfg in required_configs_for_setup if not hasattr(config, cfg)]
    if missing_configs:
        raise AttributeError(f"config.py dosyasında şu temel ayarlar eksik: {', '.join(missing_configs)}")
except ImportError:
    print("[HATA] setup.py: 'config.py' dosyası bulunamadı veya içe aktarılamadı.")
    sys.exit(1)
except AttributeError as e:
    print(f"[HATA] setup.py: {e}")
    sys.exit(1)
except Exception as e:
    print(f"[HATA] setup.py: config.py yüklenirken beklenmedik hata: {e}")
    sys.exit(1)


def check_and_install_dependencies():
    """ Gerekli Python paketlerini kontrol eder ve eksikse pip ile yükler. """
    print("\n--- Bağımlılık Kontrolü Başlatılıyor ---")
    all_installed_initially = True
    packages_to_install = []

    required_packages = getattr(config, 'REQUIRED_PACKAGES', [])
    if not required_packages or not isinstance(required_packages, list):
         print("[Uyarı] config.py'de geçerli REQUIRED_PACKAGES listesi bulunamadı.")
         return True

    for package_spec in required_packages:
        # Jinja2 gibi isimlerde büyük/küçük harf farkı olabilir, import adını kullan
        package_name_match = re.match(r'^([^=<>\[]+)', str(package_spec))
        if not package_name_match: continue
        package_name = package_name_match.group(1).strip()
        import_name = package_name.lower().replace('-', '_') # pip adı vs import adı

        try:
            # Bazı paketlerin import adı farklı olabilir (örn: sentence-transformers -> sentence_transformers)
            if import_name == 'sentence_transformers': import_name = 'sentence_transformers'
            elif import_name == 'jinja2': import_name = 'jinja2'
            # Diğer özel durumlar buraya eklenebilir

            spec = importlib.util.find_spec(import_name)
            if spec is None:
                packages_to_install.append(package_spec)
                all_installed_initially = False
        except ModuleNotFoundError:
                packages_to_install.append(package_spec)
                all_installed_initially = False
        except Exception as e:
             print(f"[HATA] '{package_name}' kontrol edilirken hata: {e}")
             packages_to_install.append(package_spec)
             all_installed_initially = False

    installation_successful = True
    if packages_to_install:
        print(f"\n{len(packages_to_install)} adet eksik paket bulundu ve kurulacak/güncellenecek...")
        for package_spec in packages_to_install:
            print(f" -> Yükleniyor: {package_spec}...")
            try:
                subprocess.check_call([sys.executable, '-m', 'pip', 'install', '--no-cache-dir', '--upgrade', package_spec])
                print(f"    '{package_spec}' başarıyla yüklendi/güncellendi.")
                time.sleep(0.5)
            except subprocess.CalledProcessError as e:
                print(f"[HATA] '{package_spec}' yüklenirken pip hatası: {e}")
                installation_successful = False; break
            except Exception as e:
                print(f"[HATA] Beklenmedik hata ('{package_spec}' yüklenirken): {e}")
                installation_successful = False; break
        if installation_successful: print("Eksik paketlerin yüklenmesi tamamlandı.")
        else: print("Paket yükleme işlemi başarısız oldu.")
    elif all_installed_initially:
        print("Tüm temel bağımlılıklar kurulu görünüyor.")

    # Opsiyonel: spaCy modeli indirme
    # spacy_download_cmd = getattr(config, 'SPACY_MODEL_DOWNLOAD_COMMAND', None)
    # if installation_successful and spacy_download_cmd:
    #     try:
    #         print(f"\nSpaCy modeli indiriliyor/kontrol ediliyor: {spacy_download_cmd}...")
    #         subprocess.check_call(spacy_download_cmd.split())
    #         print("SpaCy modeli başarıyla indirildi/kontrol edildi.")
    #     except Exception as e:
    #         print(f"[HATA] SpaCy modeli indirilirken hata: {e}")
            # Kurulumu başarısız saymaya gerek yok, opsiyonel olabilir

    print("--- Bağımlılık Kontrolü Tamamlandı ---")
    return installation_successful

def setup_database():
    """ MongoDB veritabanını sıfırlar, koleksiyonları ve indeksleri oluşturur. """
    try:
         from pymongo import MongoClient, ASCENDING, DESCENDING, TEXT
         from pymongo.errors import ConnectionFailure, CollectionInvalid, OperationFailure, ConfigurationError
    except ImportError:
         print("\n[HATA] 'pymongo' kütüphanesi bulunamadı.")
         return False

    print("\n--- Veritabanı Kurulumu Başlatılıyor ---")
    client = None
    db_name = getattr(config, 'DB_NAME', None)
    mongo_uri = getattr(config, 'MONGO_URI', None)
    vector_dim = getattr(config, 'VECTOR_DIMENSION', None)

    if not db_name or not mongo_uri:
        print("[HATA] config.py'de DB_NAME veya MONGO_URI tanımlı değil.")
        return False

    try:
        print(f"MongoDB'ye bağlanılıyor: {mongo_uri}")
        client = MongoClient(mongo_uri, serverSelectionTimeoutMS=10000)
        client.admin.command('ping')
        print("MongoDB bağlantısı başarılı.")

        if db_name in client.list_database_names():
            print("*"*60)
            print(f"[DİKKAT!] '{db_name}' adında bir veritabanı zaten mevcut.")
            print("       Devam ederseniz, bu veritabanı ve TÜM İÇERİĞİ SİLİNECEKTİR!")
            print("*"*60)
            confirm = input(f"'{db_name}' veritabanını silip sıfırdan oluşturmak için büyük harflerle 'EVET' yazın: ")
            if confirm == 'EVET':
                print(f"'{db_name}' veritabanı siliniyor...")
                client.drop_database(db_name)
                print(f"'{db_name}' veritabanı başarıyla silindi.")
            else:
                print("Silme işlemi onaylanmadı. Veritabanı kurulumu iptal edildi.")
                if client: client.close();
                return False
        else:
            print(f"'{db_name}' veritabanı bulunamadı, yeni oluşturulacak.")

        db = client[db_name]
        print(f"'{db_name}' veritabanı seçildi/oluşturuldu.")

        # Gerekli Koleksiyonları Oluştur
        collections_to_create = filter(None, [
            getattr(config, name, None) for name in dir(config) if name.startswith('COLLECTION_')
        ])
        print("Koleksiyonlar oluşturuluyor/kontrol ediliyor...")
        created_collections = []
        for coll_name in collections_to_create:
            try:
                if coll_name not in db.list_collection_names():
                     db.create_collection(coll_name)
                     print(f"  -> '{coll_name}' koleksiyonu oluşturuldu.")
                else:
                     print(f"  -> '{coll_name}' koleksiyonu zaten mevcut.")
                created_collections.append(coll_name)
            except CollectionInvalid:
                 print(f"  -> '{coll_name}' koleksiyonu zaten mevcut (CollectionInvalid).")
                 created_collections.append(coll_name)
            except Exception as e:
                 print(f"[HATA] '{coll_name}' koleksiyonu oluşturulamadı/kontrol edilemedi: {e}")
                 raise

        # Varsayılan Dil Kurallarını Ekle
        coll_dil = getattr(config, 'COLLECTION_DIL_KURALLARI', None)
        if coll_dil and coll_dil in created_collections:
            # ... (öncekiyle aynı)
            try:
                if db[coll_dil].count_documents({}) == 0:
                    default_rules = getattr(config, 'DEFAULT_LANGUAGE_RULES', [])
                    if default_rules and isinstance(default_rules, list):
                         db[coll_dil].insert_many(default_rules)
                         print(f"  -> {len(default_rules)} adet varsayılan dil kuralı eklendi.")
            except Exception as e: print(f"[UYARI] Varsayılan dil kuralları eklenirken hata: {e}")


        # Varsayılan Yanıt Şablonlarını Ekle
        coll_tmpl = getattr(config, 'COLLECTION_YANIT_SABLONLARI', None)
        if coll_tmpl and coll_tmpl in created_collections:
             # ... (öncekiyle aynı)
             print(f"'{coll_tmpl}' için varsayılan yanıt şablonları kontrol ediliyor...")
             try:
                 if db[coll_tmpl].count_documents({}) == 0:
                     default_templates = getattr(config, 'DEFAULT_RESPONSE_TEMPLATES', [])
                     if default_templates and isinstance(default_templates, list):
                         db[coll_tmpl].insert_many(default_templates)
                         print(f"  -> {len(default_templates)} adet varsayılan yanıt şablonu eklendi.")
             except Exception as e: print(f"[UYARI] Varsayılan yanıt şablonları eklenirken hata: {e}")


        # Temel İndeksleri Oluştur
        print("Veritabanı indeksleri oluşturuluyor (arka planda)...")
        try:
            # Sohbet Geçmişi
            coll_sohbet = getattr(config, 'COLLECTION_SOHBET', None)
            if coll_sohbet and coll_sohbet in created_collections:
                db[coll_sohbet].create_index( [("session_id", ASCENDING), ("timestamp", DESCENDING)], background=True, name="session_time_idx" )
                # print(f"  -> '{coll_sohbet}' indeksleri tanımlandı.") # Daha az log

            # Bilgi Parçacıkları
            coll_bilgi = getattr(config, 'COLLECTION_BILGI', None)
            if coll_bilgi and coll_bilgi in created_collections:
                try: db[coll_bilgi].create_index( [("metin", TEXT), ("anahtar_kelimeler", TEXT)], default_language="turkish", background=True, name="text_search_idx" )
                except OperationFailure as opf: print(f"[UYARI] Text index oluşturulamadı ({coll_bilgi}): {opf}")
                db[coll_bilgi].create_index([("tur", ASCENDING)], background=True, name="type_idx", sparse=True)
                db[coll_bilgi].create_index([("validation_status", ASCENDING)], background=True, name="validation_idx")
                db[coll_bilgi].create_index([("eklenme_zamani", DESCENDING)], background=True, name="created_time_idx")
                db[coll_bilgi].create_index([("anahtar_kelimeler", ASCENDING)], background=True, name="keywords_idx", sparse=True)
                db[coll_bilgi].create_index([("kaynak", ASCENDING)], background=True, name="source_idx", sparse=True)
                # print(f"  -> '{coll_bilgi}' için temel/metin indeksleri tanımlandı.") # Daha az log
                print(f"     -> ÖNEMLİ: '{coll_bilgi}.vektor' alanı için manuel olarak vektör indeksi (Boyut: {vector_dim or '???'}) oluşturun!")

            # Dil Kuralları
            coll_dil_k = getattr(config, 'COLLECTION_DIL_KURALLARI', None)
            if coll_dil_k and coll_dil_k in created_collections:
                db[coll_dil_k].create_index([("priority", DESCENDING)], background=True, name="priority_idx")
                # print(f"  -> '{coll_dil_k}' indeksleri tanımlandı.") # Daha az log

            # Kural Kümeleri (Yapısal kurallar için indeksler eklenebilir)
            coll_kural_k = getattr(config, 'COLLECTION_KURAL_KUMELERI', None)
            if coll_kural_k and coll_kural_k in created_collections:
                 db[coll_kural_k].create_index([("kume_id", ASCENDING)], background=True, name="rule_set_id_idx", unique=True, sparse=True)
                 db[coll_kural_k].create_index([("anahtar_kelimeler", ASCENDING)], background=True, name="ruleset_keywords_idx", sparse=True)
                 db[coll_kural_k].create_index([("aktif", ASCENDING)], background=True, name="ruleset_active_idx", sparse=True) # Aktiflik kontrolü için
                 # print(f"  -> '{coll_kural_k}' indeksleri tanımlandı.") # Daha az log

            # Hipotez Şablonları (Tetikleyiciler için indeksler eklenebilir)
            coll_hipotez_s = getattr(config, 'COLLECTION_HIPOTEZ_SABLONLARI', None)
            if coll_hipotez_s and coll_hipotez_s in created_collections:
                 db[coll_hipotez_s].create_index([("sablon_id", ASCENDING)], background=True, name="template_id_idx", unique=True, sparse=True)
                 db[coll_hipotez_s].create_index([("anahtar_kelimeler", ASCENDING)], background=True, name="template_keywords_idx", sparse=True)
                 db[coll_hipotez_s].create_index([("tetikleyici_tur", ASCENDING)], background=True, name="template_trigger_idx", sparse=True) # Tetikleyici türü için
                 # print(f"  -> '{coll_hipotez_s}' indeksleri tanımlandı.") # Daha az log

            # Yanıt Şablonları
            coll_tmpl = getattr(config, 'COLLECTION_YANIT_SABLONLARI', None)
            if coll_tmpl and coll_tmpl in created_collections:
                 db[coll_tmpl].create_index([("uygun_turler", ASCENDING)], background=True, name="tmpl_type_idx")
                 db[coll_tmpl].create_index([("etiketler", ASCENDING)], background=True, name="tmpl_tags_idx", sparse=True)
                 db[coll_tmpl].create_index([("sablon_adi", ASCENDING)], background=True, name="tmpl_name_idx", sparse=True)
                 # print(f"  -> '{coll_tmpl}' indeksleri tanımlandı.") # Daha az log

            print("İndeks oluşturma komutları gönderildi (veya mevcutlar kontrol edildi).")

        except OperationFailure as op_fail:
             # ... (hata yönetimi öncekiyle aynı)
             if "index already exists" in str(op_fail).lower(): pass # Normal durum, loglamaya gerek yok
             elif "Command not found" in str(op_fail): print(f"[UYARI] İndeks komutu desteklenmiyor olabilir: {op_fail}")
             else: print(f"[HATA] İndeks operasyon hatası: {op_fail}")
        except Exception as e:
            print(f"[HATA] İndeks oluştururken beklenmedik hata: {e}")

        print("--- Veritabanı Kurulumu Tamamlandı ---")
        return True

    except (ConnectionFailure, ConfigurationError) as e:
        # ... (hata yönetimi öncekiyle aynı)
        print(f"[HATA] MongoDB bağlantı/yapılandırma hatası: {e}")
        return False
    except Exception as e:
        # ... (hata yönetimi öncekiyle aynı)
        print(f"[HATA] Veritabanı kurulumu sırasında genel hata: {e}")
        traceback.print_exc()
        return False
    finally:
        if client:
            client.close()

if __name__ == "__main__":
    # ... (Ana blok öncekiyle aynı)
    print("="*60)
    print(" Model Kurulum ve Veritabanı Hazırlık Script'i ")
    print("="*60)
    db_name_to_report = getattr(config, 'DB_NAME', 'DB_NAME_YOK') if config else 'DB_NAME_YOK'
    print(f" Bu script önce Python kütüphanelerini kurar, sonra '{db_name_to_report}' DB'sini SIFIRLAMAK için onay ister!")
    print("-"*60)

    dep_ok = check_and_install_dependencies()

    db_ok = False
    if dep_ok:
        db_ok = setup_database()

    print("\n" + "="*60)
    if dep_ok and db_ok:
        print(" Kurulum başarıyla tamamlandı.")
        print(" Artık 'python model.py' komutunu kullanabilirsiniz.")
        vector_dim_report = getattr(config, 'VECTOR_DIMENSION', '???') if config else '???'
        print(f" ÖNEMLİ: MongoDB üzerinde 'vektor' alanı için manuel olarak vektör arama indeksi (boyut: {vector_dim_report}) oluşturun!")
    else:
        print(" Kurulum BAŞARISIZ oldu veya iptal edildi.")
        if not dep_ok: print(" - Bağımlılıklar yüklenemedi.")
        if not db_ok: print(" - Veritabanı kurulumu tamamlanamadı veya iptal edildi.")
        print(" Lütfen yukarıdaki hata mesajlarını kontrol edin.")
    print("="*60)