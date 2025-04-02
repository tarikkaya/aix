# task_manager.py

# Gerekli modülleri import et
try:
    # Bu modül, her adımı işlemek için query_manager'ı kullanacak
    import query_manager
    # Oturum bağlamını yönetmek için session_manager'a ihtiyaç duyar (parametre olarak alır)
    import session_manager
    MODULES_AVAILABLE = True
    print("[Task Manager] Gerekli modüller başarıyla yüklendi.")
except ImportError as e:
    print(f"[HATA] task_manager: Gerekli modüller ('query_manager', 'session_manager') yüklenemedi: {e}")
    MODULES_AVAILABLE = False
    query_manager = None # Hata durumunda None ata
    session_manager = None

def execute_multi_step_task(task_steps, session_context):
    """
    Verilen görev adımlarını (task_steps) sırayla işler. Her adım için
    query_manager.process_query fonksiyonunu aynı session_context ile çağırır.
    Sonuçları birleştirerek döndürür.

    Args:
        task_steps (list[str]): Kullanıcı tarafından sağlanan görev adımları listesi.
        session_context (SessionContext): Aktif oturum bağlam nesnesi.

    Returns:
        str: Tüm adımların işlenmesi sonucu oluşan birleşik yanıt metni.
    """
    if not MODULES_AVAILABLE or not query_manager or not session_context:
        return "[HATA] Görev yöneticisi başlatılamadı veya gerekli modüller eksik."

    if not task_steps or not isinstance(task_steps, list):
        return "[HATA] Geçerli görev adımı listesi (list[str]) sağlanmadı."
    if not isinstance(session_context, session_manager.SessionContext):
         return "[HATA] Geçerli bir SessionContext nesnesi sağlanmadı."


    print(f"\n--- Çok Adımlı Görev Başlatılıyor ({len(task_steps)} Adım) ---")
    step_results_text = [] # Her adımın metin sonucunu saklamak için liste

    # Adımları sırayla işle
    for index, step_query in enumerate(task_steps):
        step_number = index + 1
        # Adımın boş olmadığından emin ol
        current_step_query = step_query.strip()
        if not current_step_query:
            print(f"\n[Adım {step_number}/{len(task_steps)}] Atlanıyor (Boş adım).")
            step_results_text.append(f"--- Adım {step_number} (Boş) ---")
            continue

        print(f"\n[Adım {step_number}/{len(task_steps)}] İşleniyor: '{current_step_query[:100]}...'")

        # Her adımı, aynı oturum bağlamını kullanarak ana sorgu işlemcisine gönder.
        # process_query, session_context'i hem okuyacak hem de güncelleyecektir.
        try:
            step_response = query_manager.process_query(current_step_query, session_context)
        except Exception as e:
             print(f"[HATA] Adım {step_number} işlenirken hata oluştu: {e}")
             step_response = f"[Adım {step_number} Hatası: {e}]"

        # Sonucu logla ve listeye ekle
        # print(f"[Adım {step_number} Ham Sonucu]: {step_response[:200]}...") # Debug
        step_results_text.append(f"--- Adım {step_number} ('{current_step_query}') Sonucu ---\n{step_response}")

    # Tüm adımların sonuçlarını birleştir (Basit birleştirme: araya ayraç koy)
    # --- GEREKLİ: Daha akıllı bir sentezleme/özetleme mantığı eklenebilir ---
    # Örneğin, sadece son adımın sonucunu döndürmek veya özel bir özet fonksiyonu çağırmak.
    final_combined_result = "\n\n".join(step_results_text)
    print("\n--- Çok Adımlı Görev Tamamlandı ---")

    return final_combined_result

# --- Doğrudan Çalıştırma Testleri ---
if __name__ == "__main__":
    print("--- Task Manager Testi Başladı ---")
    print("    (Bu test için sahte query_manager ve session_manager kullanılacak)")

    # Sahte modüller oluştur
    if not MODULES_AVAILABLE:
        class MockSession:
            def __init__(self, session_id="test-task-sid", language='tr'):
                self.history = deque(maxlen=5) # Test için küçük limit
                self.language = language
                self.session_id = session_id
            def get_recent_history(self): return list(self.history)
            def get_language(self): return self.language
            def get_session_id(self): return self.session_id
            def add_entry(self, q, r): self.history.append({'query': q, 'response': r})
            def get_formatted_history(self): return "\n".join([f"Q:{e['query']}-A:{e['response']}" for e in self.history])

        session_manager = type('obj', (object,), {'SessionContext': MockSession})()

        class MockQueryManager:
            call_count = 0
            def process_query(self, query, session_ctx, prompt_definition=None):
                self.call_count += 1
                print(f"    -> [Sahte QM] process_query çağrıldı ({self.call_count}. kez): '{query}'")
                # Basitçe sorguyu tekrar et + adım sırasını ve geçmiş durumunu ekle
                history_summary = session_ctx.get_formatted_history()
                response = f"'{query}' için üretilen {self.call_count}. cevap.\n    Önceki Adımlar Özeti:\n    {history_summary}"
                # Oturum geçmişini güncelle (process_query'nin normalde yaptığı gibi)
                session_ctx.add_entry(query, response)
                return response
        query_manager = MockQueryManager()
        MODULES_AVAILABLE = True

    # Test senaryosu
    test_session = session_manager.SessionContext()
    test_steps = [
        "Türkiye'nin başkenti neresidir?",
        "Peki Ankara'nın nüfusu kaçtır? (Bu bilgi sahte QM'de yok)",
        "İlk sorduğum soru neydi?" # Bağlamı kullanıp cevap üretebilir mi?
    ]

    print("\nTest görevi adımları:")
    for i, step in enumerate(test_steps): print(f"  {i+1}. {step}")

    final_result = execute_multi_step_task(test_steps, test_session)

    print("\n" + "="*30)
    print("--- Nihai Birleşik Görev Sonucu ---")
    print(final_result)
    print("="*30)


    print("\n--- Oturum Geçmişi Son Durumu (Simülasyon) ---")
    print(test_session.get_formatted_history())


    print("\n--- Task Manager Testi Tamamlandı ---")