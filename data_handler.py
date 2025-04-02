# data_handler.py

import os
import datetime

# Gerekli modülleri import etmeyi dene
try:
    import config
    import database
    import nlp_processor
    MODULES_AVAILABLE = True
    print("[Data Handler] Gerekli modüller başarıyla yüklendi.")
except ImportError as e:
    print(f"[HATA] data_handler: Gerekli modüller ('config', 'database', 'nlp_processor') yüklenemedi: {e}")
    print("       Lütfen bu dosyaların mevcut ve import edilebilir olduğundan emin olun.")
    MODULES_AVAILABLE = False
    # Hata durumunda diğer fonksiyonların çalışmaması için sahte nesneler atamayalım.
except AttributeError as e:
    # Eğer config import edilip içinden bir şey bulunamazsa
    print(f"[HATA] data_handler: config dosyasında beklenen bir ayar bulunamadı: {e}")
    MODULES_AVAILABLE = False


def add_data_from_file(file_path):
    """
    Belirtilen metin dosyasını satır satır okur, her satırı işler,
    vektörünü hesaplar ve veritabanına yeni bir bilgi parçacığı olarak ekler.
    Dosyanın UTF-8 formatında olduğu varsayılır.

    Args:
        file_path (str): Okunacak metin dosyasının yolu.

    Returns:
        bool: İşlem başarılıysa True, değilse False.
    """
    if not MODULES_AVAILABLE:
        print("[HATA] Gerekli modüller yüklenemediği için veri eklenemiyor.")
        return False

    # NLP işlemcisinin başlatıldığından emin ol (model yüklenmiş olmalı)
    if not nlp_processor.is_nlp_initialized:
        print("[Uyarı] data_handler: NLP işlemcisi başlatılmamış. Başlatılıyor...")
        if not nlp_processor.init_nlp():
            print("[HATA] NLP işlemcisi başlatılamadığı için veri eklenemiyor.")
            return False

    if not os.path.exists(file_path):
        print(f"[HATA] Dosya bulunamadı: {file_path}")
        return False

    print(f"'{file_path}' dosyasından veri ekleniyor...")
    added_count = 0
    skipped_empty_count = 0
    skipped_duplicate_count = 0
    error_embedding_count = 0
    error_db_count = 0
    line_number = 0
    processed_lines = set() # Basit satır bazlı duplike kontrolü için (bellekte tutar)

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            for line in f:
                line_number += 1
                original_text = line.strip()

                if not original_text: # Boş satırları atla
                    skipped_empty_count += 1
                    continue

                # Metni temizle
                cleaned_text = nlp_processor.clean_text(original_text)
                if not cleaned_text: # Temizleme sonrası boş kalanları atla
                    skipped_empty_count += 1
                    continue

                # --- Bellek İçi Basit Duplike Kontrolü ---
                # Aynı çalıştırmada aynı satır tekrar gelirse atla.
                # Veritabanı bazlı kontrol daha doğru olur ama yavaşlatabilir.
                if cleaned_text in processed_lines:
                    skipped_duplicate_count +=1
                    continue
                processed_lines.add(cleaned_text)
                # --- Duplike Kontrolü Sonu ---

                # Metnin vektörünü al
                vector = nlp_processor.get_embedding(cleaned_text)
                if vector is None:
                    # print(f"[Hata] Satır {line_number}: Vektör oluşturulamadı, atlanıyor: '{cleaned_text[:50]}...'")
                    error_embedding_count += 1
                    continue

                # Temel anahtar kelimeleri çıkar (opsiyonel, ileride kullanılabilir)
                keywords = nlp_processor.tokenize_text(cleaned_text)

                # Veritabanı için belgeyi hazırla
                bilgi_document = {
                    "metin": cleaned_text,
                    "vektor": vector,
                    "tur": "gerçek", # Varsayılan tür, daha sonra test arayüzünde değiştirilebilir
                    "anahtar_kelimeler": keywords[:25], # İlk 25 token/kelime (limit örneği)
                    "kaynak": os.path.basename(file_path), # Sadece dosya adı kaynak olarak belirtilir
                    "validation_status": "bekliyor", # Yeni eklenenler doğrulanmalı
                    # eklenme_zamani database.add_document içinde otomatik eklenecek
                    "baglam_etiketleri": [] # Başlangıçta boş, ileride doldurulabilir
                }

                # Veritabanına ekle (database.py'deki fonksiyonu kullanarak)
                inserted_id = database.add_bilgi(bilgi_document)
                if inserted_id:
                    added_count += 1
                    if added_count % 100 == 0: # Her 100 kayıtta bir bilgi ver
                        print(f"  -> {added_count} kayıt eklendi...")
                else:
                    # print(f"[Hata] Satır {line_number}: Veritabanına eklenemedi: '{cleaned_text[:50]}...'")
                    error_db_count += 1

        print(f"\n'{file_path}' için veri ekleme tamamlandı.")
        print(f"  Toplam Okunan Satır   : {line_number}")
        print(f"  Başarıyla Eklenen     : {added_count}")
        print(f"  Atlanan (Boş/Temiz)  : {skipped_empty_count}")
        print(f"  Atlanan (Duplike Satır): {skipped_duplicate_count}")
        print(f"  Hata (Vektör Üretme) : {error_embedding_count}")
        print(f"  Hata (Veritabanı Yazma): {error_db_count}")
        return True

    except FileNotFoundError:
        # Bu aslında os.path.exists ile başta kontrol ediliyor ama yine de dursun
        print(f"[HATA] Dosya bulunamadı: {file_path}")
        return False
    except Exception as e:
        print(f"[HATA] Dosya okunurken veya işlenirken genel hata (Satır ~{line_number}): {e}")
        import traceback
        traceback.print_exc() # Detaylı hata için
        return False

