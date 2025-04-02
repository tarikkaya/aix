# language_processor.py

import re
import logging

# Loglama ayarları
logging.basicConfig(level=logging.WARNING, format="%(levelname)s: %(message)s")

DEFAULT_LANGUAGE = "tr"  # Varsayılan dil

def compile_rules(language_rules):
    """
    Dil kurallarını önceden derleyerek regex hatalarını en baştan yakalar.
    """
    compiled_rules = []
    for rule in language_rules:
        try:
            pattern = rule.get("pattern")
            language = rule.get("language")
            if pattern and language:
                compiled_rules.append({
                    "language": language,
                    "pattern": re.compile(pattern, re.IGNORECASE)
                })
        except re.error as e:
            logging.warning(f"Geçersiz regex deseni atlandı: Dil={language}, Hata: {e}")
    return compiled_rules

def detect_language(query, language_rules, default_language=DEFAULT_LANGUAGE):
    """
    Verilen sorgu metnini, sağlanan dil kurallarına göre analiz eder.
    """
    if not query or not isinstance(query, str):
        return default_language
    if not language_rules or not isinstance(language_rules, list):
        return default_language
    
    compiled_rules = compile_rules(language_rules)
    
    for rule in compiled_rules:
        if rule["pattern"].search(query):
            return rule["language"]
    
    return default_language

if __name__ == "__main__":
    print("--- Language Processor Testi Başladı ---")

    mock_rules_sorted = [
        {"language": "tr", "pattern": "[çÇğĞıİöÖşŞüÜ]"},
        {"language": "en", "pattern": r"\b(?:the|is|and|you|are|was)\b"},
        {"language": "de", "pattern": r"\b(?:der|die|das|ist)\b"},
        {"language": "fr", "pattern": r"\b(?:le|la|et|les)\b"},
        {"language": "es", "pattern": r"\b(?:el|la|que|es)\b"},
    ]

    test_queries = [
        "Bu Türkçe bir sorgu.",
        "This is an English sentence.",
        "Das ist eine deutsche Anfrage.",
        "Ceci est une requête française.",
        "Esta es una consulta en español.",
        "Mixte: le français and Türkçe.",
        "Mixte: the English y el español.",
        "Der Tisch et la table.",
        "Sadece sayılar: 123456",
        None,
        "",
    ]

    for query in test_queries:
        lang = detect_language(query, mock_rules_sorted)
        print(f"Sorgu: '{str(query)[:50]}' -> Algılanan Dil: {lang.upper()}")

    print("--- Language Processor Testi Tamamlandı ---")
