# setup.py

import sys
import subprocess
import importlib.util
import time
from pymongo import MongoClient, ASCENDING, DESCENDING, TEXT
from pymongo.errors import ConnectionFailure, CollectionInvalid, OperationFailure

# --- Yapılandırma ---
# Ayarları config.py dosyasından al (aynı dizinde olmalı)
try:
    import config
    print("[Setup] 'config.py' başarıyla yüklendi.")
except ImportError:
    print("[HATA] 'config.py' dosyası bulunamadı veya içe aktarılamadı.")
    print("       Lütfen MONGO_URI, DB_NAME, koleksiyon adları, REQUIRED_PACKAGES,")
    print("       DEFAULT_LANGUAGE_RULES gibi sabitleri içeren config.py dosyasını oluşturun.")
    sys.exit(1)
except AttributeError as e:
    print(f"[HATA] 'config.py' dosyasında eksik bir ayar var gibi görünüyor: {e}")
    print("       Lütfen gerekli tüm sabitlerin (MONGO_URI, DB_NAME vb.) tanımlı olduğundan emin olun.")
    sys.exit(1)


def check_and_install_dependencies():
    """ Gerekli Python paketlerini kontrol eder ve eksikse yükler. """
    print("\n--- Bağımlılık Kontrolü Başlatılıyor ---")
    all_installed = True
    packages_to_install = []

    # Önce kontrol et
    for package_spec in config.REQUIRED_PACKAGES:
        package_name = package_spec.split('[')[0].split('==')[0].split('<')[0].split('>')[0] # Sadece paket adını al
        try:
            spec = importlib.util.find_spec(package_name)
            if spec is None:
                print(f"[-] '{package_name}' (gereksinim: {package_spec}) paketi bulunamadı.")
                packages_to_install.append(package_spec)
                all_installed = False
            else:
                print(f"[+] '{package_name}' paketi zaten kurulu.")
        except Exception as e:
             print(f"[HATA] '{package_name}' kontrol edilirken hata: {e}")
             # Belki yine de yüklemeyi deneyebiliriz?
             packages_to_install.append(package_spec)
             all_installed = False

    # Eksik varsa yükle
    if not all_installed:
        print("\nEksik paketler yüklenecek...")
        for package_spec in packages_to_install:
            print(f" -> Yükleniyor: {package_spec}")
            try:
                # pip komutunu çalıştır
                # --no-cache-dir bazen yetki sorunlarını çözebilir
                subprocess.check_call([sys.executable, '-m', 'pip', 'install', '--no-cache-dir', package_spec])
                print(f"    '{package_spec}' başarıyla yüklendi.")
                # Kütüphanenin import edilebilir hale gelmesi için kısa bir bekleme
                time.sleep(1)
            except subprocess.CalledProcessError as e:
                print(f"[HATA] '{package_spec}' yüklenirken hata oluştu: {e}")
                print(f"       Lütfen manuel olarak yüklemeyi deneyin: pip install \"{package_spec}\"")
                sys.exit(1) # Kritik hata, devam etme
            except Exception as e:
                print(f"[HATA] Beklenmedik bir hata oluştu ('{package_spec}' yüklenirken): {e}")
                sys.exit(1) # Kritik hata, devam etme
        print("Eksik paketlerin yüklenmesi tamamlandı.")
    else:
        print("Tüm bağımlılıklar zaten kurulu.")

    print("--- Bağımlılık Kontrolü Tamamlandı ---")
    return True

