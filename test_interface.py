# test_interface.py

import sys
import time

# Gerekli modülleri ve yapılandırmayı import et
try:
    import config
    import database
    import session_manager
    import language_processor
    import query_manager
    import data_handler
    import feedback_manager
    from bson.objectid import ObjectId # Geri bildirim için ID'leri işlerken
    MODULES_AVAILABLE = True
    print("[Test Interface] Gerekli modüller başarıyla yüklendi.")
except ImportError as e:
    print(f"[HATA] test_interface: Gerekli modüller yüklenemedi: {e}")
    MODULES_AVAILABLE = False
except AttributeError as e:
    print(f"[HATA] test_interface: config dosyasında beklenen bir ayar bulunamadı: {e}")
    MODULES_AVAILABLE = False


def display_menu(session_context):
    """ Kullanıcıya interaktif menüyü ve oturum bilgilerini gösterir. """
    lang = session_context.get_language() if session_context else '??'
    # Oturum ID'sinin sadece bir kısmını gösterelim (daha okunaklı)
    sid_full = session_context.get_session_id() if session_context else '????????'
    sid_short = sid_full[:4] + '...' + sid_full[-4:] if len(sid_full) > 8 else sid_full

    print("\n" + "=" * 30)
    print("   İnteraktif Test Modu")
    print(f"   (Oturum: {sid_short}, Dil: {lang})")
    print("-" * 30)
    print("  1: Soru Sor / Etkileşim")
    print("  2: Yeni Bilgi Ekle (Manuel)")
    print("  3: Kayıt Doğrula")
    print("  0: Çıkış")
    print("=" * 30)

def handle_interaction(session_context):
    """ Seçenek 1: Kullanıcıdan soru alır ve yanıtlar. """
    if not MODULES_AVAILABLE or not session_context: return

    print("\n--- Soru Sor / Etkileşim ---")
    print("   (Menüye dönmek için 'menu' yazın)")
    while True:
        try:
            query = input("Siz  : ")
            if not query: continue
            if query.lower() == 'menu':
                break

            # Ana sorgu yöneticisini çağır
            response = query_manager.process_query(query, session_context)
            print(f"Model: {response}")

        except Exception as e:
            print(f"[Hata] Etkileşim sırasında hata: {e}")
            # Hata durumunda döngüye devam edelim
            time.sleep(0.5)

def handle_manual_add():
    """ Seçenek 2: Kullanıcıdan manuel olarak yeni bilgi alır ve ekler. """
    if not MODULES_AVAILABLE: return

    print("\n--- Yeni Bilgi Ekle (Manuel) ---")
    try:
        # Gerekli alanları al
        metin = input("Metin/İçerik Girin                 : ").strip()
        tur = input("Bilgi Türü ('gerçek', 'soru-cevap', vb.): ").lower().strip()
        anahtar = input("Anahtar Kelime/Soru (İlişkili Soru): ").strip()
        baglam = input("Bağlam Etiketleri (Virgülle Ayır)  : ").strip()

        if not metin or not tur:
            print("[Uyarı] Metin ve Tür alanları boş bırakılamaz. Ekleme iptal edildi.")
            return

        kwargs_to_add = {}
        if anahtar:
            # Veri yapımızdaki doğru alan adını kullanalım (config'den de alınabilir)
            kwargs_to_add['soru_veya_anahtar'] = anahtar
        if baglam:
            kwargs_to_add['baglam_etiketleri'] = [etiket.strip() for etiket in baglam.split(',') if etiket.strip()]

        # İnteraktif eklenenler doğrudan 'dogrulandi' kabul edilsin
        inserted_id = data_handler.add_bilgi_interactive(
            text=metin,
            tur=tur,
            kaynak="manuel_test_arayuzu",
            validation_status="dogrulandi", # Kullanıcı eklediği için doğrulanmış kabul et
            **kwargs_to_add
        )

        if inserted_id:
            print(f"Bilgi başarıyla eklendi (ID: {inserted_id}).")
        else:
            print("Bilgi eklenirken bir sorun oluştu veya eklenemedi.")

    except Exception as e:
        print(f"[Hata] Bilgi ekleme sırasında hata: {e}")

