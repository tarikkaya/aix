============================================================
README.txt - Kişiye Özel Uyarlanabilir Yordamsal Bilgi Sistemi (v3)
============================================================

Açıklama
----------
Bu proje, kullanıcının kendi sağladığı verilerle sıfırdan başlayarak zamanla büyüyen ve adapte olan, yerel bir bilgisayarda çalışan, kişiselleştirilmiş bir bilgi işleme sistemi (modeli) oluşturmayı amaçlar. Sistem, önceden eğitilmiş büyük üretken dil modellerini (LLM'ler) çekirdek motor olarak **kullanmaz**. Bunun yerine, MongoDB veritabanında ("Tek Pota") saklanan metinlere, anlamsal vektörlere, kullanıcı tanımlı **yapılandırılmış kurallara (koşul/eylem bazlı), hipotez şablonlarına (tetikleyicili), Jinja2 formatındaki yanıt şablonlarına**, geri bildirimlere ve diğer yapılandırılmış bilgilere dayanan **geliştirilmiş özel Python yordamları (algoritmaları)** ile çalışır. Hedef, modern dil modellerinin bazı adaptif yanıt davranışlarını (bağlama göre stil/uzunluk/içerik ayarlama, kural uyumu gibi) **prosedürel olarak simüle etmek** ve kullanıcı verilerine dayalı **kontrollü, yapılandırılmış çıkarımlar** yapmaktır.

Özellikler
-----------
* **Yerel Çalışma ve Kişiselleştirme:** Kullanıcının bilgisayarında çalışır, sadece kullanıcının verileri ve geri bildirimleriyle şekillenir.
* **Merkezi Veri Deposu ("Tek Pota"):** Tüm bilgiler (metin, vektör, S-C, prosedürler, kurallar, şablonlar, geri bildirimler, geçmiş vb.) tek bir MongoDB veritabanında saklanır.
* **Anlık Veri Girişi/Güncelleme:** Verilere (bilgiler, kurallar, şablonlar vb.) anlık ekleme ve güncelleme yapılabilir.
* **Artımlı Adaptasyon/Öğrenme Simülasyonu:** Sistem, geri bildirimlere dayalı olarak kural/şablon önceliklerini veya içeriklerini programatik olarak güncelleyerek zamanla adapte olabilir (adaptasyon algoritmaları geliştirilmelidir).
* **Anlamsal Vektörleme:** Metinler, `sentence-transformers` aracıyla anlamsal vektörlere dönüştürülür ve MongoDB'de saklanır (gelişmiş sorgulama/sıralama için).
* **Gelişmiş Bağlam Yönetimi (`query_manager.py`):** Yanıt üretirken hem yakın sohbet geçmişi hem de geçmişteki **ilgili** (embedding benzerliği ile tespit edilen) konuşmalar ve MongoDB'deki bilgiler (gelişmiş sorgulama ve dinamik ağırlıklandırma ile) kullanılır.
* **Geliştirilmiş Mantık Motoru (`query_manager.py`):**
    * Sorgu analizi yapar (basit niyet tespiti, geliştirilmiş çoklu adım algılama).
    * Bağlamı daha kapsamlı yönetir.
    * **Temel Kural Motoru:** Veritabanındaki (`kural_kumeleri`) koşul-eylem kurallarını bağlama göre değerlendirip uygulayabilir.
    * **Dinamik Yordamsal Çıkarım:** Kullanıcı tanımlı, yapılandırılmış Kurallar ve tetiklenebilir Hipotez Şablonları ile bağlama özel çıkarımlar/öneriler yapar.
    * **Otomatik Çoklu Adım Yürütme:** Tek sorgudaki adımları algılayıp sıralı olarak yürütebilir ve sonuçları işleyebilir.
* **Gelişmiş Şablon Tabanlı Yanıt Üretimi (`response_generator.py`):**
    * **Jinja2 Şablon Motoru:** Yanıtları oluşturmak için veritabanındaki (`yanit_sablonlari`) Jinja2 formatlı şablonları kullanır.
    * **Dinamik Şablon Seçimi:** Çıkarım türüne, bağlamdan elde edilen ipuçlarına (örn. önceki yanıtların uzunluğu) ve kullanıcı prompt'larına (örn. "kısa cevap") göre en uygun yanıt şablonunu seçmeye çalışır.
    * **Bağlamsal Yanıt Dolgusu:** Seçilen şablonları, çıkarım sonucu, güncel bilgiler ve konuşma geçmişinden alınan verilerle doldurur.
    * **Uzunluk/Detay/Üslup Simülasyonu:** Farklı etiketlere (örn. 'kısa', 'uzun', 'resmi', 'samimi') sahip şablonları seçerek yanıt stilini *simüle eder*.
* **Kullanıcı Tanımlı Kural Uyumu:** Kullanıcıların MongoDB'ye eklediği sistem davranış kurallarını okur ve (kural motoru tarafından) uygular.
* **İnteraktif Test ve Geri Bildirim (`test_interface.py`):** Etkileşim, manuel veri/kural/şablon ekleme ve kayıt/çıkarım doğrulama için arayüz sağlar.
* **Oturum Yönetimi ve Dil Tespiti:** Oturumlar ve dil korunur.
* **Prompt Desteği:** Sorgularda prompt ile davranış (örn. yanıt uzunluğu, tonu) yönlendirilebilir.

Mimari (Dosya Yapısı)
----------------------
* **`setup.py`**: Ortam kurulumu, bağımlılıklar (Jinja2 dahil), DB sıfırlama/hazırlama.
* **`config.py`**: Yapılandırma sabitleri (DB, koleksiyonlar, NLP modeli, şablon yapıları vb.).
* **`database.py`**: MongoDB etkileşim fonksiyonları.
* **`nlp_processor.py`**: Metin işleme ve vektörleştirme arayüzü.
* **`session_manager.py`**: Bellek içi oturum yönetimi.
* **`language_processor.py`**: Dil tespiti mantığı.
* **`data_handler.py`**: `veriekle` komutu, veri ekleme (yapılandırılmış kural/şablon dahil).
* **`feedback_manager.py`**: Geri bildirim işleme, adaptasyon tetikleyicisi (geliştirilebilir).
* **`query_manager.py`**: **Geliştirilmiş Çekirdek Mantık Motoru.** Sorgu analizi, gelişmiş bağlam yönetimi, temel kural motoru işletimi, hipotez üretimi, çıkarım yapma ve `response_generator` için veri hazırlama.
* **`response_generator.py`**: **Yeni Eklendi.** Jinja2 kullanarak veritabanındaki şablonları seçip doldurarak nihai metin yanıtını oluşturma.
* **`test_interface.py`**: `test` komutu interaktif menüsü ve işlevleri.
* **`model.py`**: Ana giriş noktası, CLI yönetimi, modül orkestrasyonu.

Gereksinimler
--------------
* Python 3.7+
* MongoDB sunucusu
* `pip`
* `Jinja2` (Yeni eklendi)
* `setup.py` tarafından kurulacak diğer Python paketleri.

Kurulum
---------
1.  **MongoDB:** Kurun ve çalıştırın. Vektör indeksi dahil gerekli indeksleri oluşturun.
2.  **Python & DB Hazırlığı:** `python setup.py` çalıştırın (**DİKKAT: Veritabanını siler!**). Bu komut Jinja2 dahil gerekli paketleri kuracaktır.
3.  **MongoDB Vektör İndeksi:** `bilgi_parcaciklari`'ndaki `vektor` alanı için manuel olarak uygun bir vektör indeksi oluşturun (örn: Atlas Search ile). Boyut `config.py`'deki `VECTOR_DIMENSION` ile eşleşmelidir.

Yapılandırma (`config.py`)
-------------------------
Tüm temel ayarlar, koleksiyon adları (`COLLECTION_YANIT_SABLONLARI` dahil), NLP modeli, bağlam/kural parametreleri `config.py` dosyasındadır. Varsayılan yanıt şablonları da bu dosyada tanımlanabilir.

Kullanım
--------
* **Kurulum/Sıfırlama:** `python setup.py`
* **Veri Ekleme:** `python model.py veriekle <dosya_yolu.txt>`
* **İnteraktif Test:** `python model.py test`
* **Doğrudan Sorgu:** `python model.py "Sorgunuz?"`
* **Prompt ile Sorgu:** `python model.py "promp:kısa ve resmi cevap" "Sorgunuz?"`

Veri Ekleme (`veriekle` / `test`)
---------------------------------
Yapılandırılmamış metin ekler. Sistemin gelişmiş mantık yürütmesi ve esnek yanıtlar üretebilmesi için, özellikle yapılandırılmış verilerin (detaylı **koşul/eylem kuralları**, Jinja2 formatında **yanıt şablonları**, hipotez tetikleyicileri vb.) doğru formatta ve yeterli miktarda girilmesi önemlidir. `test` modu bu tür verileri manuel eklemek için kullanılabilir.

İnteraktif Mod (`test`)
-----------------------
Menü: Soru Sor, Yeni Bilgi Ekle (kural/şablon/yanıt şablonu dahil), Kayıt Doğrula (çıkarım/hipotez onayı dahil).

Temel Konseptler
----------------
* **Tek Pota İşleme:** Merkezi MongoDB üzerinde özel yordamlarla çalışma.
* **Özel Yordamlar:** Çekirdek mantığın özel Python koduyla (gelişmiş algoritmalarla) tasarlanması.
* **Dinamik Yordamsal Çıkarım:** Kullanıcı tanımlı, yapılandırılmış kuralları (basit bir motor ile) ve tetiklenebilir hipotez şablonlarını kullanarak bağlama özel çıkarımlar/öneriler sunma.
* **Artımlı Adaptasyon:** Geri bildirimle kural/şablon önceliklerinin veya içeriklerinin güncellenmesi (geliştirme gerektirir).
* **Şablon Tabanlı Adaptasyon:** Yanıt stilini/uzunluğunu/içeriğini, Jinja2 formatındaki veritabanı şablonlarını bağlama ve prompt'a göre seçip doldurarak dinamik olarak *simüle etme*.

Önemli Notlar ve Sınırlamalar
----------------------------
* **LLM Değildir:** Sistem, GPT-4 gibi modellerin genel amaçlı yeteneklerine (akıcı/yaratıcı NLG, **derin/soyut/genelleştirilebilir akıl yürütme**, geniş dünya bilgisi, sıfırdan öğrenme) sahip **değildir**. 'Akıllı' veya 'LLM seviyesinde' gibi görünen davranışlar, büyük ölçüde **prosedürel mantık, veritabanındaki explicit kurallar ve Jinja2 şablonları** ile **simüle edilir**.
* **Yaratıcılık Yok:** Önceden tanımlanmış şablonların, kuralların ve verilerin dışına çıkan, tamamen yeni metinler veya fikirler üretemez. Bağlam dışı veya beklenmedik sorgulara karşı kırılgandır.
* **Bilgi/Kural/Şablon Mühendisliği Yoğun:** Sistemin 'LLM seviyesinde' *gibi görünen* mantıklar sergilemesi ve tutarlı çalışması, kullanıcının **çok detaylı, iyi yapılandırılmış, birbiriyle tutarlı ve kapsamlı kurallar, Jinja2 şablonları ve ilişkili veriler** girmesine **kritik derecede** bağlıdır. Bu ciddi bir mühendislik eforu gerektirir. Sistemin "zekası" doğrudan bu verilerin kalitesiyle orantılıdır.
* **Anlama Sınırlı:** Sistem metinleri anlamsal vektörlerle eşleştirir ve yapısal kuralları işler, ancak metnin derin anlamını veya nüanslarını LLM'ler gibi **anlamaz**.

Gelecek Geliştirmeler
----------------------
* `query_manager` içindeki kural motorunu ve çıkarım mantığını daha da geliştirmek (örn. daha karmaşık koşul/eylem yapıları, zincirleme kurallar).
* `response_generator`'da bağlam analizini (ton, konu takibi) derinleştirmek ve daha sofistike şablon seçimi/dolgusu yapmak.
* Geri bildirime dayalı otomatik adaptasyon algoritmalarını tasarlamak ve uygulamak (kural/şablon güncelleme).
* Yapılandırılmış veri (kural, şablon) girişini kolaylaştıracak arayüzler geliştirmek.
* İsteğe bağlı olarak spaCy/NLTK gibi kütüphanelerle daha derin NLP analizi (NER, POS, duygu analizi) entegrasyonu.