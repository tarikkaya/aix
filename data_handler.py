# data_handler.py

import os
import datetime
import traceback  # Hata ayıklama logları için

# Gerekli modülleri ve yapılandırmayı import et
try:
    import config
    import database
    import nlp_processor
    MODULES_AVAILABLE = True
except ImportError as e:
    print(f"[HATA] data_handler: Gerekli modüller ('config', 'database', 'nlp_processor') yüklenemedi: {e}")
    MODULES_AVAILABLE = False
    config = None; database = None; nlp_processor = None
except AttributeError as e:
    print(f"[HATA] data_handler: config dosyasında beklenen bir ayar bulunamadı: {e}")
    MODULES_AVAILABLE = False


def add_data_from_file(file_path):
    """
    Belirtilen metin dosyasını satır satır okur, her anlamlı satırı işler,
    vektörünü hesaplar ve veritabanına 'bilgi_parcaciklari' olarak ekler.
    Dosyanın UTF-8 formatında olduğu varsayılır. Her satır varsayılan olarak 'gerçek'
    türünde eklenir. Yapılandırılmış veri eklemek için farklı bir mekanizma gerekir.

    Args:
        file_path (str): Okunacak metin dosyasının yolu.

    Returns:
        bool: İşlem başarılıysa (kritik hata yoksa) True döner.
    """
    if not MODULES_AVAILABLE:
        print("[HATA] Data Handler: Modüller yüklenemediği için veri eklenemiyor.")
        return False

    # NLP işlemcisinin hazır olduğundan emin ol, değilse başlatmayı dene
    if not nlp_processor.is_nlp_initialized:
        print("[Bilgi] Data Handler: NLP işlemcisi başlatılıyor (dosya okuma için)...")
        if not nlp_processor.init_nlp():
            print("[HATA] NLP işlemcisi başlatılamadığı için veri eklenemiyor.")
            return False

    # Dosya kontrolleri
    if not os.path.exists(file_path):
        print(f"[HATA] Dosya bulunamadı: {file_path}")
        return False
    if not os.path.isfile(file_path):
         print(f"[HATA] Belirtilen yol bir dosya değil: {file_path}")
         return False

    print(f"'{os.path.basename(file_path)}' dosyasından veri işleniyor...")
    added_count = 0
    skipped_empty_count = 0
    skipped_duplicate_in_file_count = 0
    error_embedding_count = 0
    error_db_count = 0
    line_number = 0
    processed_lines_in_session = set()

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            for line in f:
                line_number += 1
                original_text = line.strip()

                # Boş satırları atla
                if not original_text:
                    skipped_empty_count += 1
                    continue

                # Metni temizle
                cleaned_text = nlp_processor.clean_text(original_text)
                if not cleaned_text:
                    skipped_empty_count += 1
                    continue

                # Aynı metin tekrar işlendiyse atla
                if cleaned_text in processed_lines_in_session:
                    skipped_duplicate_in_file_count += 1
                    continue
                processed_lines_in_session.add(cleaned_text)

                # Metnin vektörünü al
                vector = nlp_processor.get_embedding(cleaned_text)
                if vector is None:
                    error_embedding_count += 1
                    continue

                # Anahtar kelime çıkarımı
                keywords = nlp_processor.tokenize_text(cleaned_text)

                # Veritabanı belgesi oluştur
                bilgi_document = {
                    "metin": cleaned_text,
                    "vektor": vector,
                    "tur": "gerçek",
                    "anahtar_kelimeler": keywords[:getattr(config, 'KEYWORD_LIMIT', 25)],
                    "kaynak": os.path.basename(file_path),
                    "validation_status": "bekliyor",
                    "baglam_etiketleri": []
                }

                # Belgeyi veritabanına ekle
                inserted_id = database.add_bilgi(bilgi_document)
                if inserted_id:
                    added_count += 1
                    if added_count % 100 == 0:
                        print(f"  -> {added_count} kayıt veritabanına eklendi...")
                else:
                    error_db_count += 1

        print(f"\n'{os.path.basename(file_path)}' dosyası işlendi.")
        print(f"  Toplam Okunan Satır        : {line_number}")
        print(f"  Başarıyla Eklenen Kayıt   : {added_count}")
        print(f"  Atlanan (Boş/Temizlenmiş): {skipped_empty_count}")
        print(f"  Atlanan (Dosya İçi Tekrar): {skipped_duplicate_in_file_count}")
        print(f"  Hata (Vektör Üretme)     : {error_embedding_count}")
        print(f"  Hata (Veritabanı Yazma)  : {error_db_count}")
        return line_number > 0 and error_db_count == 0 and error_embedding_count < line_number

    except FileNotFoundError:
        print(f"[HATA] Dosya okunamadı: {file_path}")
        return False
    except Exception as e:
        print(f"[HATA] '{file_path}' okunurken/işlenirken genel hata (Satır ~{line_number}): {e}")
        traceback.print_exc(limit=2)
        return False