def handle_validation(session_context):
    """ Seçenek 3: Kayıt doğrulama döngüsünü yönetir. """
    if not MODULES_AVAILABLE or not session_context: return

    print("\n--- Kayıt Doğrulama ---")
    skipped_in_this_validation_session = [] # Sadece bu doğrulama döngüsünde atlananlar

    while True:
        try:
            # Doğrulanacak bir kayıt al (bu oturumda atlananları hariç tut)
            record = feedback_manager.get_record_for_validation(
                skip_ids=skipped_in_this_validation_session
            )

            if not record:
                print("\nDoğrulanacak uygun kayıt bulunamadı. Ana menüye dönülüyor.")
                break

            doc_id = record.get('_id')
            doc_id_str = str(doc_id) # String hali lazım olabilir

            print("\n" + "~"*20 + " Doğrulanacak Kayıt " + "~"*20)
            print(f" ID        : {doc_id_str}")
            print(f" Tür       : {record.get('tur', 'N/A')}")
            print(f" Metin     : {record.get('metin', 'N/A')}")
            print(f" Kaynak    : {record.get('kaynak', 'N/A')}")
            print(f" Durum     : {record.get('validation_status', 'N/A')}")
            # print(f" Anahtar K.: {record.get('anahtar_kelimeler', [])[:5]}...") # İsteğe bağlı gösterilebilir
            print("~"*58)

            feedback = input("Bu kayıt doğru mu? [E]vet / [H]ayır / [A]tla / [M]enü: ").lower().strip()

            feedback_type = None
            comment = None
            corrected_text = None # Şimdilik düzeltme almıyoruz

            if feedback in ['e', 'evet']:
                feedback_type = "doğru"
            elif feedback in ['h', 'hayır']:
                feedback_type = "hatalı"
                comment = input("Neden hatalı? Yorumunuz (opsiyonel): ").strip()
                # Burada belki "silinsin mi?" diye de sorulabilir veya 'anlamsız' seçeneği sunulabilir.
                delete_opt = input("Kullanım dışı bırakılsın mı? [S]il/[A]nlamsız veya [G]eç: ").lower().strip()
                if delete_opt in ['s', 'sil', 'a', 'anlamsız']:
                    feedback_type = "anlamsız" # veya "silinen"
            elif feedback in ['a', 'atla']:
                feedback_type = "atla"
                if doc_id:
                     skipped_in_this_validation_session.append(doc_id_str)
            elif feedback in ['m', 'menu']:
                print("Ana menüye dönülüyor...")
                break # Doğrulama döngüsünden çık
            else:
                print("Geçersiz seçim. Lütfen E, H, A veya M girin.")
                continue # Aynı kaydı tekrar sor

            # Geri bildirimi işle ('atla' hariç)
            if feedback_type and feedback_type != "atla" and doc_id:
                success = feedback_manager.log_and_update_feedback(
                    doc_id=doc_id, # ObjectId olarak gönder
                    feedback_type=feedback_type,
                    session_id=session_context.get_session_id(),
                    comment=comment,
                    # corrected_text=corrected # Düzeltme alınırsa buraya eklenir
                )
                if success:
                    print(f"Geri bildirim ('{feedback_type}') işlendi.")
                else:
                    print("Geri bildirim işlenirken bir sorun oluştu.")
            elif feedback_type == "atla":
                 print("Kayıt atlandı.")

            # Başka kayıt kontrolü (Menüye dönmediyse)
            if feedback != 'm':
                cont = input("Başka bir kayıt doğrulamaya devam edilsin mi? (e/h): ").lower().strip()
                if cont != 'e':
                    print("Ana menüye dönülüyor...")
                    break # Doğrulama döngüsünden çık

        except Exception as e:
            print(f"[Hata] Kayıt doğrulama döngüsünde hata: {e}")
            # Hata sonrası menüye dönmek daha güvenli olabilir
            break


