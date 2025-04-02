# session_manager.py

import uuid
from collections import deque

# Ayarları config dosyasından okumaya çalış, yoksa varsayılan kullan
try:
    import config
    # getattr kullanarak HISTORY_LIMIT'in varlığını kontrol et ve varsayılan ata
    DEFAULT_HISTORY_LIMIT = getattr(config, 'HISTORY_LIMIT', 10)
    # Gelen değerin geçerli bir integer olup olmadığını kontrol et
    if not isinstance(DEFAULT_HISTORY_LIMIT, int) or DEFAULT_HISTORY_LIMIT <= 0:
         # print(f"[Uyarı] config.py'deki HISTORY_LIMIT ({DEFAULT_HISTORY_LIMIT}) geçersiz, varsayılan 10 kullanılacak.")
         DEFAULT_HISTORY_LIMIT = 10
except ImportError:
    # print("[Uyarı] session_manager: 'config.py' bulunamadı. Varsayılan HISTORY_LIMIT (10) kullanılacak.")
    DEFAULT_HISTORY_LIMIT = 10
except Exception as e:
    # print(f"[Hata] session_manager: config.py okunurken hata: {e}. Varsayılan HISTORY_LIMIT (10) kullanılacak.")
    DEFAULT_HISTORY_LIMIT = 10


class SessionContext:
    """
    Uygulamanın tek bir çalışması (oturumu) için bağlamı yönetir.
    Oturum ID'si, dil ve bellek içi konuşma geçmişi tamponunu tutar.
    """
    def __init__(self, session_id=None, language="tr", history_limit=None):
        # Benzersiz oturum ID'si
        self.session_id = session_id if session_id and isinstance(session_id, str) else str(uuid.uuid4())
        # Oturum dili
        self.language = language if isinstance(language, str) and language else "tr"
        # Geçmiş limiti (parametre > config > varsayılan)
        effective_limit = history_limit if isinstance(history_limit, int) and history_limit > 0 else DEFAULT_HISTORY_LIMIT
        self.history_limit = effective_limit
        # Sabit boyutlu geçmiş tamponu
        self.history = deque(maxlen=self.history_limit)

    def add_entry(self, query, response):
        """ Bellek içi geçmiş tamponuna yeni bir sorgu-cevap çifti ekler. """
        query_str = str(query) if query is not None else ""
        response_str = str(response) if response is not None else ""
        entry = {"query": query_str, "response": response_str}
        self.history.append(entry)

    def get_recent_history(self, num_turns=None):
        """ İstenen sayıda veya mevcut tüm geçmişi liste olarak döndürür. """
        if not hasattr(self, 'history'): return []
        if num_turns is None or not isinstance(num_turns, int) or num_turns <= 0 or num_turns >= len(self.history):
            return list(self.history)
        else:
            return list(self.history)[-num_turns:] # Son N eleman

    def get_formatted_history(self, num_turns=None):
        """ Geçmişi basit bir 'Kullanıcı:' / 'Model:' metin formatında döndürür. """
        recent_history = self.get_recent_history(num_turns)
        if not recent_history: return ""
        formatted_lines = []
        for entry in recent_history:
            q = entry.get('query', '')
            r_full = entry.get('response', '')
            r_short = r_full.split('\n', 1)[0] # Sadece ilk satır
            formatted_lines.append(f"Kullanıcı: {q}")
            formatted_lines.append(f"Model: {r_short}")
        return "\n".join(formatted_lines)

    def set_language(self, lang):
        """ Oturum dilini günceller (geçerli string ise). """
        if isinstance(lang, str) and lang:
            self.language = lang

    def get_language(self):
        """ Mevcut oturum dilini döndürür. """
        return getattr(self, 'language', 'tr')

    def get_session_id(self):
        """ Mevcut oturum ID'sini döndürür. """
        return getattr(self, 'session_id', 'ID_YOK')

# --- Doğrudan Çalıştırma Testleri ---
if __name__ == "__main__":
    print("--- SessionContext Testi Başladı ---")
    test_limit = 3
    test_id = "test-session-final"
    context = SessionContext(session_id=test_id, language="en", history_limit=test_limit)

    print(f"Oturum ID       : {context.get_session_id()}")
    print(f"Başlangıç Dili  : {context.get_language()}")
    print(f"Geçmiş Limiti : {context.history_limit}")

    context.add_entry("Q1", "A1")
    context.add_entry("Q2", "A2")
    context.add_entry("Q3", "A3")
    context.add_entry("Q4", "A4") # İlkini (Q1) çıkarır

    print("\n--- Son 3 Konuşma (Liste) ---")
    history_list = context.get_recent_history()
    print(history_list)
    assert len(history_list) == 3 and history_list[0]['query'] == 'Q2'

    print("\n--- Son 2 Konuşma (Formatlı) ---")
    formatted_2 = context.get_formatted_history(num_turns=2)
    print(formatted_2)
    assert "Q3" in formatted_2 and "Q4" in formatted_2 and "Q2" not in formatted_2

    print("\n--- Tüm Geçmiş (Formatlı - Limitli) ---")
    formatted_all = context.get_formatted_history()
    print(formatted_all)
    assert len(formatted_all.split('\n')) == 6 and "Q1" not in formatted_all

    context.set_language("tr")
    print(f"\nDeğiştirilen Dil : {context.get_language()}")

    print("--- SessionContext Testi Tamamlandı ---")