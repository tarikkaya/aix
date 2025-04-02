# session_manager.py

import uuid
from collections import deque

# Ayarları config dosyasından okumaya çalış
try:
    import config
    DEFAULT_HISTORY_LIMIT = getattr(config, 'HISTORY_LIMIT', 10)
except ImportError:
    print("[Uyarı] session_manager: 'config.py' bulunamadı veya HISTORY_LIMIT tanımlı değil. Varsayılan limit (10) kullanılacak.")
    DEFAULT_HISTORY_LIMIT = 10
except AttributeError:
    print("[Uyarı] session_manager: config.py'de HISTORY_LIMIT tanımlı değil. Varsayılan limit (10) kullanılacak.")
    DEFAULT_HISTORY_LIMIT = 10


class SessionContext:
    """
    Uygulamanın tek bir çalışması (oturumu) için bağlamı yönetir.
    Oturum ID'si, dil ve bellek içi konuşma geçmişi tamponunu tutar.
    """
    def __init__(self, session_id=None, language="tr", history_limit=None):
        self.session_id = session_id if session_id else str(uuid.uuid4())
        self.language = language
        # Yapılandırmadan veya parametreden limit al, yoksa varsayılanı kullan
        effective_limit = history_limit if history_limit is not None else DEFAULT_HISTORY_LIMIT
        # deque, sabit boyutlu FIFO (ilk giren ilk çıkar) listeler için verimlidir
        self.history = deque(maxlen=effective_limit)
        self.history_limit = effective_limit
        # print(f"[SessionManager] Yeni oturum: ID={self.session_id}, Dil={self.language}, Limit={self.history_limit}")

    def add_entry(self, query, response):
        """
        Bellek içi geçmiş tamponuna yeni bir sorgu-cevap çifti ekler.
        Eğer tampon doluysa en eski kayıt otomatik olarak silinir.
        """
        entry = {"query": query, "response": response}
        self.history.append(entry)

    def get_recent_history(self, num_turns=None):
        """
        İstenen sayıda veya mevcut tüm geçmişi (en yeniden en eskiye)
        bir liste olarak döndürür.
        """
        if not hasattr(self, 'history'): return []

        if num_turns is None or num_turns >= len(self.history):
            # deque'yi listeye çevirirken sıra korunur (en eski başta, en yeni sonda)
            return list(self.history)
        else:
            # Son 'num_turns' adedini al
            return list(self.history)[-num_turns:]

    def get_formatted_history(self, num_turns=None):
        """
        Geçmişi, her sorgu ve yanıt yeni satırda olacak şekilde
        basit bir metin olarak formatlar.
        """
        recent_history = self.get_recent_history(num_turns)
        if not recent_history:
            return ""

        formatted_lines = []
        for entry in recent_history:
            q = entry.get('query', '[sorgu eksik]')
            # Yanıt uzun olabilir, sadece ilk satırı veya bir kısmını almak isteyebiliriz
            r_full = entry.get('response', '[yanıt eksik]')
            r_short = r_full.split('\n')[0] # Sadece ilk satır
            # r_short = (r_full[:100] + '...') if len(r_full) > 100 else r_full # Veya ilk 100 karakter
            formatted_lines.append(f"Kullanıcı: {q}")
            formatted_lines.append(f"Model: {r_short}")
        return "\n".join(formatted_lines)

    def set_language(self, lang):
        """ Oturum dilini ayarlar veya günceller. """
        # print(f"[SessionManager] Oturum dili değiştirildi: {self.language} -> {lang}")
        self.language = lang

    def get_language(self):
        """ Mevcut oturum dilini döndürür. """
        return self.language

    def get_session_id(self):
        """ Mevcut oturum ID'sini döndürür. """
        return self.session_id

# --- Doğrudan Çalıştırma Testleri ---
if __name__ == "__main__":
    print("--- SessionContext Testi Başladı ---")
    # Test için config'den bağımsız limit kullanalım
    test_limit = 3
    context = SessionContext(session_id="test-session-002", language="en", history_limit=test_limit)

    print(f"Oturum ID       : {context.get_session_id()}")
    print(f"Başlangıç Dili  : {context.get_language()}")
    print(f"Geçmiş Limiti : {context.history_limit}")

    print("\nGeçmişe eklemeler yapılıyor...")
    context.add_entry("Entry 1 Q", "Entry 1 A")
    context.add_entry("Entry 2 Q", "Entry 2 A\nBu ikinci satır.")
    context.add_entry("Entry 3 Q", "Entry 3 A")
    # Dördüncü ekleme ilkini (Entry 1) çıkaracak (limit 3)
    context.add_entry("Entry 4 Q", "Entry 4 A")
    print("Ekleme tamamlandı.")


    print("\n--- Son 3 Konuşma (Liste Formatı) ---")
    # Limit 3 olduğu için 2, 3, 4'ü görmeliyiz
    print(context.get_recent_history())

    print("\n--- Son 2 Konuşma (Formatlı Metin) ---")
    # Son 2 yani 3 ve 4'ü görmeliyiz
    print(context.get_formatted_history(num_turns=2))

    print("\n--- Tüm Geçmiş Tamponu (Formatlı Metin - Limitli) ---")
    # Limit 3 olduğu için son 3'ü (2, 3, 4) görmeliyiz
    print(context.get_formatted_history())

    context.set_language("tr")
    print(f"\nDeğiştirilen Dil : {context.get_language()}")
    print("\n--- SessionContext Testi Tamamlandı ---")