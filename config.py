# config.py

# --- MongoDB Ayarları ---
MONGO_URI = "mongodb://localhost:27017/"
DB_NAME = "dinamik_bilgi_modeli" # Veritabanı adı

# Koleksiyon Adları
COLLECTION_BILGI = "bilgi_parcaciklari"      # Ana bilgi (metin, vektör, tür, vb.)
COLLECTION_SOHBET = "sohbet_gecmisi"        # Oturum bazlı konuşma geçmişi
COLLECTION_GERIBILDIRIM = "geri_bildirimler"  # Kullanıcı geri bildirimleri
COLLECTION_DIL_KURALLARI = "dil_kurallari"   # Dil tespiti için kurallar

# --- Kurulum Ayarları (`setup.py` için) ---
# Kurulum sırasında kontrol edilecek ve eksikse yüklenecek paketler
REQUIRED_PACKAGES = [
    'pymongo>=4.0',              # MongoDB bağlantısı için (versiyon belirtmek iyi olabilir)
    'sentence-transformers>=2.2.0',# Vektör embedding modeli için
    'numpy>=1.20.0',             # Sayısal işlemler (embedding sonucu)
    'torch>=1.6.0'               # sentence-transformers'ın genellikle gereksinimi (veya tensorflow)
    # İleride eklenebilecekler: 'spacy', 'requests', 'beautifulsoup4'
]

# 'dil_kurallari' koleksiyonuna eklenecek varsayılan kurallar
DEFAULT_LANGUAGE_RULES = [
    # Öncelik ne kadar yüksekse, o kural o kadar önce denenir
    {"language": "tr", "pattern": "[çÇğĞıİöÖşŞüÜ]", "priority": 10}, # Türkçe karakterler
    {"language": "en", "pattern": "\\b(the|is|and|you|are|was|it|of|to|in|that)\\b", "priority": 5}, # Yaygın İngilizce kelimeler
]

# --- NLP Ayarları (`nlp_processor.py` için) ---
# Kullanılacak Sentence Transformer modeli adı (Hugging Face Hub'dan)
EMBEDDING_MODEL_NAME = 'paraphrase-multilingual-mpnet-base-v2'
# Seçilen modelin ürettiği vektörlerin boyutu (MongoDB vektör indeksi için önemli)
# 'paraphrase-multilingual-mpnet-base-v2' modeli 768 boyutlu vektörler üretir.
# Farklı bir model seçerseniz bu değeri güncellemelisiniz.
VECTOR_DIMENSION = 768

# --- Oturum Yönetimi Ayarları (`session_manager.py` için) ---
# Bellekte tutulacak maksimum konuşma çifti sayısı (kullanıcı girdisi + model yanıtı)
HISTORY_LIMIT = 10

# --- Diğer Uygulama Ayarları ---
# Örn: Varsayılan yanıtlar, zaman aşımları vb. ileride buraya eklenebilir.
DEFAULT_FALLBACK_RESPONSE = "Bu konuda bilgim yok veya sorunuzu tam olarak işleyemedim."