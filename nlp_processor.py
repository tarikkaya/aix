# nlp_processor.py

import re
import numpy as np
import time # Model yükleme süresini ölçmek için

# Gerekli kütüphaneleri import etmeyi dene
try:
    from sentence_transformers import SentenceTransformer
    SENTENCE_TRANSFORMERS_AVAILABLE = True
except ImportError:
    print("[HATA] nlp_processor: 'sentence-transformers' kütüphanesi bulunamadı.")
    print("       Lütfen önce 'setup.py' script'ini çalıştırarak veya manuel olarak")
    print("       'pip install sentence-transformers torch' (veya tensorflow) komutu ile yükleyin.")
    SentenceTransformer = None # Hata durumunda None ata
    SENTENCE_TRANSFORMERS_AVAILABLE = False

# Yapılandırma dosyasını import etmeyi dene
try:
    import config
except ImportError:
    print("[HATA] nlp_processor: 'config.py' dosyası bulunamadı.")
    # Varsayılan model adı ile devam etmeyi dene ama uyarı ver
    DEFAULT_MODEL = 'paraphrase-multilingual-mpnet-base-v2'
    config = type('obj', (object,), {'EMBEDDING_MODEL_NAME': DEFAULT_MODEL})()
    print(f"[UYARI] Varsayılan embedding modeli kullanılacak: {DEFAULT_MODEL}")

# Global değişken olarak model nesnesini tutalım
embedding_model = None
is_nlp_initialized = False

def init_nlp(model_name=None):
    """
    Gerekli embedding modelini yükler ve kullanıma hazırlar.
    Ana uygulama başlarken bir kere çağrılmalıdır. Hata durumunda False döner.
    """
    global embedding_model, is_nlp_initialized
    # Kütüphane yoksa veya zaten başarılı yüklendiyse tekrar deneme
    if not SENTENCE_TRANSFORMERS_AVAILABLE:
        return False
    if is_nlp_initialized:
        return True

    # Kullanılacak model adını belirle (parametre > config > varsayılan)
    model_to_load = model_name if model_name else getattr(config, 'EMBEDDING_MODEL_NAME', 'paraphrase-multilingual-mpnet-base-v2')

    try:
        print(f"[NLP Processor] Embedding modeli yükleniyor: {model_to_load}...")
        start_time = time.time()
        # Modeli yükle (cihaz otomatik seçilir: GPU/CPU)
        embedding_model = SentenceTransformer(model_to_load)
        end_time = time.time()
        print(f"[NLP Processor] Embedding modeli '{model_to_load}' başarıyla yüklendi (Süre: {end_time - start_time:.2f} saniye).")
        is_nlp_initialized = True
        return True
    except Exception as e:
        print(f"[HATA] Embedding modeli ('{model_to_load}') yüklenemedi: {e}")
        print("       Model adının doğru olduğundan ve gerekli dosyaların")
        print("       Hugging Face Hub'dan indirilebildiğinden (internet bağlantısı?) emin olun.")
        embedding_model = None
        is_nlp_initialized = False
        return False

def get_embedding(text):
    """
    Verilen metnin anlamsal vektör temsilini (embedding) hesaplar.
    Başarısız olursa None döner.
    """
    global embedding_model, is_nlp_initialized
    if not is_nlp_initialized or embedding_model is None:
        print("[HATA] NLP işlemcisi (embedding modeli) başlatılmamış veya yüklenememiş.")
        # Otomatik yüklemeyi burada denememek genellikle daha iyidir, ana akışı kontrol eder.
        return None

    if not text or not isinstance(text, str):
        # print("[Uyarı] Geçersiz metin girdisi, embedding hesaplanamıyor.")
        return None

    try:
        # encode metodu genellikle liste alır ve numpy array listesi veya tensör döndürür
        # Tek metin için tek elemanlı liste verip sonucun ilk elemanını alalım
        vectors = embedding_model.encode([text], convert_to_numpy=True)
        vector_np = vectors[0]
        # MongoDB ve genel Python kullanımı için list of floats formatı daha uygun
        vector_list = vector_np.tolist()
        return vector_list
    except Exception as e:
        print(f"[HATA] Metin için embedding oluşturulamadı ('{text[:50]}...'): {e}")
        return None

def clean_text(text):
    """
    Metin üzerinde basit temizleme işlemleri uygular (küçük harf, fazla boşluk).
    """
    if not text or not isinstance(text, str):
        return ""
    text = text.lower()
    # Birden fazla boşluğu tek boşluğa indirir ve baştaki/sondaki boşlukları alır
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def tokenize_text(text):
    """
    Metni basitçe kelimelere (tokenlara) ayırır. Sadece harf ve rakam içerenler.
    """
    if not text or not isinstance(text, str):
        return []
    # \b kelime sınırlarını belirtir, \w harf, rakam veya _ karakteridir.
    tokens = re.findall(r'\b\w+\b', text.lower())
    return tokens

# --- Doğrudan Çalıştırma Testleri ---
if __name__ == "__main__":
    print("--- NLP Processor Testi Başladı ---")

    # Modeli yüklemeyi dene
    model_loaded = init_nlp()

    if model_loaded:
        print("\n--- Embedding Testi ---")
        test_texts = [
            "Bu bir test cümlesidir.",
            "Anlamsal vektörler nasıl çalışır?",
            "Selam nasılsın?",
            "Niye bunu yapıyorsun böyle yapmanı söylemedim.",
            "MongoDB ve PyMongo arasındaki fark nedir?"
        ]
        for text in test_texts:
            vector = get_embedding(text)
            if vector:
                try:
                    # config dosyasından beklenen boyutu almayı dene
                    expected_dim = getattr(config, 'VECTOR_DIMENSION', 'Bilinmiyor')
                except NameError: # config import edilemediyse
                    expected_dim = 'Bilinmiyor'

                print(f"Metin: '{text}'")
                print(f"  -> Vektör Boyutu: {len(vector)} (Beklenen: {expected_dim})")
                # İlk 3 elemanı 4 ondalık basamakla gösterelim
                print(f"  -> İlk 3 Eleman: {[f'{x:.4f}' for x in vector[:3]]}")
            else:
                print(f"Metin: '{text}' -> Vektör oluşturulamadı.")

        print("\n--- Metin Temizleme Testi ---")
        dirty_text = "   Bu    ÇOK    fazla   Boşluk İçeren BİR Metin!!!   "
        cleaned = clean_text(dirty_text)
        print(f"Orijinal     : '{dirty_text}'")
        print(f"Temizlenmiş  : '{cleaned}'")

        print("\n--- Tokenizasyon Testi ---")
        text_to_tokenize = "Merhaba dünya, bu 123 sayılı test."
        tokens = tokenize_text(text_to_tokenize)
        print(f"Metin        : '{text_to_tokenize}'")
        print(f"Tokenlar     : {tokens}")

    else:
        print("\nNLP İşlemcisi başlatılamadığı için testler yapılamadı.")
        print("   Lütfen 'sentence-transformers' ve bağımlılıklarının (torch/tensorflow) kurulu olduğundan emin olun.")

    print("\n--- NLP Processor Testi Tamamlandı ---")