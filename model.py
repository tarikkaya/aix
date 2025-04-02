# model.py

import sys
import time
import traceback  # Hata ayıklama için detaylı izleme
import re  # Prompt formatını ayıklamak için

# --- Modül Kontrolü ve Import ---
try:
    print("Gerekli uygulama modülleri yükleniyor...")
    import config
    import database
    import nlp_processor
    import session_manager
    import language_processor
    import data_handler
    import query_manager
    import feedback_manager
    import test_interface
    MODULES_AVAILABLE = True
    print("Uygulama modülleri başarıyla yüklendi.")
except ImportError as e:
    print(f"[KRİTİK HATA] Modül yüklenemedi: {e}")
    sys.exit(1)
except Exception as e:
    print(f"[KRİTİK HATA] Beklenmedik hata: {e}")
    sys.exit(1)

# --- Ana Uygulama Fonksiyonu ---
def main():
    print("\nSistem başlatılıyor: Veritabanı ve NLP kontrol ediliyor...")
    initialization_success = True

    db_conn = database.get_db_connection()
    if not db_conn:
        print("[KRİTİK HATA] Veritabanı bağlantısı kurulamadı.")
        initialization_success = False

    if initialization_success and not nlp_processor.init_nlp():
        print("[KRİTİK HATA] NLP işlemcisi başlatılamadı.")
        initialization_success = False

    if not initialization_success:
        print("Başlangıç ayarları tamamlanamadı, uygulama sonlandırılıyor.")
        database.close_db_connection()
        sys.exit(1)

    print("Sistem hazır. Komut bekleniyor.")
    args = sys.argv[1:]

    if not args or args[0].lower() in ['help', '--help', '-h', 'yardım']:
        print("\nKullanım Kılavuzu:")
        print("  python model.py veriekle <dosya_yolu>")
        print("  python model.py test")
        print("  python model.py \"<sorgunuz>\"")
        print("  python model.py \"promp:<tanım>\" \"<sorgunuz>\"")
        database.close_db_connection()
        sys.exit(0)

    command_or_first_arg = args[0]
    current_session = None

    try:
        if command_or_first_arg == "veriekle":
            if len(args) != 2:
                print("[HATA] Kullanım: python model.py veriekle <dosya_yolu>")
            else:
                data_handler.add_data_from_file(args[1])

        elif command_or_first_arg == "test":
            test_interface.interactive_mode()

        else:
            first_arg_cleaned = args[0].strip("'\" ")
            prompt_match = re.match(r"^promp:(.+)", first_arg_cleaned, re.IGNORECASE)

            prompt_definition = prompt_match.group(1).strip() if prompt_match and len(args) > 1 else None
            query = " ".join(args[1:] if prompt_definition else args)

            if not query:
                print("[HATA] İşlenecek sorgu metni girilmedi.")
            else:
                language_rules = database.get_language_rules() or {'default': 'tr'}
                detected_language = language_processor.detect_language(query, language_rules)
                print(f"Sorgu dili: {detected_language.upper()}")

                current_session = session_manager.SessionContext(language=detected_language)
                response = query_manager.process_query(query, current_session, prompt_definition)
                
                print("\nModel Yanıtı:")
                print("+" + "-" * 60 + "+")
                for line in response.splitlines():
                    print(f"  {line}")
                print("+" + "-" * 60 + "+")

    except Exception as e:
        print(f"\n[HATA] Uygulama çalışırken bir sorun oluştu: {e}")
        traceback.print_exc()
    finally:
        print("\nUygulama sonlandırılıyor...")
        database.close_db_connection()
        print("Çıkış yapıldı.")

if __name__ == "__main__":
    main()