def add_bilgi_interactive(text, tur="gerçek", kaynak="manuel_arayuz", validation_status="dogrulandi", **kwargs):
    """
    İnteraktif modda tekil bilgi eklemek için kullanılır (örneğin test arayüzünden).
    Ek alanlar kwargs ile eklenebilir (örn: kural_kosulu, adim_listesi).
    
    Args:
        text (str): Eklenen metin.
        tur (str): Bilgi tipi, varsayılan "gerçek".
        kaynak (str): Kaynak bilgisi, varsayılan "manuel_arayuz".
        validation_status (str): Doğrulama durumu.
        **kwargs: Ekstra alanlar.

    Returns:
        ObjectId: Yeni eklenen belgenin ID'si, ekleme başarısızsa None.
    """
    if not MODULES_AVAILABLE:
        return None

    if not nlp_processor.is_nlp_initialized:
        if not nlp_processor.init_nlp():
            return None

    # Girdi kontrolleri
    cleaned_text = nlp_processor.clean_text(text) if text and isinstance(text, str) else ""
    if not cleaned_text and not kwargs:
        print("[Uyarı] İnteraktif Ekleme: Hem metin hem de ek bilgi (kwargs) boş.")
        return None

    vector = nlp_processor.get_embedding(cleaned_text) if cleaned_text else None
    if cleaned_text and vector is None:
         print(f"[Uyarı] İnteraktif ekleme: '{cleaned_text[:50]}' için vektör alınamadı, ekleme yapılmıyor.")
         return None

    keywords = nlp_processor.tokenize_text(cleaned_text) if cleaned_text else []

    valid_statuses = ["bekliyor", "dogrulandi", "hatali", "kullanilmiyor"]
    final_validation_status = validation_status if validation_status in valid_statuses else "bekliyor"

    bilgi_document = {
        "metin": cleaned_text,
        "vektor": vector,
        "tur": str(tur).lower().strip() if tur else "gerçek",
        "anahtar_kelimeler": keywords[:getattr(config, 'KEYWORD_LIMIT', 25)],
        "kaynak": str(kaynak) if kaynak else "bilinmeyen",
        "validation_status": final_validation_status,
        "baglam_etiketleri": kwargs.pop('baglam_etiketleri', []),
    }

    for key, value in kwargs.items():
         if key not in bilgi_document and key not in ['_id', 'eklenme_zamani']:
              bilgi_document[key] = value

    inserted_id = database.add_bilgi(bilgi_document)
    return inserted_id


# --- Doğrudan Çalıştırma Testleri ---
if __name__ == "__main__":
    print("--- Data Handler Testi Başladı ---")
    print("    UYARI: Bu test, sahte (mock) DB ve NLP kullanır.")

    # Sahte modüller kullanılacaksa
    if not MODULES_AVAILABLE:
        print("Sahte modüller oluşturuluyor...")
        from bson.objectid import ObjectId

        class MockDB:
            _added_docs_list_test_dh_main = []
            def add_bilgi(self, doc):
                doc_id = ObjectId()
                doc['_id'] = doc_id
                self._added_docs_list_test_dh_main.append(doc)
                print(f"    -> [Sahte DB] add_bilgi: Tür='{doc.get('tur')}', Metin='{str(doc.get('metin'))[:30]}...'")
                return doc_id

        database = MockDB()

        class MockNLP:
            is_nlp_initialized = True
            def init_nlp(self): 
                return True
            def clean_text(self, t): 
                return t.lower().strip() if t else ""
            def get_embedding(self, t): 
                return [0.6] * 768 if t else None
            def tokenize_text(self, t): 
                return t.split() if t else []

        nlp_processor = MockNLP()
        config = type('obj', (object,), {'KEYWORD_LIMIT': 5})()
        MODULES_AVAILABLE = True

    # Test dosyası oluşturuluyor
    test_file = "_test_datahandler_run_main_temp.txt"
    try:
        print(f"\n'{test_file}' oluşturuluyor...")
        with open(test_file, "w", encoding="utf-8") as f:
            f.write(" İlk dosya satırı.\n \nÜçüncü.\n İkinci satır.\nÜçüncü.\n")

        print(f"\n'{test_file}' dosyasından veri ekleniyor...")
        success = add_data_from_file(test_file)
        print(f"Dosya işleme sonucu: {success}")

        print("\nİnteraktif ekleme testi (prosedür):")
        proc_id = add_bilgi_interactive(
            text=" Sistemi yeniden başlatma prosedürü ",
            tur="prosedür", 
            kaynak="test_manual", 
            validation_status="dogrulandi",
            prosedur_adi="Yeniden Başlat",
            adim_listesi=["Tüm işlemleri kaydet", "Sunucuyu kapat", "5sn bekle", "Sunucuyu aç"]
        )
        if proc_id:
            print(f"  -> Manuel prosedür eklendi, ID: {proc_id}")
        else:
            print("  -> Manuel ekleme başarısız.")

        print("\nEklenen Belgeler (Simülasyon):")
        if hasattr(database, '_added_docs_list_test_dh_main'):
             for i, doc in enumerate(database._added_docs_list_test_dh_main):
                  extra = {k: v for k, v in doc.items() if k not in ['metin','vektor','tur','anahtar_kelimeler','kaynak','validation_status','baglam_etiketleri','_id','eklenme_zamani']}
                  print(f"  {i+1}. Tür: '{doc.get('tur')}', Metin: '{doc.get('metin')}', Ek: {extra}")

    except Exception as e:
        print(f"Test sırasında genel hata: {e}")
        traceback.print_exc()
    finally:
        if os.path.exists(test_file):
            try:
                os.remove(test_file)
                print(f"\n'{test_file}' silindi.")
            except Exception as e_del:
                print(f"'{test_file}' silinirken hata: {e_del}")

    print("\n--- Data Handler Testi Tamamlandı ---")