def setup_database():
    """ MongoDB veritabanını sıfırlar, koleksiyonları ve indeksleri oluşturur. """
    print("\n--- Veritabanı Kurulumu Başlatılıyor ---")
    client = None
    try:
        print(f"MongoDB'ye bağlanılıyor: {config.MONGO_URI}")
        client = MongoClient(config.MONGO_URI, serverSelectionTimeoutMS=5000)
        # Bağlantıyı doğrula (server_info yerine ping daha güvenilir olabilir)
        client.admin.command('ping')
        print("MongoDB bağlantısı başarılı.")

        # Mevcut veritabanını sil (KULLANICI VERİSİ KAYBOLUR!)
        if config.DB_NAME in client.list_database_names():
            print(f"[UYARI] '{config.DB_NAME}' veritabanı mevcut. Tüm içeriğiyle SİLİNECEK!")
            # Kullanıcı onayı almak iyi olabilir, şimdilik otomatik silelim
            confirm = input("  -> Onaylıyor musunuz? (evet/hayır): ").lower()
            if confirm == 'evet':
                client.drop_database(config.DB_NAME)
                print(f"'{config.DB_NAME}' veritabanı başarıyla silindi.")
            else:
                print("Silme işlemi iptal edildi. Kurulum durduruldu.")
                return False # Devam etme
        else:
            print(f"'{config.DB_NAME}' veritabanı bulunamadı, yeni oluşturulacak.")

        # Veritabanını seç (yoksa otomatik oluşur)
        db = client[config.DB_NAME]
        print(f"'{config.DB_NAME}' veritabanı seçildi/oluşturuldu.")

        # Gerekli Koleksiyonları Oluştur
        collections_to_create = [
            config.COLLECTION_BILGI,
            config.COLLECTION_SOHBET,
            config.COLLECTION_GERIBILDIRIM,
            config.COLLECTION_DIL_KURALLARI
            # İleride eklenecek başka koleksiyonlar buraya eklenebilir
        ]
        print("Koleksiyonlar oluşturuluyor/kontrol ediliyor...")
        for coll_name in collections_to_create:
            try:
                # Koleksiyonu oluşturmayı dene
                db.create_collection(coll_name)
                print(f"  -> '{coll_name}' koleksiyonu oluşturuldu.")
            except CollectionInvalid:
                 # Zaten varsa sorun değil
                 print(f"  -> '{coll_name}' koleksiyonu zaten mevcut.")
            except Exception as e:
                 # Başka bir hata varsa kritik olabilir
                 print(f"[HATA] '{coll_name}' koleksiyonu oluşturulamadı: {e}")
                 raise # Hatayı yukarı taşı, kurulum başarısız olsun

        # Varsayılan Dil Kurallarını Ekle
        print("Varsayılan dil kuralları kontrol ediliyor/ekleniyor...")
        try:
            # Koleksiyonun boş olup olmadığını kontrol et
            if db[config.COLLECTION_DIL_KURALLARI].count_documents({}) == 0:
                if config.DEFAULT_LANGUAGE_RULES and isinstance(config.DEFAULT_LANGUAGE_RULES, list):
                     db[config.COLLECTION_DIL_KURALLARI].insert_many(config.DEFAULT_LANGUAGE_RULES)
                     print(f"  -> {len(config.DEFAULT_LANGUAGE_RULES)} adet varsayılan dil kuralı eklendi.")
                else:
                     print("  -> config.py'de varsayılan dil kuralı bulunamadı veya formatı yanlış.")
            else:
                 print("  -> Dil kuralları koleksiyonu zaten dolu, varsayılanlar eklenmedi.")
        except Exception as e:
            # Hata olsa bile devam edebiliriz ama uyarı verelim
            print(f"[UYARI] Varsayılan dil kuralları eklenirken hata: {e}")

        # Temel İndeksleri Oluştur
        print("Veritabanı indeksleri oluşturuluyor (arka planda)...")
        try:
            # Sohbet Geçmişi İndeksleri
            db[config.COLLECTION_SOHBET].create_index(
                [("session_id", ASCENDING), ("timestamp", DESCENDING)],
                background=True, name="session_time_idx"
            )
            print(f"  -> '{config.COLLECTION_SOHBET}' için indeksler tanımlandı.")

            # Bilgi Parçacıkları İndeksleri
            # Anahtar kelime/metin için Türkçe Text Index
            db[config.COLLECTION_BILGI].create_index(
                [("anahtar_kelimeler", TEXT), ("metin", TEXT)], # anahtar_kelimeler alanı eklenmeli
                default_language="turkish", background=True, name="text_search_idx"
            )
            # Diğer sık sorgulanacak alanlar için indeksler
            db[config.COLLECTION_BILGI].create_index([("tur", ASCENDING)], background=True, name="type_idx")
            db[config.COLLECTION_BILGI].create_index([("validation_status", ASCENDING)], background=True, name="validation_idx")
            print(f"  -> '{config.COLLECTION_BILGI}' için temel ve metin indeksleri tanımlandı.")
            print(f"     -> ÖNEMLİ: 'vektor' alanı için özel bir vektör indeksi gereklidir.")
            print(f"        Bu indeksin MongoDB Atlas arayüzünden veya uyumlu bir MongoDB")
            print(f"        sürümü için uygun komutlarla manuel olarak oluşturulması önerilir.")
            print(f"        (Kullanılacak embedding modelinin vektör boyutu bilinmelidir).")


            # Dil Kuralları İndeksi
            db[config.COLLECTION_DIL_KURALLARI].create_index([("priority", DESCENDING)], background=True, name="priority_idx")
            print(f"  -> '{config.COLLECTION_DIL_KURALLARI}' için indeksler tanımlandı.")

            print("İndeks oluşturma komutları gönderildi (tamamlanması zaman alabilir).")

        except OperationFailure as op_fail:
             # İndeks zaten varsa bu hata alınabilir, genellikle sorun değil
             if "index already exists" in str(op_fail).lower():
                 print("  -> Bazı indeksler zaten mevcut, tekrar oluşturulmadı.")
             elif "Command not found" in str(op_fail):
                  print(f"[UYARI] İndeks oluşturma komutu başarısız (MongoDB sürümü uyumsuz olabilir?): {op_fail}")
             else:
                 print(f"[HATA] İndeks oluşturulurken operasyon hatası: {op_fail}")
        except Exception as e:
            print(f"[HATA] İndeks oluşturulurken beklenmedik hata: {e}")

        print("--- Veritabanı Kurulumu Tamamlandı ---")
        return True

    except ConnectionFailure:
        print(f"[HATA] MongoDB sunucusuna ({config.MONGO_URI}) bağlanılamadı.")
        print("       Lütfen MongoDB sunucusunun çalıştığından ve URI'nin doğru olduğundan emin olun.")
        return False
    except Exception as e:
        print(f"[HATA] Veritabanı kurulumu sırasında beklenmedik bir hata: {e}")
        return False
    finally:
        # Kurulum sonrası bağlantıyı kapat
        if client:
            client.close()
            # print("MongoDB bağlantısı kapatıldı (setup sonrası).") # Çok gerekli değil

if __name__ == "__main__":
    print("="*50)
    print(" Kurulum ve Veritabanı Hazırlık Script'i ")
    print("="*50)
    print("Bu script gerekli Python kütüphanelerini yükleyecek ve")
    print(f"MongoDB'deki '{config.DB_NAME}' veritabanını SIFIRLAYACAKTIR.")
    print("Devam etmeden önce DİKKATLİ olun!")

    if check_and_install_dependencies():
        if setup_database():
            print("\nKurulum başarıyla tamamlandı.")
            print("Modeli çalıştırmadan önce 'config.py' dosyasının ayarlarını kontrol edin.")
            print("MongoDB Atlas veya uyumlu ortam kullanıyorsanız, 'vektor' alanı için")
            print("uygun bir vektör indeksi oluşturmayı unutmayın.")
        else:
            print("\nVeritabanı kurulumu başarısız oldu. Lütfen hataları kontrol edin.")
    else:
        print("\nBağımlılık kontrolü/kurulumu başarısız oldu.")

    print("\nScript tamamlandı.")