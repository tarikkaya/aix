================================
README.txt - Dinamik Bilgi Modeli
================================

Açıklama
----------
Bu proje, kullanıcının kendi sağladığı verilerle sıfırdan başlayarak zamanla büyüyen, yerel bir bilgisayarda çalışan, kişiselleştirilmiş bir bilgi işleme sistemi (modeli) oluşturmayı amaçlar. Sistem, önceden eğitilmiş büyük üretken dil modellerini (LLM'ler) çekirdek motor olarak kullanmak yerine, MongoDB veritabanında saklanan yapılandırılmış ve anlamsal olarak vektörleştirilmiş bilgilere dayanan özel Python yordamları (algoritmaları) ile çalışır. Kullanıcı geri bildirimi ve anlık veri girişi sistemin temelini oluşturur. Hedef, GPT-4 benzeri metinsel işlevlerin bazılarını (kodlama hariç) bu özel yaklaşımla simüle etmektir.

Özellikler
-----------
* **Yerel Çalışma:** Tüm sistem kullanıcının kendi bilgisayarında çalışır.
* **Merkezi Veri Deposu ("Tek Pota"):** Tüm bilgiler (metin, vektör, S-C, kurallar, prosedürler, geri bildirimler, sohbet geçmişi) tek bir MongoDB veritabanında saklanır.
* **Anlık Veri Girişi/Güncelleme:** MongoDB aracılığıyla verilere anlık ekleme ve güncelleme yapılabilir.
* **Artımlı Öğrenme:** Sistem, başlangıçta boş bir bilgi tabanıyla başlayabilir ve sadece kullanıcı tarafından `veriekle` komutu veya `test` arayüzü aracılığıyla eklenen verilerle büyür.
* **Anlamsal Vektörleme:** Metinler, `sentence-transformers` gibi harici bir "ufak araç" kullanılarak anlamsal vektörlere dönüştürülür ve MongoDB'de saklanır.
* **Hibrit Bağlam Yönetimi:** Yanıt üretirken hem yakın sohbet geçmişi (oturum bazlı) hem de MongoDB'deki bilgiler (vektör ve kelime/istatistik aramasıyla bulunan) kullanılır. Bu bilgileri birleştirme ve önceliklendirme mantığı özel olarak tasarlanmıştır.
* **Özel Mantık Motoru:** Sistemin karar verme ve yanıt üretme mekanizması, önceden eğitilmiş LLM'lere değil, özel olarak yazılmış Python yordamlarına dayanır (`query_manager.py` içinde).
* **İnteraktif Test ve Geri Bildirim:** `test` modu, kullanıcıların sistemle etkileşime girmesine, manuel bilgi eklemesine ve mevcut bilgilerin doğruluğunu onaylamasına/reddetmesine olanak tanır. Geri bildirimler veritabanına kaydedilir ve bilginin geçerlilik durumu güncellenir.
* **Oturum Yönetimi:** Her çalıştırma ayrı bir oturum olarak ele alınır, sohbet geçmişi oturum bazında kaydedilir ve bağlam için kullanılır.
* **Dil Tespiti:** Oturumun başında kullanıcının dili (veritabanındaki kurallara göre) tespit edilir ve oturum boyunca o dilde devam edilir.
* **Çok Adımlı Görevler:** Kullanıcı tarafından tanımlanan sıralı görev adımları (`task` komutu ile) yürütülebilir.
* **Prompt Desteği:** Sorgu yaparken özel bir prompt tanımı ile modelin davranışını yönlendirme imkanı sunar.

Mimari (Dosya Yapısı)
-----------------------
Proje, aşağıdaki modüler Python dosyalarından oluşur:

* **`setup.py`**: Ortam kurulumu, Python paket bağımlılık kontrolü/kurulumu, MongoDB veritabanını sıfırlama/ilk kullanıma hazırlama. (İlk çalıştırmadan önce `python setup.py` komutu çalıştırılmalıdır).
* **`config.py`**: Tüm yapılandırma sabitleri (veritabanı bağlantısı, koleksiyon adları, model adları, limitler vb.).
* **`database.py`**: MongoDB ile tüm etkileşimleri (CRUD, arama, vektör arama vb.) yöneten fonksiyonları içeren soyutlama katmanı.
* **`nlp_processor.py`**: Metin temizleme, tokenizasyon ve `sentence-transformers` aracılığıyla anlamsal vektör (embedding) oluşturma işlemlerini yapar.
* **`session_manager.py`**: Bellek içi oturum bilgilerini (`SessionContext` sınıfı: ID, dil, geçmiş tamponu) yönetir.
* **`language_processor.py`**: Veritabanındaki kurallara göre dil tespiti yapar.
* **`data_handler.py`**: `veriekle` komutunu işler, dosyadan veri okur, işler ve veritabanına ekler. Manuel veri ekleme fonksiyonu da içerir.
* **`feedback_manager.py`**: `test` arayüzünden gelen kullanıcı geri bildirimlerini işler, loglar ve ilgili bilgilerin doğrulama durumunu günceller. Doğrulama için kayıt seçme mantığını içerir.
* **`query_manager.py`**: Sistemin "beyni". Kullanıcı sorgusunu alır, bağlamı oluşturur (geçmiş, vektör/kelime araması, birleştirme/önceliklendirme), çekirdek mantığı (S-C, kural, prosedür vb.) yürütür ve yanıtı oluşturur.
* **`task_manager.py`**: `task` komutuyla verilen çok adımlı görevleri `query_manager`'ı kullanarak sırayla yürütür.
* **`test_interface.py`**: `test` komutuyla çalışan interaktif komut satırı menüsünü ve ilgili işlevleri (soru sorma, bilgi ekleme, kayıt doğrulama) yönetir.
* **`model.py`**: Ana giriş noktası. Komut satırı argümanlarını alır, sistemi başlatır ve ilgili modülleri/fonksiyonları çağırır.

Gereksinimler
--------------
* Python 3.7+ (veya `sentence-transformers` ve bağımlılıklarının gerektirdiği sürüm)
* MongoDB sunucusu (yerel veya uzak, `config.py`'da URI belirtilmelidir)
* `pip` (Python paket yöneticisi)
* `setup.py` tarafından kurulacak Python paketleri (bkz. `config.py` -> `REQUIRED_PACKAGES`):
    * `pymongo`
    * `sentence-transformers`
    * `numpy`
    * `torch` (veya `tensorflow` - `sentence-transformers` için gereklidir)

Kurulum
---------
1.  **MongoDB Kurulumu ve Çalıştırılması:** Sisteminizde MongoDB'nin kurulu ve çalışır durumda olduğundan emin olun.
2.  **Python Paketleri ve Veritabanı Hazırlığı:** Proje dizininde bir terminal açın ve aşağıdaki komutu çalıştırın:
    ```bash
    python setup.py
    ```
    Bu komut:
    * Gerekli Python paketlerini kontrol edecek ve eksikse `pip` ile kurmaya çalışacaktır.
    * MongoDB'ye bağlanacak, `config.py`'da belirtilen isimdeki veritabanı varsa **içeriğini tamamen silecektir (DİKKAT!)**, ardından veritabanını ve gerekli koleksiyonları/indeksleri oluşturacaktır.
    * Varsayılan dil kurallarını ekleyecektir.
3.  **MongoDB Vektör İndeksi (ÖNEMLİ):** `setup.py` temel indeksleri oluştursa da, `bilgi_parcaciklari` koleksiyonundaki `vektor` alanı üzerinde **anlamsal vektör araması yapabilmek için özel bir vektör indeksi** gereklidir. Bu indeksin MongoDB Atlas kullanıyorsanız Atlas arayüzünden veya kendi sunucunuzda uyumlu bir MongoDB sürümü kullanıyorsanız uygun `createIndex` komutlarıyla **manuel olarak** oluşturulması gerekir. İndeksi oluştururken `config.py`'daki `VECTOR_DIMENSION` değerini (kullandığınız embedding modeline göre) doğru şekilde belirtmelisiniz.

Yapılandırma (`config.py`)
-------------------------
Tüm temel ayarlar `config.py` dosyasında bulunur. MongoDB bağlantı URI'si, veritabanı/koleksiyon adları, kullanılacak embedding modeli, geçmiş limiti gibi değerleri bu dosyadan değiştirebilirsiniz.

Kullanım
--------
Tüm komutlar proje ana dizinindeki terminalden çalıştırılır:

* **Kurulum/Sıfırlama:**
    ```bash
    python setup.py
    ```
* **Veri Ekleme:**
    ```bash
    python model.py veriekle <dosya_yolu.txt>
    ```
* **İnteraktif Test Modu:**
    ```bash
    python model.py test
    ```
* **Doğrudan Sorgu:**
    ```bash
    python model.py "MongoDB nedir?"
    ```
* **Prompt ile Sorgu:**
    ```bash
    python model.py "promp:teknik detay" "MongoDB vektör arama nasıl çalışır?"
    ```
* **Çok Adımlı Görev:**
    ```bash
    python model.py task "İlk olarak Türkiye'nin başkentini öğren." "Sonra Ankara'daki müzeleri listele."
    ```

Veri Ekleme (`veriekle`)
-------------------------
`veriekle` komutu ile kullanılan `.txt` dosyasının şu anki basit beklentisi, her satırın ayrı bir bilgi parçacığı (varsayılan olarak `tur: 'gerçek'`) olarak kabul edilmesidir. Boş satırlar atlanır. Daha yapılandırılmış veri girişi için `data_handler.py`'nin geliştirilmesi gerekebilir.

İnteraktif Mod (`test`)
-----------------------
`test` komutu aşağıdaki seçenekleri sunan bir menü başlatır:
* **1: Soru Sor / Etkileşim:** Modele doğrudan soru sorabilir veya komut verebilirsiniz.
* **2: Yeni Bilgi Ekle (Manuel):** Metin, tür, anahtar kelime, bağlam gibi bilgileri girerek veritabanına yeni kayıt ekleyebilirsiniz (bu kayıtlar 'dogrulandi' olarak işaretlenir).
* **3: Kayıt Doğrula:** Sistem veritabanından rastgele veya belirli kriterlere göre kayıtları size sunar. [E]vet, [H]ayır, [A]tla veya [M]enü seçenekleriyle geri bildirim verirsiniz. Geri bildiriminiz kaydedilir ve kaydın durumu güncellenir.
* **0: Çıkış:** İnteraktif moddan çıkar.

Çok Adımlı Görevler (`task`)
--------------------------
`task` komutundan sonra tırnak içinde verilen her argüman ayrı bir görev adımı olarak kabul edilir. Sistem bu adımları sırayla, aynı oturum bağlamını koruyarak `query_manager` aracılığıyla işletir ve tüm adımların sonuçlarını birleştirerek sunar.

Temel Konseptler
----------------
* **Tek Pota:** Tüm bilgi ve meta verinin tek bir merkezi MongoDB veritabanında tutulması.
* **Özel Yordamlar:** Sistemin ana mantığının (bağlam yönetimi, karar verme, yanıt oluşturma) önceden eğitilmiş LLM'ler yerine özel Python kodlarıyla tasarlanması.
* **Geri Bildirim Döngüsü:** Kullanıcının sistemin bilgilerini doğrulaması ve bu geri bildirimin sistem tarafından kaydedilerek kullanılması.

Önemli Notlar ve Sınırlamalar
----------------------------
* **Bu Bir LLM Değildir:** Bu sistem, GPT-4 gibi genel amaçlı, büyük dil modellerinin yeteneklerine (özellikle akıcı metin üretme, karmaşık soyut akıl yürütme, geniş dünya bilgisi, sıfırdan öğrenme genellemesi) sahip **değildir**.
* **Yetenekler Sınırlıdır:** Sistemin "zekası" ve yapabilecekleri, tamamen sizin MongoDB'ye eklediğiniz verilerin kalitesine, miktarına, yapısına ve en önemlisi `query_manager.py` gibi modüller içine **tasarlayacağınız özel yordamların (algoritmaların) yeteneklerine** bağlıdır.
* **Vektör İndeksi:** Anlamsal arama için MongoDB üzerinde uygun bir vektör indeksi oluşturulması kritik öneme sahiptir ve genellikle manuel müdahale gerektirir.
* **Performans:** Veritabanı büyüdükçe ve yordamlar karmaşıklaştıkça, yerel bir bilgisayardaki performans düşebilir. Optimizasyon gerekebilir.

Gelecek Geliştirmeler
----------------------
* `query_manager` içindeki çekirdek mantık yordamlarının detaylı tasarımı ve implementasyonu.
* `data_handler` için daha yapılandırılmış veri okuma yetenekleri.
* Daha gelişmiş bağlam yönetimi ve önceliklendirme algoritmaları.
* Duygu/Niyet analizi modülünün detaylandırılması.
* `test_interface` için daha kullanıcı dostu bir arayüz (belki `rich` veya `prompt_toolkit` ile).
* Performans optimizasyonları.
* Kural motoru yeteneklerinin geliştirilmesi.