# model.py

import sys
import time
import traceback # Hata ayıklama için

# --- Modül Kontrolü ve Import ---
# Uygulamanın çalışması için gerekli tüm kendi modüllerimizi import etmeyi deneyelim
try:
    print("Gerekli modüller yükleniyor...")
    import config
    import database
    import nlp_processor
    import session_manager
    import language_processor
    import data_handler
    import query_manager
    import feedback_manager
    import test_interface
    import task_manager
    MODULES_AVAILABLE = True
    print("Tüm uygulama modülleri başarıyla yüklendi.")
except ImportError as e:
    print(f"[KRİTİK HATA] Gerekli bir uygulama modülü yüklenemedi: {e}")
    print("           Lütfen tüm .py dosyalarının (config.py dahil)")
    print("           aynı dizinde olduğundan emin olun.")
    MODULES_AVAILABLE = False
except AttributeError as e:
    print(f"[KRİTİK HATA] config.py dosyasında bir ayar eksik veya hatalı: {e}")
    MODULES_AVAILABLE = False
except Exception as e:
    print(f"[KRİTİK HATA] Modüller yüklenirken beklenmedik genel hata: {e}")
    MODULES_AVAILABLE = False

# --- Ana Fonksiyon ---
def main():
    # Başlamadan önce modüllerin yüklendiğinden emin ol
    if not MODULES_AVAILABLE:
        print("\nEksik veya hatalı modüller nedeniyle uygulama başlatılamıyor.")
        sys.exit(1) # Modüller olmadan devam etmenin anlamı yok

    # --- Başlangıç Ayarları ---
    print("\nSistem başlatılıyor...")
    initialization_success = True

    # 1. Veritabanı Bağlantısını Kontrol Et/Al
    db_conn = database.get_db_connection()
    if not db_conn:
        print("[KRİTİK HATA] Veritabanı bağlantısı kurulamadı.")
        initialization_success = False

    # 2. NLP Modelini Başlat (sadece bir kere)
    if initialization_success and not nlp_processor.is_nlp_initialized:
        if not nlp_processor.init_nlp():
            print("[KRİTİK HATA] NLP işlemcisi (embedding modeli) başlatılamadı.")
            initialization_success = False

    # Başlangıç ayarları başarısız olduysa uygulamayı sonlandır
    if not initialization_success:
        print("Başlangıç ayarları tamamlanamadığı için uygulama sonlandırılıyor.")
        database.close_db_connection() # Açık kalmış olabilecek bağlantıyı kapat
        sys.exit(1)

    print("Sistem başlangıç ayarları tamamlandı.")

    # --- Komut Satırı Argümanlarını İşleme ---
    args = sys.argv[1:] # Script adını (sys.argv[0]) atla

    # Eğer hiç argüman yoksa veya sadece 'help'/'yardim' ise kullanım bilgilerini göster
    if not args or args[0].lower() in ['help', '--help', '-h', 'yardim']:
        print("\nKullanım Kılavuzu:")
        print("  python model.py setup         : Gerekli kütüphaneleri kurar ve veritabanını sıfırlar.")
        print("  python model.py veriekle <dosya_yolu>")
        print("                                : Belirtilen dosyadan veri ekler.")
        print("  python model.py test          : İnteraktif test ve geri bildirim modunu başlatır.")
        print("  python model.py task \"<adım 1>\" \"<adım 2>\" ...")
        print("                                : Çok adımlı görevi yürütür.")
        print("  python model.py \"<sorgunuz>\"   : Doğrudan sorgu yapar.")
        print("  python model.py \"promp:<tanım>\" \"<sorgunuz>\"")
        print("                                : Belirtilen prompt tanımıyla sorgu yapar.")
        database.close_db_connection() # Yardım sonrası bağlantıyı kapat
        sys.exit(0)

    command = args[0]
    current_session = None # Oturum gerektiren komutlar için

    try:
        # 1. Setup Modu (Yeni eklendi)
        if command.lower() == "setup":
            print("[Bilgi] 'setup.py' doğrudan çalıştırılmalıdır: python setup.py")
            print("       Ancak güvenlik için buradan çalıştırmıyoruz.")
            print("       Lütfen terminalden 'python setup.py' komutunu çalıştırın.")

        # 2. Veri Ekleme Modu
        elif command == "veriekle":
            if len(args) != 2:
                print("[HATA] Kullanım: python model.py veriekle <dosya_yolu>")
            else:
                file_path = args[1]
                data_handler.add_data_from_file(file_path)

        # 3. İnteraktif Test Modu
        elif command == "test":
            test_interface.interactive_mode() # Kendi içinde DB bağlantısı ve NLP başlatır

        # 4. Çok Adımlı Görev Modu
        elif command == "task":
            if len(args) < 2:
                print("[HATA] Kullanım: python model.py task \"<adım 1>\" \"<adım 2>\" ...")
            else:
                task_steps = args[1:]
                # Oturumu ve dili ilk adıma göre başlat
                language_rules = database.get_language_rules() # DB'den kuralları çek
                if not language_rules:
                     print("[Uyarı] Veritabanında dil kuralı bulunamadı, varsayılan 'tr' kullanılacak.")
                detected_language = language_processor.detect_language(task_steps[0], language_rules)
                print(f"Görev dili '{detected_language.upper()}' olarak algılandı.")
                current_session = session_manager.SessionContext(language=detected_language)
                # Görevi çalıştır
                final_result = task_manager.execute_multi_step_task(task_steps, current_session)
                print("\n--- Görev Tamamlandı Nihai Sonuç ---")
                print(final_result)
                print("-" * 33)

        # 5. Sorgu Modu (Prompt ile veya Doğrudan)
        else:
            prompt_definition = None
            query = ""
            first_arg = args[0]

            # Prompt formatını kontrol et: "promp:tanım" veya 'promp:tanım'
            prompt_match = re.match(r"promp:(['\"]?)(.*?)\1$", first_arg)

            if prompt_match and len(args) > 1:
                prompt_definition = prompt_match.group(2) # Tırnaklar olmadan tanımı al
                query = " ".join(args[1:])
            else:
                # Doğrudan sorgu (tüm argümanları birleştir)
                query = " ".join(args)

            if not query:
                 print("[HATA] İşlenecek sorgu bulunamadı.")
            else:
                # Oturumu ve dili sorguya göre başlat
                language_rules = database.get_language_rules()
                if not language_rules:
                    print("[Uyarı] Veritabanında dil kuralı bulunamadı, varsayılan 'tr' kullanılacak.")
                detected_language = language_processor.detect_language(query, language_rules)
                print(f"Sorgu dili '{detected_language.upper()}' olarak algılandı.")
                current_session = session_manager.SessionContext(language=detected_language)
                # Sorguyu işle
                response = query_manager.process_query(query, current_session, prompt_definition)
                print("\nModel Yanıtı:")
                print("-" * 15)
                print(response)
                print("-" * 15)

    except Exception as e:
        print(f"\n[BEKLENMEDİK ANA HATA] İşlem sırasında bir sorun oluştu: {e}")
        traceback.print_exc() # Geliştirme sırasında detaylı hata izi

    finally:
        # Uygulama kapanmadan önce veritabanı bağlantısını her zaman kapatmayı dene
        print("\nUygulama sonlandırılıyor...")
        database.close_db_connection()
        print("Veritabanı bağlantısı kapatıldı. Çıkış yapıldı.")


# --- Uygulamayı Başlat ---
if __name__ == "__main__":
    # Doğrudan çalıştırma yerine import edilip main() çağrılması daha iyi olabilir
    # ama komut satırı aracı olarak bu yapı uygundur.
    main()