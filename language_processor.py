# language_processor.py

import re

# Bu modül, kendisine verilen kurallara göre dil tespiti yapar.
# Kuralların şu formatta bir liste olduğu varsayılır:
# [
#   {"language": "<code>", "pattern": "<regex>", "priority": <number>},
#   ...
# ]
# Kuralların önceliğe göre (en yüksek önce) sıralanmış olarak
# fonksiyona verilmesi beklenir.

DEFAULT_LANGUAGE = "tr" # Eşleşme olmazsa veya hata olursa dönülecek dil

def detect_language(query, language_rules):
    """
    Verilen sorgu metnini, sağlanan dil kurallarına göre analiz eder
    ve en yüksek öncelikli eşleşen dil kodunu döndürür.

    Args:
        query (str): Analiz edilecek metin.
        language_rules (list): Dil kurallarını içeren liste
                               (önceliğe göre sıralı olması önerilir).

    Returns:
        str: Tespit edilen dil kodu (örn: 'tr', 'en') veya varsayılan dil.
    """
    if not query or not isinstance(query, str):
        return DEFAULT_LANGUAGE # Geçersiz sorgu için varsayılan

    if not language_rules or not isinstance(language_rules, list):
        # print("[Uyarı] Language Processor: Geçerli dil kuralı listesi sağlanmadı.")
        return DEFAULT_LANGUAGE # Kural yoksa varsayılan

    detected_language = DEFAULT_LANGUAGE # Varsayılanı ayarla

    for rule in language_rules:
        # Kural yapısını doğrula (opsiyonel ama güvenli)
        pattern = rule.get("pattern")
        language = rule.get("language")
        # priority = rule.get("priority", 0) # Sıralı geldiği varsayılırsa gerek yok

        if pattern and language:
            try:
                # Büyük/küçük harf duyarsız regex araması
                if re.search(pattern, query, re.IGNORECASE):
                    # İlk eşleşme en yüksek öncelikli olanıdır (sıralıysa)
                    detected_language = language
                    # Başarılı tespitten sonra döngüden çıkabiliriz
                    break
            except re.error as re_err:
                # Veritabanındaki kuralda geçersiz regex varsa uyar ve atla
                print(f"[Uyarı] Language Processor: Geçersiz regex deseni bulundu: Dil={language}, Desen='{pattern}', Hata: {re_err}")
                continue # Hatalı kuralı atla
            except Exception as e:
                print(f"[Hata] Language Processor: Kural işlenirken beklenmedik hata: {e}")
                # Belki bir sonraki kural çalışır? Şimdilik devam et.
                continue

    return detected_language

# --- Doğrudan Çalıştırma Testleri ---
if __name__ == "__main__":
    print("--- Language Processor Testi Başladı ---")

    # Test için sıralı örnek kurallar (normalde DB'den gelir)
    mock_rules_sorted = [
        {"language": "tr", "pattern": "[çÇğĞıİöÖşŞüÜ]", "priority": 10},
        {"language": "en", "pattern": "\\b(the|is|and|you)\\b", "priority": 5},
        {"language": "de", "pattern": "\\b(der|die|das|ist)\\b", "priority": 4},
        {"language": "fr", "pattern": "\\b(le|la|et|les)\\b", "priority": 4}, # Almanca ile aynı öncelik
    ]

    test_queries = [
        "Merhaba dünya, nasılsın?",
        "Hello world, how are you?",
        "Bu cümlede İngilizce kelime yok.",
        "Guten Tag, wie geht es Ihnen?",
        "The quick brown fox.",
        "Çok ilginç bir konu.",
        "12345 !?.", # Eşleşme olmaması durumu -> tr (varsayılan)
        "İngilizce the kelimesi var.", # Hem tr hem en eşleşir, tr (priority 10) kazanır
        "Le chat est sur la table.", # Hem en hem fr eşleşir, en (priority 5) kazanır
        "Der Hund ist schwarz.", # Sadece de (priority 4) eşleşir
        None, # Geçersiz girdi -> tr
        "",   # Boş girdi -> tr
    ]

    print("Kullanılan Kurallar (Önceliğe Göre Sıralı):")
    for r in mock_rules_sorted: print(f"  {r}")
    print("-" * 20)

    for query in test_queries:
        # Fonksiyona kuralları sıralı olarak gönder
        lang = detect_language(query, mock_rules_sorted)
        print(f"Sorgu: '{str(query)[:50]}' -> Algılanan Dil: {lang}")

    print("\nGeçersiz kuralla test:")
    # Geçersiz regex içeren kuralı başa koyalım (yüksek öncelikli gibi)
    invalid_rules = [{"language": "es", "pattern": "*invalidregex[", "priority": 11}] + mock_rules_sorted
    lang_invalid = detect_language("test", invalid_rules)
    print(f"Sorgu: 'test', Kural: {invalid_rules[0]} -> Algılanan Dil: {lang_invalid}") # Hata vermeli ama 'tr' dönmeli

    print("\nBoş kuralla test:")
    lang_empty = detect_language("test", [])
    print(f"Sorgu: 'test', Kural: [] -> Algılanan Dil: {lang_empty}")

    print("\n--- Language Processor Testi Tamamlandı ---")