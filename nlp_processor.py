# nlp_processor.py

import re
import numpy as np
import time
import traceback # Hata ayıklama

# Gerekli kütüphaneleri ve yapılandırmayı import etmeyi dene
try:
    # sentence-transformers setup.py ile kurulmuş olmalı
    from sentence_transformers import SentenceTransformer
    SENTENCE_TRANSFORMERS_AVAILABLE = True
except ImportError:
    print("[HATA] nlp_processor: 'sentence-transformers' kütüphanesi bulunamadı!")
    print("       Lütfen önce 'setup.py' script'ini başarıyla çalıştırdığınızdan emin olun.")
    SentenceTransformer = None
    SENTENCE_TRANSFORMERS_AVAILABLE = False

try:
    import config
    # Gerekli ayarların varlığını kontrol et
    required_nlp_configs = ['EMBEDDING_MODEL_NAME']
    missing_configs = [cfg for cfg in required_nlp_configs if not hasattr(config, cfg)]
    if missing_configs:
        raise AttributeError(f"config.py dosyasında şu NLP ayarları eksik: {', '.join(missing_configs)}")
    if not hasattr(config, 'VECTOR_DIMENSION'):
         print("[Uyarı] nlp_processor: config.py'de VECTOR_DIMENSION tanımlı değil.")
    MODULES_CONFIG_AVAILABLE = True
except ImportError:
    print("[HATA] nlp_processor: 'config.py' dosyası bulunamadı.")
    MODULES_CONFIG_AVAILABLE = False
    config = None
except AttributeError as e:
    print(f"[HATA] nlp_processor: config.py dosyasında beklenen ayar eksik: {e}")
    MODULES_CONFIG_AVAILABLE = False
    config = None
except Exception as e:
    print(f"[HATA] nlp_processor: config.py yüklenirken hata: {e}")
    MODULES_CONFIG_AVAILABLE = False
    config = None

# Global değişkenler: Yüklü modeli ve durumunu saklar
embedding_model = None
is_nlp_initialized = False
loaded_model_name = None

def init_nlp(model_name_override=None):
    """
    Gerekli embedding modelini yükler. Başarılı olursa True, olmazsa False döner.
    Ana uygulama başlarken bir kez çağrılmalıdır.
    """
    global embedding_model, is_nlp_initialized, loaded_model_name

    # Gerekli modüller yoksa veya zaten başarılı başlatılmışsa çık
    if not SENTENCE_TRANSFORMERS_AVAILABLE or not config: return False
    if is_nlp_initialized: return True

    # Yüklenecek model adını belirle (override > config > varsayılan)
    default_model = 'paraphrase-multilingual-mpnet-base-v2'
    model_to_load = model_name_override if model_name_override else getattr(config, 'EMBEDDING_MODEL_NAME', default_model)

    # Eğer zaten istenen model yüklüyse tekrar yükleme
    if embedding_model is not None and loaded_model_name == model_to_load:
        is_nlp_initialized = True
        return True

    # Modeli yüklemeyi dene
    try:
        print(f"[NLP Processor] Embedding modeli yükleniyor: {model_to_load}...")
        start_time = time.time()
        embedding_model = SentenceTransformer(model_to_load)
        loaded_model_name = model_to_load
        end_time = time.time()
        print(f"[NLP Processor] Embedding modeli '{model_to_load}' başarıyla yüklendi (Süre: {end_time - start_time:.2f} sn).")
        is_nlp_initialized = True
        return True
    except Exception as e:
        print(f"[HATA] Embedding modeli ('{model_to_load}') yüklenemedi! Hata Detayı: {e}")
        embedding_model = None
        is_nlp_initialized = False
        loaded_model_name = None
        return False

def get_embedding(text):
    """
    Verilen metnin anlamsal vektörünü hesaplar. NLP başlatılmamışsa veya hata oluşursa None döner.
    """
    global embedding_model, is_nlp_initialized
    if not is_nlp_initialized:
        print("[HATA] NLP işlemcisi başlatılmamış. 'init_nlp()' çağrılmalı.")
        return None

    if not text or not isinstance(text, str):
        return None

    try:
        vectors_np = embedding_model.encode([text], convert_to_numpy=True, show_progress_bar=False)
        return vectors_np[0].tolist()
    except Exception as e:
        print(f"[HATA] Embedding oluşturulamadı ('{text[:60]}...'): {e}")
        return None

def clean_text(text):
    """ Metni küçük harfe çevirir ve fazla boşlukları temizler. """
    if not text or not isinstance(text, str):
        return ""
    text = text.lower()
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def tokenize_text(text):
    """ Metni alfanümarik kelimelere ayırır. """
    if not text or not isinstance(text, str):
        return []
    return re.findall(r'\b\w+\b', text.lower())