def interactive_mode():
    """ Ana interaktif test modu döngüsünü başlatır ve yönetir. """
    if not MODULES_AVAILABLE:
        print("[HATA] Gerekli modüller yüklenemediği için interaktif mod başlatılamıyor.")
        return

    current_session = None
    try:
        # Veritabanı bağlantısını al
        db_conn = database.get_db_connection()
        if not db_conn:
            print("[HATA] İnteraktif mod için veritabanı bağlantısı kurulamadı.")
            return

        # NLP modelini başlat
        if not nlp_processor.is_nlp_initialized:
             if not nlp_processor.init_nlp():
                  print("[HATA] İnteraktif mod için NLP işlemcisi başlatılamadı.")
                  return

        # Oturumu Başlat ve Dil Tespiti Yap
        print("\n" + "*"*40)
        print(" İnteraktif Mod Başlatılıyor - Dil Tespiti")
        print("*"*40)
        print("Oturum dilini belirlemek için lütfen ilk mesajınızı girin.")
        initial_query = input("İlk Mesajınız: ").strip()

        detected_lang = "tr" # Varsayılan
        if initial_query:
            language_rules = database.get_language_rules() # DB'den kuralları al
            detected_lang = language_processor.detect_language(initial_query, language_rules)
            print(f"-> Algılanan dil: {detected_lang.upper()}")
        else:
            print("-> Geçerli bir ilk mesaj girilmedi. Varsayılan dil 'tr' kullanılacak.")

        # Oturum nesnesini oluştur
        current_session = session_manager.SessionContext(language=detected_lang)

        # İsteğe bağlı: İlk mesajı da işleyelim mi? Evet.
        if initial_query:
            print("\nİlk mesajınız işleniyor...")
            response = query_manager.process_query(initial_query, current_session)
            print(f"\nModel: {response}")

    except Exception as init_e:
        print(f"[HATA] Oturum başlatılırken kritik hata: {init_e}")
        if current_session is None: # Oturum hiç oluşturulamadıysa çık
             return
        # Oturum oluştuysa bile devam etmek riskli olabilir, yine de deneyebiliriz
        print("[Uyarı] Oturum başlatmada sorun yaşandı, menü yine de gösteriliyor...")

    # Ana Menü Döngüsü
    if current_session: # Oturum başarıyla oluşturulduysa devam et
        while True:
            display_menu(current_session)
            try:
                choice = input("Seçiminiz (0-3): ").strip()

                if choice == '1':
                    handle_interaction(current_session)
                elif choice == '2':
                    handle_manual_add()
                elif choice == '3':
                    handle_validation(current_session)
                elif choice == '0':
                    print("İnteraktif moddan çıkılıyor...")
                    break
                else:
                    print("Geçersiz seçim (0, 1, 2, 3). Lütfen tekrar deneyin.")

            except KeyboardInterrupt:
                print("\nCtrl+C algılandı. Çıkılıyor...")
                break
            except EOFError: # Bazı terminallerde Ctrl+D
                 print("\nÇıkış isteği algılandı...")
                 break
            except Exception as loop_e:
                print(f"[HATA] Ana menü döngüsünde beklenmedik hata: {loop_e}")
                print("        Devam etmeye çalışılıyor...")
                time.sleep(1) # Hata mesajını görmek için bekle
    else:
         print("Oturum başlatılamadığı için menü gösterilemiyor.")

    # Uygulama kapanırken DB bağlantısını kapatmak iyi olabilir
    # database.close_db_connection() # Bunu ana model.py yapabilir

# --- Doğrudan Çalıştırma Testleri ---
if __name__ == "__main__":
    print("--- Test Interface Modülü Başladı (Normalde model.py tarafından çağrılır) ---")
    # Bu testin çalışması için diğer tüm modüllerin ve MongoDB'nin hazır olması gerekir.
    # Gerçek bir test için 'python model.py test' komutu kullanılmalıdır.
    if MODULES_AVAILABLE:
         print("Modül temel olarak yüklenebilir görünüyor.")
         print("!!! BU SCRIPTI DOĞRUDAN ÇALIŞTIRMAK YERİNE 'python model.py test' KULLANIN !!!")
    else:
         print("Modül yüklenemedi.")
    print("\n--- Test Interface Modülü Tamamlandı ---")