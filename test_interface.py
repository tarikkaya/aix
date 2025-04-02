# test_interface.py

    import sys
    import time
    import traceback
    import json # Kural kümesi gibi yapıları almak için

    # Gerekli modülleri ve yapılandırmayı import et
    try:
        import config
        import database
        import session_manager
        import language_processor
        import query_manager
        import data_handler
        import feedback_manager
        from bson.objectid import ObjectId
        MODULES_AVAILABLE = True
        # print("[Test Interface] Gerekli modüller yüklendi.")
    except ImportError as e:
        print(f"[HATA] test_interface: Gerekli modüller yüklenemedi: {e}")
        MODULES_AVAILABLE = False
    except AttributeError as e:
        print(f"[HATA] test_interface: config dosyasında beklenen bir ayar bulunamadı: {e}")
        MODULES_AVAILABLE = False
    except Exception as e:
         print(f"[HATA] test_interface: Modül yüklenirken beklenmedik hata: {e}")
         MODULES_AVAILABLE = False


    def display_menu(session_context):
        """ Kullanıcıya interaktif menüyü ve oturum bilgilerini gösterir. """
        lang = "N/A"
        sid_short = "N/A"
        if session_context and isinstance(session_context, session_manager.SessionContext):
            lang = session_context.get_language()
            sid_full = session_context.get_session_id()
            sid_short = sid_full[:4] + '...' + sid_full[-4:] if len(sid_full) > 8 else sid_full

        print("\n" + "=" * 30)
        print("   İnteraktif Test Modu")
        print(f"   (Oturum: {sid_short}, Dil: {lang.upper()})")
        print("-" * 30)
        print("  1: Soru Sor / Etkileşim")
        print("  2: Yeni Bilgi Ekle (Manuel)")
        print("  3: Kayıt Doğrula")
        print("  0: Çıkış")
        print("=" * 30)

    def handle_interaction(session_context):
        """ Seçenek 1: Kullanıcıdan sürekli soru alır ve yanıtlar. """
        if not MODULES_AVAILABLE or not query_manager or not session_context:
             print("[Hata] Etkileşim başlatılamıyor.")
             return

        print("\n--- Soru Sor / Etkileşim ---")
        print("   (Ana menüye dönmek için 'menu' veya 'çıkış' yazın)")
        while True:
            try:
                query = input("Siz  : ").strip()
                if not query: continue
                if query.lower() in ['menu', 'menü', 'çıkış', 'cikis', 'exit', 'quit', '0']: break

                response = query_manager.process_query(query, session_context)
                print(f"Model: {response}")

            except (KeyboardInterrupt, EOFError):
                 print("\nEtkileşimden çıkılıyor...")
                 break
            except Exception as e:
                print(f"[Hata] Etkileşim sırasında: {e}")
                traceback.print_exc(limit=1)
                time.sleep(0.5)

    def _get_structured_input(prompt_message, input_type=str, allow_empty=True):
        """ Kullanıcıdan belirli tipte girdi alır, boşsa None döner. """
        while True:
            try:
                user_input = input(prompt_message).strip()
                if not user_input and allow_empty:
                    return None
                elif not user_input and not allow_empty:
                    print("Bu alan boş bırakılamaz.")
                    continue
                # Gerekirse burada tip dönüşümü veya validasyon yapılabilir
                if input_type == list:
                     # Virgülle ayrılmış girdiyi liste yap
                     return [item.strip() for item in user_input.split(',') if item.strip()]
                elif input_type == dict or input_type == list: # JSON için
                     try:
                          import json
                          return json.loads(user_input)
                     except json.JSONDecodeError:
                          print("Geçersiz JSON formatı. Tekrar deneyin.")
                          continue
                else: # Varsayılan string
                     return user_input
            except Exception as e:
                 print(f"Girdi alınırken hata: {e}")
                 return None # Hata durumunda None dön

    def handle_manual_add():
        """ Seçenek 2: Kullanıcıdan manuel olarak yeni yapılandırılmış bilgi alır. """
        if not MODULES_AVAILABLE or not data_handler:
            print("[Hata] Manuel ekleme başlatılamıyor.")
            return

        print("\n--- Yeni Bilgi Ekle (Manuel) ---")
        print("   Bilgi Türleri: gerçek, soru-cevap, kural, prosedür, kural_kumesi, hipotez_sablonu vb.")

        try:
            tur = _get_structured_input("Bilgi Türü (*zorunlu*): ", allow_empty=False)
            if not tur: return
            tur = tur.lower()

            metin = _get_structured_input("Metin/Açıklama/Cevap (Tür'e göre opsiyonel): ")
            kaynak = _get_structured_input("Kaynak (Opsiyonel, varsayılan: manuel): ") or "manuel_test_arayuzu"
            baglam_etiketleri_str = _get_structured_input("Bağlam Etiketleri (Virgülle Ayır, Opsiyonel): ")
            baglam_etiketleri = [etiket.strip() for etiket in baglam_etiketleri_str.split(',')] if baglam_etiketleri_str else []

            kwargs_to_add = {'baglam_etiketleri': baglam_etiketleri}

            # Tür'e göre ek alanları daha yapısal alalım
            if tur == 'soru-cevap':
                 soru = _get_structured_input("İlişkili Soru (*zorunlu*): ", allow_empty=False)
                 if not soru: return
                 if not metin: print("[Uyarı] Soru-Cevap için Cevap (Metin) girilmedi."); return
                 kwargs_to_add['soru_veya_anahtar'] = soru
            elif tur == 'kural':
                 kosul = _get_structured_input("Kural Koşulu (IF) (*zorunlu*): ", allow_empty=False)
                 sonuc = _get_structured_input("Kural Sonucu (THEN) (*zorunlu*): ", allow_empty=False)
                 if not kosul or not sonuc: return
                 kwargs_to_add['kural_kosulu'] = kosul
                 kwargs_to_add['kural_sonucu'] = sonuc
            elif tur == 'prosedür':
                 proc_adi = _get_structured_input("Prosedür Adı (*zorunlu*): ", allow_empty=False)
                 adimlar_list = _get_structured_input("Adımlar (Virgülle ayırın) (*zorunlu*): ", input_type=list, allow_empty=False)
                 if not proc_adi or not adimlar_list: return
                 kwargs_to_add['prosedur_adi'] = proc_adi
                 kwargs_to_add['adim_listesi'] = adimlar_list
            elif tur == 'kural_kumesi':
                 kume_id = _get_structured_input("Kural Kümesi ID (*zorunlu*): ", allow_empty=False)
                 # Kuralları JSON listesi olarak almayı deneyelim
                 kural_listesi = _get_structured_input("Kurallar (JSON Listesi, örn: [{'kosul':'..', 'sonuc':'..', 'oncelik':1}]): ", input_type=list, allow_empty=True)
                 if not kume_id: return
                 kwargs_to_add['kume_id'] = kume_id
                 if kural_listesi: kwargs_to_add['kurallar'] = kural_listesi # Yapılandırılmış veri
                 if not metin and not kural_listesi: print("[Uyarı] Kural kümesi için Metin veya Kural Listesi girilmedi.")
            elif tur == 'hipotez_sablonu':
                 sablon_id = _get_structured_input("Hipotez Şablon ID (*zorunlu*): ", allow_empty=False)
                 if not sablon_id: return
                 if not metin: print("[Uyarı] Hipotez Şablonu için Metin (şablon içeriği) girilmedi."); return
                 kwargs_to_add['sablon_id'] = sablon_id
                 # Şablonda kullanılacak tetikleyici koşullar vb. eklenebilir
                 # tetikleyici = _get_structured_input("Tetikleyici Koşul (Opsiyonel): ")
                 # if tetikleyici: kwargs_to_add['tetikleyici_kosul'] = tetikleyici
            else: # 'gerçek' veya diğer özel türler
                 anahtar = _get_structured_input("Anahtar Kelime/Başlık (Opsiyonel): ")
                 if anahtar: kwargs_to_add['soru_veya_anahtar'] = anahtar
                 if not metin: print("[Uyarı] Bu tür için Metin girilmedi.") # Tür'e göre zorunlu olabilir

            # İnteraktif eklenenler 'dogrulandi' kabul edilsin
            inserted_id = data_handler.add_bilgi_interactive(
                text=metin, tur=tur, kaynak=kaynak, validation_status="dogrulandi", **kwargs_to_add )

            if inserted_id: print(f"Bilgi başarıyla eklendi (ID: {inserted_id}).")
            else: print("Bilgi eklenirken bir sorun oluştu.")

        except Exception as e:
            print(f"[Hata] Manuel bilgi ekleme sırasında hata: {e}")
            traceback.print_exc(limit=1)

    def handle_validation(session_context):
        """ Seçenek 3: Kayıt doğrulama döngüsünü yönetir. """
        if not MODULES_AVAILABLE or not feedback_manager or not session_context or not ObjectId:
            print("[Hata] Kayıt doğrulama başlatılamıyor.")
            return

        print("\n--- Kayıt Doğrulama ---")
        skipped_in_this_validation_session = []

        while True:
            try:
                record = feedback_manager.get_record_for_validation(skip_ids=skipped_in_this_validation_session)
                if not record: print("\nDoğrulanacak uygun kayıt kalmadı."); break
                doc_id = record.get('_id'); doc_id_str = str(doc_id)

                print("\n" + "~"*20 + " Doğrulanacak Kayıt " + "~"*20)
                print(f" ID        : {doc_id_str}")
                print(f" Tür       : {record.get('tur', 'N/A')}")
                metin_kisalt = record.get('metin', '')
                if len(metin_kisalt) > 150: metin_kisalt = metin_kisalt[:150] + "..."
                print(f" Metin     : {metin_kisalt or '[BOŞ]'}")
                ek_alanlar = {k:v for k,v in record.items() if k not in ['_id', 'metin', 'vektor', 'tur', 'anahtar_kelimeler', 'kaynak', 'validation_status', 'baglam_etiketleri', 'eklenme_zamani', 'last_validated_ts', 'validated_by_session', 'score', 'relevance_score', 'found_by']}
                if ek_alanlar: print(f" Ek Alanlar: {ek_alanlar}")
                print(f" Kaynak    : {record.get('kaynak', 'N/A')}")
                print(f" Durum     : {record.get('validation_status', 'N/A')}")
                print("~"*58)

                feedback = input("Doğru mu? [E]vet/[H]ayır/[S]il(Anlamsız)/[A]tla/[M]enü: ").lower().strip()

                feedback_type = None; comment = None

                if feedback in ['e', 'evet']: feedback_type = "doğru"
                elif feedback in ['h', 'hayır']:
                    feedback_type = "hatalı"
                    comment = input("Yorum (opsiyonel): ").strip()
                elif feedback in ['s', 'sil', 'anlamsız']:
                    feedback_type = "anlamsız"
                    comment = input("Neden (opsiyonel): ").strip()
                elif feedback in ['a', 'atla']:
                    feedback_type = "atla"
                    if doc_id: skipped_in_this_validation_session.append(doc_id_str)
                elif feedback in ['m', 'menu']: print("Ana menüye dönülüyor..."); break
                else: print("Geçersiz seçim."); continue

                if feedback_type and feedback_type != "atla" and doc_id:
                    success = feedback_manager.log_and_update_feedback(
                        doc_id=doc_id, feedback_type=feedback_type,
                        session_id=session_context.get_session_id(), comment=comment )
                    if success: print(f"Geri bildirim ('{feedback_type}') işlendi.")
                    else: print("Geri bildirim işlenirken sorun oluştu.")
                elif feedback_type == "atla": print("Kayıt atlandı.")

                if feedback != 'm':
                    cont = input("Başka kayıt? (e/h): ").lower().strip()
                    if cont != 'e': print("Ana menüye dönülüyor..."); break

            except Exception as e:
                print(f"[Hata] Kayıt doğrulama döngüsünde hata: {e}")
                traceback.print_exc(limit=1); break


    def interactive_mode():
        """ Ana interaktif test modu döngüsü. """
        if not MODULES_AVAILABLE:
            print("[HATA] Modüller yüklenemediği için interaktif mod başlatılamıyor.")
            return

        current_session = None
        print("\n" + "*"*40); print(" İnteraktif Mod Başlatılıyor..."); print("*"*40)

        try:
            db_conn = database.get_db_connection()
            if not db_conn: raise Exception("Veritabanı bağlantısı kurulamadı.")
            if not nlp_processor.is_nlp_initialized:
                 if not nlp_processor.init_nlp(): raise Exception("NLP işlemcisi başlatılamadı.")

            print("\nOturum dilini belirlemek için ilk mesajınızı girin.")
            initial_query = input("İlk Mesajınız: ").strip()
            detected_lang = "tr"
            if initial_query:
                language_rules = database.get_language_rules()
                if not language_rules: print("[Uyarı] Dil kuralları bulunamadı, 'tr' kullanılacak.")
                detected_lang = language_processor.detect_language(initial_query, language_rules)
            else:
                print("Varsayılan dil 'tr' kullanılacak.")
            print(f"-> Oturum Dili: {detected_lang.upper()}")

            current_session = session_manager.SessionContext(language=detected_lang)

            if initial_query:
                print("\nİlk mesajınız işleniyor...")
                response = query_manager.process_query(initial_query, current_session)
                print(f"\nModel: {response}")

        except Exception as init_e:
            print(f"[KRİTİK HATA] Oturum başlatılırken hata: {init_e}")
            traceback.print_exc(limit=1)
            database.close_db_connection()
            return

        if current_session:
            while True:
                display_menu(current_session)
                try:
                    choice = input("Seçiminiz (0-3): ").strip()
                    if choice == '1': handle_interaction(current_session)
                    elif choice == '2': handle_manual_add()
                    elif choice == '3': handle_validation(current_session)
                    elif choice == '0': print("İnteraktif moddan çıkılıyor..."); break
                    else: print("Geçersiz seçim (0, 1, 2, 3).")
                except (KeyboardInterrupt, EOFError): print("\nÇıkış isteği algılandı..."); break
                except Exception as loop_e:
                    print(f"[HATA] Ana menü döngüsünde hata: {loop_e}")
                    traceback.print_exc(limit=1)
                    time.sleep(1)
        else:
             print("Oturum başlatılamadığı için menü gösterilemiyor.")

        database.close_db_connection()

    # --- Doğrudan Çalıştırma ---
    if __name__ == "__main__":
        print("--- Test Interface Modülü Başladı (Doğrudan Çalıştırma) ---")
        if MODULES_AVAILABLE:
             print("!!! BU SCRIPTI DOĞRUDAN ÇALIŞTIRMAK YERİNE 'python model.py test' KULLANIN !!!")
        else:
             print("Modülün çalışması için gerekli diğer modüller yüklenemedi.")
        print("\n--- Test Interface Modülü Tamamlandı ---")