def add_bilgi_interactive(text, tur="gerçek", kaynak="manuel", validation_status="bekliyor", **kwargs):
    """
    İnteraktif modda veya diğer modüller tarafından tekil bilgi eklemek için kullanılır.
    Başarılı olursa yeni eklenen belgenin ID'sini, olmazsa None döndürür.
    """
    if not MODULES_AVAILABLE: return None
    if not nlp_processor.is_nlp_initialized:
        if not nlp_processor.init_nlp(): return None # NLP başlatılamazsa ekleme yapma

    if not text: return None

    cleaned_text = nlp_processor.clean_text(text)
    if not cleaned_text: return None

    # Duplike kontrolü burada da yapılabilir (isteğe bağlı)
    # existing = database.find_bilgi(config.COLLECTION_BILGI, {"metin": cleaned_text}, limit=1)
    # if existing:
    #     print(f"[Bilgi] İnteraktif: Duplike metin atlandı: '{cleaned_text[:50]}...'")
    #     return existing[0]['_id'] # Mevcut ID'yi döndür? Veya None?

    vector = nlp_processor.get_embedding(cleaned_text)
    if vector is None: return None

    keywords = nlp_processor.tokenize_text(cleaned_text)

    bilgi_document = {
        "metin": cleaned_text,
        "vektor": vector,
        "tur": tur,
        "anahtar_kelimeler": keywords[:25],
        "kaynak": kaynak,
        "validation_status": validation_status,
        # eklenme_zamani database.add_document içinde otomatik eklenecek
        **kwargs # Fonksiyona verilen diğer anahtar=değer çiftlerini ekle
                 # (örn: soru_cevap_iliski_id, baglam_etiketleri vb.)
    }

    inserted_id = database.add_bilgi(bilgi_document)
    if inserted_id:
        print(f"  -> İnteraktif/Manuel bilgi eklendi (ID: {inserted_id})")
    return inserted_id


# --- Doğrudan Çalıştırma Testleri ---
if __name__ == "__main__":
    print("--- Data Handler Testi Başladı ---")

    # Test için sahte (mock) modüller GEREKLİ, çünkü DB ve NLP bağlantısı varsayılır
    if not MODULES_AVAILABLE:
        print("Sahte NLP ve DB modülleri kullanılıyor...")
        from bson.objectid import ObjectId # Sahte ID için
        class MockDB:
            def add_bilgi(self, doc):
                print(f"  -> [Sahte DB] add_bilgi çağrıldı: {str(doc)[:100]}...")
                return ObjectId() # Sahte ID döndür
            def find_bilgi(self, coll, query, limit=1): # Duplike kontrolü testi için
                print(f"  -> [Sahte DB] find_bilgi çağrıldı: {query}")
                return [] # Şimdilik duplike yok varsayalım
        database = MockDB()

        class MockNLP:
            is_nlp_initialized = True # Başlatılmış gibi davran
            def init_nlp(self): return True
            def clean_text(self, t): return t.lower().strip() if t else ""
            def get_embedding(self, t): return [0.1] * 768 if t else None # Sabit boyutlu vektör
            def tokenize_text(self, t): return t.split() if t else []
        nlp_processor = MockNLP()
        MODULES_AVAILABLE = True

    # Geçici bir test dosyası oluştur
    test_file_name = "_test_datahandler_sample.txt"
    try:
        print(f"\n'{test_file_name}' oluşturuluyor...")
        with open(test_file_name, "w", encoding="utf-8") as f:
            f.write("Bu ilk anlamlı satır.\n")
            f.write("\n")
            f.write("   İkinci satırda    fazla boşluk var.  \n")
            f.write("Üçüncü satır Türkçe karakter içerir: çğşöü.\n")
            f.write("Bu ilk anlamlı satır.\n") # Duplike satır (bellek içi kontrol yakalamalı)

        print(f"\n'{test_file_name}' dosyasından veri ekleniyor...")
        success = add_data_from_file(test_file_name)
        print(f"Dosya işleme sonucu başarılı mı: {success}")

        print("\nİnteraktif ekleme testi:")
        new_id = add_bilgi_interactive(
            text="Manuel eklenen özel bir bilgi.",
            tur="özel_tip",
            kaynak="test_manuel",
            validation_status="dogrulandi", # Doğrudan doğrulanmış ekleyelim
            ekstra_alan="deneme"
        )
        if new_id:
             print(f"  -> Manuel ekleme başarılı, ID: {new_id}")
        else:
             print("  -> Manuel ekleme başarısız.")


    except Exception as e:
        print(f"Test sırasında genel hata: {e}")
    finally:
        # Test dosyasını sil
        if os.path.exists(test_file_name):
            try:
                os.remove(test_file_name)
                print(f"\n'{test_file_name}' silindi.")
            except Exception as e_del:
                print(f"'{test_file_name}' silinirken hata: {e_del}")

    print("\n--- Data Handler Testi Tamamlandı ---")