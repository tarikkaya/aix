# config.py

# --- MongoDB Ayarları ---
MONGO_URI = "mongodb://localhost:27017/"
DB_NAME = "dinamik_bilgi_modeli_v3" # Veritabanı adı güncellenebilir

# Koleksiyon Adları
COLLECTION_BILGI = "bilgi_parcaciklari"
COLLECTION_SOHBET = "sohbet_gecmisi"
COLLECTION_GERIBILDIRIM = "geri_bildirimler"
COLLECTION_DIL_KURALLARI = "dil_kurallari"
COLLECTION_KURAL_KUMELERI = "kural_kumeleri" # Artık daha yapısal kurallar içerebilir
COLLECTION_HIPOTEZ_SABLONLARI = "hipotez_sablonlari" # Artık tetikleyiciler içerebilir
COLLECTION_YANIT_SABLONLARI = "yanit_sablonlari" # Jinja2 formatında içerik

# --- Kurulum Ayarları (`setup.py` için) ---
REQUIRED_PACKAGES = [
    'pymongo>=4.0',
    'sentence-transformers>=2.2.0',
    'numpy>=1.20.0',
    'torch>=1.6.0', # veya 'tensorflow'
    'Jinja2>=3.0'  # YENİ EKLENDİ - Yanıt şablonları için
    # 'spacy>=3.0' # Opsiyonel: Gelişmiş NLP için eklenebilir
]
# Opsiyonel: spacy model indirme komutu eklenebilir
# SPACY_MODEL_DOWNLOAD_COMMAND = "python -m spacy download tr_core_news_sm"

DEFAULT_LANGUAGE_RULES = [
    {"language": "tr", "pattern": "[çÇğĞıİöÖşŞüÜ]", "priority": 10},
    {"language": "en", "pattern": "\\b(the|is|and|you|are|was|it|of|to|in|that)\\b", "priority": 5},
]

# Varsayılan Yanıt Şablonları (Jinja2 Formatında Örnekler)
DEFAULT_RESPONSE_TEMPLATES = [
    {"sablon_adi": "Genel Fallback", "sablon_icerigi": "Üzgünüm, bu konuda bir bilgim yok. {{ data.get('sebep', '') }}", "uygun_turler": ["fallback"], "etiketler": [], "kaynak": "varsayilan_v3"},
    {"sablon_adi": "Basit Gerçek", "sablon_icerigi": "{{ data.metin }}", "uygun_turler": ["gerçek", "fact_found"], "etiketler": ["kısa"], "kaynak": "varsayilan_v3"},
    {"sablon_adi": "Detaylı Gerçek", "sablon_icerigi": "Bulunan bilgi: {{ data.metin }}\nKaynak: {{ data.get('kaynak', 'Bilinmiyor') }}\nDurum: {{ data.get('validation_status', 'N/A') }}", "uygun_turler": ["gerçek", "fact_found"], "etiketler": ["uzun", "detaylı"], "kaynak": "varsayilan_v3"},
    {"sablon_adi": "Basit Soru Cevap", "sablon_icerigi": "{{ data.metin }}", "uygun_turler": ["soru-cevap", "qa_found"], "etiketler": [], "kaynak": "varsayilan_v3"},
    {"sablon_adi": "Prosedür", "sablon_icerigi": "**{{ data.prosedur_adi }}** Prosedürü:\n{% for adim in data.adim_listesi %}- {{ adim }}\n{% endfor %}", "uygun_turler": ["prosedür", "procedure_found"], "etiketler": [], "kaynak": "varsayilan_v3"},
    {"sablon_adi": "Kural Sonucu", "sablon_icerigi": "Kural Uygulandı ({{ data.get('kural_id', data.get('kume_id', 'ID Yok')) }}): {{ data.sonuc }}", "uygun_turler": ["rule_set_applied", "rule_applied"], "etiketler": [], "kaynak": "varsayilan_v3"},
    {"sablon_adi": "Hipotez", "sablon_icerigi": "Bir hipotez/öneri: {{ data.hipotez }}", "uygun_turler": ["hypothesis_generated"], "etiketler": [], "kaynak": "varsayilan_v3"},
]


# --- NLP Ayarları (`nlp_processor.py` için) ---
EMBEDDING_MODEL_NAME = 'paraphrase-multilingual-mpnet-base-v2'
VECTOR_DIMENSION = 768
# Opsiyonel: Gelişmiş NLP için model adı
# SPACY_MODEL_NAME = 'tr_core_news_sm'

# --- Oturum Yönetimi Ayarları (`session_manager.py` için) ---
HISTORY_LIMIT = 15 # Biraz artırıldı
HISTORY_RELEVANCE_THRESHOLD = 0.6 # Bağlam için geçmiş benzerlik eşiği (embedding)

# --- Sorgu Yönetimi Ayarları (`query_manager.py` için) ---
CONTEXT_RESULT_LIMIT = 7 # Bağlamdaki max belge
CONTEXT_CANDIDATE_LIMIT = 30 # Sıralama için aday sayısı
VALIDATED_INFO_MULTIPLIER = 2.0
PENDING_INFO_MULTIPLIER = 1.0
RULE_MATCH_BONUS = 1.5 # Kural eşleşme skoru bonusu
TEMPLATE_MATCH_BONUS = 1.2 # Şablon eşleşme skoru bonusu
HISTORY_SIMILARITY_WEIGHT = 0.5 # Geçmiş benzerliğinin bağlam skoruna etkisi
KEYWORD_LIMIT = 25

# --- Geri Bildirim Ayarları (`feedback_manager.py` ve adaptasyon için) ---
VALIDATION_STRATEGY = "bekliyor_sonra_en_eski"
# FEEDBACK_ADAPTATION_RATE = 0.1

# --- Diğer Uygulama Ayarları ---
DEFAULT_FALLBACK_RESPONSE = "Yanıt bulunamadı veya istek işlenemedi."
DB_PING_INTERVAL = 60
DB_SERVER_TIMEOUT = 5000
DB_CONNECT_TIMEOUT = 5000
DB_SOCKET_TIMEOUT = 10000