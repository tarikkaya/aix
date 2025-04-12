# services.py

# AIX Ana Servis Mantığı ve API Sunucusu 



import sys

import os

import json

import threading

import time

import configparser

import traceback 

import math

import random

import asyncio # proaktif mesaj süresinin model tarafından değiştirilmesi için

from typing import List, Dict, Any, Optional

from datetime import datetime, timedelta

from bson.objectid import ObjectId

import numpy as np 

import ctypes # Yönetici kontrolü için (Windows)





# FastAPI ve Pydantic importları 

try:

    from fastapi import FastAPI, HTTPException, status, Request, BackgroundTasks, Depends

    from pydantic import BaseModel, Field

    import uvicorn

except ImportError:

    print("HATA: FastAPI/Uvicorn/Pydantic bulunamadı.")

    sys.exit(1)



# DAAL importu

try:

    from data_access_layer import DataAccessLayer

except ImportError:

    print("HATA: data_access_layer.py bulunamadı!")

    sys.exit(1)



# --- Yapılandırma Okuma ---

DEFAULT_CONFIG_PATH = os.path.join(os.path.dirname(__file__), '..', 'config', 'config.ini')



def load_server_config(config_path=DEFAULT_CONFIG_PATH) -> Optional[Dict]:

    """ Config dosyasından [Server] bölümünü okur. Hata durumunda None döner."""

    config = configparser.ConfigParser(); config.optionxform = str;

    if not os.path.exists(config_path): print(f"HATA: Config dosyası bulunamadı: {config_path}."); return None;

    try:

        config.read(config_path, encoding='utf-8'); 

        host = config.get('Server', 'host', fallback='127.0.0.1'); 

        port = config.getint('Server', 'port'); 

        server_config = {"host": host, "port": port}; 

        return server_config

    except Exception as e: print(f"HATA: Config [Server] okuma hatası: {e}"); return None



def is_admin():

    """ Windows'ta yönetici hakları olup olmadığını kontrol eder. """

    try: return ctypes.windll.shell32.IsUserAnAdmin() != 0

    except: return False 



# --- Çekirdek Mantık Bileşenleri ---



class RequestContext:

    """ Bir API isteğinin işlenmesi boyunca durumu ve veriyi tutan nesne. """

    def __init__(self, user_input_text: Optional[str] = None, request_data: Optional[Dict] = None):

        self.request_data: Dict = request_data if request_data else {}

        self.user_input_text: Optional[str] = user_input_text

        self.internal_vector: Optional[List[float]] = None 

        self.history: List[Dict] = []

        self.self_state: Dict = {} 

        self.identity: Dict = {} 

        self.active_module_names: List[str] = []

        self.module_outputs: Dict[str, Any] = {}

        self.reflection_data: Optional[Dict] = None

        self.autonomy_decisions: Dict = {}

        self.response_text: Optional[str] = None

        self.final_api_response: Dict = {"basarili": False, "hata": "İşlenmedi"}



class AnlikDurumYoneticisi: 

    """ AIX'in anlık içsel durumunu (oturum_cekirdegi) yönetir. """

    def __init__(self, daal: DataAccessLayer):

        self.daal = daal

        # Cache mekanizmaları veya diğer başlangıç ayarları buraya eklenebilir.

        pass



    def update(self, ctx: RequestContext) -> Dict:

        """ Context'e göre oturumun self_core durumunu günceller ve döndürür. """

        # Bu metodun içi doldurulacak (DAAL çağrıları, analiz, sönümlenme, kaydetme)

        print("STUB: AnlikDurumYoneticisi.update çağrıldı.")

        # Geçici olarak varsayılan bir state döndürelim

        ctx.self_state = {"ruh_hali_skoru": 0.1, "duygu_yogunlugu": 0.0, "odak_seviyesi": 1.0, "islem_yuku": 0.1}

        return ctx.self_state



class EgoDegerlendirici: 

    """ AIX'in çekirdek kimliğini ve kişilik eğilimlerini değerlendirir. """

    def __init__(self, daal: DataAccessLayer): 

        self.daal = daal

        pass

        

    def evaluate(self, ctx: RequestContext) -> Dict:

        """ Context'i ego ve kişilik açısından değerlendirir. """

        # Bu metodun içi doldurulacak (DAAL çağrıları, tutarlılık kontrolü, rehberlik)

        print("STUB: EgoDegerlendirici.evaluate çağrıldı.")

        ctx.identity = {"tutarlilik_kontrolu": "beklemede", "aktif_kisilik_ozeti": {}, "rehberlik": None}

        return ctx.identity



class OtonomiYoneticisi:

     """ AIX'in hedeflerini ve bağlamı değerlendirerek eylem/modül seçer. """

     def __init__(self): 

         pass # DAAL gerekebilir

         

     def decide(self, ctx: RequestContext) -> Dict:

        """ Mevcut bağlama göre bir sonraki eylemi ve modülleri belirler. """

        # Bu metodun içi doldurulacak (hedef okuma, durum değerlendirme, modül seçimi)

        print("STUB: OtonomiYoneticisi.decide çağrıldı.")

        action = "genel_yanit_ver"; modules = ["temel_yanitlayici"]; 

        ctx.autonomy_decisions = {"sonraki_eylem": action, "secilen_moduller": modules}; 

        return ctx.autonomy_decisions;

        

     def select_modules(self, decisions: Dict) -> List[str]:

        """ Karar sözlüğünden modül listesini çıkarır. """

        # Şimdilik basitçe döndürür, ileride bağımlılık kontrolü eklenebilir.

        return decisions.get("secilen_moduller", []);



class TemelYanitlayiciModulu: # Örnek Modül İskeleti

     def process(self, ctx: RequestContext):

        """ Basitçe girdiyi aldığını belirten bir yanıt taslağı oluşturur. """

        print("STUB: TemelYanitlayiciModulu.process çağrıldı.")

        ctx.module_outputs["yanit_taslagi"] = f"Yanıt taslağı: '{ctx.user_input_text}' girdisi işlendi.";



class YansimaIslemcisi: 

     """ AIX'in merkezi analiz, öğrenme ve evrim motoru. """

     def __init__(self, daal: DataAccessLayer): 

         self.daal=daal;

         # Başlangıç ayarları, belki zamanlayıcı ile ilgili bilgiler

         pass

         

     def should_reflect(self, ctx: RequestContext) -> bool:

        """ Refleksiyon gerekip gerekmediğine karar verir. """

        # Bu metodun içi doldurulacak (sayaç, bayrak, durum kontrolü)

        print("STUB: YansimaIslemcisi.should_reflect çağrıldı.")

        return False # Şimdilik hiç refleksiyon yapmasın

        

     def process(self, ctx: RequestContext) -> Dict:

        """ Derin analiz, öğrenme, evrim işlemlerini gerçekleştirir. """

        # Bu metodun içi doldurulacak (çok karmaşık Ar-Ge kısmı)

        print("STUB: YansimaIslemcisi.process çağrıldı.")

        return {"sonuc": "Refleksiyon tamamlandı (stub)."}



     def generate_internal_vector(self, text: str) -> Optional[List[float]]:

         """ Metin için İÇSEL vektör üretir. """

         # Bu metodun içi doldurulacak (başlangıçta basit, sonra evrilen algoritma)

         print(f"STUB: YansimaIslemcisi.generate_internal_vector çağrıldı: '{text[:50]}...'")

         try: 

            dimension = self.daal.embedding_dimension if self.daal else DEFAULT_EMBEDDING_DIMENSION

            return np.zeros(dimension).tolist(); # Şimdilik sıfır vektörü döndür

         except Exception as e: 

             if self.daal: self.daal.olay_gunlukle("YansimaIslemcisi", "vektor_uretme_hatasi", "error", {"hata": str(e)})

             return None;



class YanitBirlestirici: 

     """ Pipeline çıktılarından son kullanıcı yanıtını sentezler. """

     def __init__(self): pass

     def assemble(self, ctx: RequestContext) -> str:

        """ Context'i kullanarak yanıt metnini oluşturur. """

        # Bu metodun içi doldurulacak (dinamik ağırlıklandırma, NLG)

        print("STUB: YanitBirlestirici.assemble çağrıldı.")

        yanit_taslagi = ctx.module_outputs.get("yanit_taslagi", "Yanıt üretilemedi.") 

        # Basitçe taslağı döndür

        ctx.response_text = yanit_taslagi; 

        return ctx.response_text;



# --- Ana Orkestratör Sınıfı ---

class AIXOrkestrator:

    """ Ana iş akışı pipeline'ını yönetir. """

    def __init__(self, daal: DataAccessLayer):

        self.daal = daal

        # Çekirdek bileşenleri oluştur

        self.anlik_durum_yoneticisi = AnlikDurumYoneticisi(self.daal) 

        self.ego_degerlendirici = EgoDegerlendirici(self.daal)       

        self.otonomi_yoneticisi = OtonomiYoneticisi()               

        self.yansima_islemcisi = YansimaIslemcisi(self.daal)         

        self.yanit_birlestirici = YanitBirlestirici()                 

        # İşlevsel modülleri yükle (şimdilik statik)

        self.moduller = {"temel_yanitlayici": TemelYanitlayiciModulu()} 

        # Embedding boyutunu DAAL'den al (Qdrant için gerekli)

        self.embedding_dimension = self.daal.embedding_dimension 

        print("AIXOrkestrator başlatıldı.")



    def _get_vector_for_text(self, text: str) -> Optional[List[float]]:

         """ Metin için İÇSEL vektör üretir (YansimaIslemcisi'ni çağırır). """

         # Bu fonksiyon YansimaIslemcisi'ndeki asıl implementasyonu çağırır

         return self.yansima_islemcisi.generate_internal_vector(text)



    def _save_memory_and_log_background(self, ctx: RequestContext):

        """ Konuşma geçmişini ve olayı arka planda kaydeder (DAAL kullanır). """

        # Bu fonksiyonun içeriği önceki cevaplarda verildiği gibi kalabilir.

        # Önemli: Hata yönetimi eklenmeli.

        if not self.daal or not self.daal.is_connected(): return;

        user_mem_id: Optional[ObjectId] = None

        try:

            # Kullanıcı mesajını ve (varsa) vektörünü kaydet

            user_mem_data = {"noron_tipi": "diyalog_anisi", "icerik": {"metin": ctx.user_input_text or ""}, "konusan_varlik": "kullanici", "metaveri": {"oturum_kimligi": ctx.request_data.get("oturum_kimligi"), "kullanici_kimligi": ctx.request_data.get("kullanici_kimligi"), "olusturulma_zamani": datetime.utcnow()}}

            if ctx.internal_vector: user_mem_data["vektorler"] = {"algoritma_surumu": "v0_internal", "vektor": ctx.internal_vector} 

            user_mem_id = self.daal.noron_ekle(user_mem_data);

            

            # AI yanıtını ve (varsa) vektörünü kaydet

            if ctx.response_text and user_mem_id:

                 ai_vector = self._get_vector_for_text(ctx.response_text) # Yanıt için de vektör üret

                 resp_data = {"noron_tipi": "diyalog_anisi", "icerik": {"metin": ctx.response_text}, "konusan_varlik": "benlik", "metaveri": {"oturum_kimligi": ctx.request_data.get("oturum_kimligi"), "kullanici_kimligi": ctx.request_data.get("kullanici_kimligi"), "yanit_verilen": user_mem_id, "icsel_durum_anlik": ctx.self_state, "olusturulma_zamani": datetime.utcnow()}}

                 if ai_vector: resp_data["vektorler"] = {"algoritma_surumu": "v0_internal", "vektor": ai_vector}

                 self.daal.noron_ekle(resp_data); # Qdrant sync DAAL içinde yapılır



            # Olay logu

            log_detay = {"girdi_onizleme": (ctx.user_input_text or "")[:50], "yanit_onizleme": (ctx.response_text or "")[:50], "oturum": ctx.request_data.get("oturum_kimligi")};

            self.daal.olay_gunlukle("Orkestrator", "sohbet_istegi_islendi", "info", detaylar=log_detay);

        except Exception as bg_e: print(f"HATA (Background Kayıt): {bg_e}"); try: self.daal.olay_gunlukle("BGCalisan", "arkaplan_kayit_hatasi", "error", {"error": str(bg_e)}) except: pass





    def handle_chat_request(self, user_input: str, session_id: Optional[str], background_tasks: BackgroundTasks) -> Dict[str, Any]:

        """ Gelen sohbet girdisini işler ve API yanıt nesnesini döndürür. """

        ctx = RequestContext(user_input_text=user_input, request_data={"oturum_kimligi": session_id, "kullanici_kimligi": "local_user"})

        try:

            # Pipeline Adımları (Çoğu stub çağırır)

            ctx.internal_vector = self._get_vector_for_text(user_input) # Adım 1

            ctx.history = [] # Adım 2

            if ctx.internal_vector and self.daal: ctx.history = self.daal.ilgili_gecmisi_getir(ctx.internal_vector, k=5, kullanici_kimligi=ctx.request_data.get("kullanici_kimligi"));

            if self.anlik_durum_yoneticisi: self.anlik_durum_yoneticisi.update(ctx) # Adım 3

            if self.ego_degerlendirici: self.ego_degerlendirici.evaluate(ctx) # Adım 4

            if self.otonomi_yoneticisi: ctx.autonomy_decisions = self.otonomi_yoneticisi.decide(ctx); ctx.active_module_names = self.otonomi_yoneticisi.select_modules(ctx.autonomy_decisions); # Adım 5

            else: ctx.active_module_names = ["temel_yanitlayici"]

            ctx.module_outputs = {} # Adım 6 başlangıcı

            for name in ctx.active_module_names: module = self.moduller.get(name);

            if module: try: module.process(ctx) except Exception as mod_e: print(f"HATA: Modül '{name}' hatası: {mod_e}") # Adım 6 döngüsü

            ctx.reflection_data = None # Adım 7 başlangıcı

            if self.yansima_islemcisi and self.yansima_islemcisi.should_reflect(ctx): ctx.reflection_data = self.yansima_islemcisi.process(ctx) # Adım 7

            if self.yanit_birlestirici: self.yanit_birlestirici.assemble(ctx) # Adım 8

            else: ctx.response_text = ctx.module_outputs.get("yanit_taslagi", "Yanıt birleştirici yok.")

            background_tasks.add_task(self._save_memory_and_log_background, ctx); # Adım 9

            ctx.final_api_response = {"basarili": True, "yanit": ctx.response_text, "oturum_kimligi": session_id}; # Adım 10

        except Exception as e: print(f"HATA: Orkestratör hatası: {e}"); traceback.print_exc(); ctx.final_api_response = {"basarili": False, "hata": f"İç hata: {e}", "oturum_kimligi": session_id}

        return ctx.final_api_response



# --- Global Değişkenler ---

# Bu değişkenler startup sırasında doldurulur

daal_instance: Optional[DataAccessLayer] = None

orchestrator: Optional[AIXOrkestrator] = None



# --- YENİ: Periyodik Görev Yönetimi için Global Değişkenler ---

_keep_running_periodic_tasks = True # Görevlerin çalışmaya devam etmesini kontrol eden bayrak

_periodic_tasks: List[asyncio.Task] = [] # Başlatılan asyncio görevlerini takip etmek için liste

# --- BİTTİ: Yeni Global Değişkenler ---





# --- YENİ: Periyodik Görev Fonksiyonları ---



async def _periodic_reflection_analysis(interval_setting_name: str, default_interval: int):

    """

    Periyodik olarak YansimaIslemcisi analizini, öğrenmeyi, nöron organizasyonunu

    ve bir sonraki eyleme karar verme sürecini tetikler. Proaktif mesaj gönderme

    kararı da bu süreç içinde verilebilir.

    """

    print("Periyodik Yansıma/Karar Alma görevi başlatılıyor...")

    await asyncio.sleep(15) # Örnek: 15 saniye sonra başla



    while _keep_running_periodic_tasks:

        # --- Döngü Başı: Güncel Aralığı Belirle ---

        current_interval = default_interval # Önce varsayılanı ata

        if daal_instance:

            try:

                db_interval = daal_instance.yapilandirma_degeri_getir(interval_setting_name, default_interval)

                if isinstance(db_interval, (int, float)) and db_interval >= 10:

                    current_interval = int(db_interval)

                else:

                    if db_interval != default_interval:

                         daal_instance.olay_gunlukle("PeriodicTasks", "invalid_reflection_interval", "warning", {"setting": interval_setting_name, "read_value": db_interval})

            except Exception as e:

                print(f"HATA: Yansıma aralığı okunamadı ({interval_setting_name}): {e}")

                if daal_instance: daal_instance.olay_gunlukle("PeriodicTasks", "reflection_interval_read_error", "error", {"setting": interval_setting_name, "error": str(e)})

        # --- Bitti: Güncel Aralığı Belirle ---



        print(f"DEBUG: Periyodik Yansıma/Karar Alma çalışacak (Aralık: {current_interval} saniye)...") # Şimdi current_interval tanımlı

        if orchestrator and orchestrator.yansima_islemcisi and orchestrator.otonomi_yoneticisi and daal_instance:

             try:

                 # --- MERKEZİ DÜŞÜNME, KARAR ALMA MANTIĞI ---

                 # 1. YansimaIslemcisi'ni tetikle (varsayımsal)

                 print("STUB: YansimaIslemcisi.process() çağrılıyor...")

                 reflection_output = {"analysis_summary": "Bazı yeni bağlantılar bulundu."}



                 # 2. OtonomiYoneticisi ile sonraki eyleme karar ver (varsayımsal)

                 print("STUB: OtonomiYoneticisi.decide_next_action() çağrılıyor...")



                 # --- Kararı Simüle Edelim ---

                 possible_actions = ["continue_internal", "send_proactive_message", "execute_command", "continue_internal", "continue_internal"]

                 decided_action = random.choice(possible_actions)

                 print(f"DEBUG: Otonomi Yöneticisi Kararı (Simüle Edilmiş): {decided_action}")

                 # -----------------------------



                 # 3. Karara Göre İşlem Yap

                 if decided_action == "send_proactive_message":

                     proaktif_izin = daal_instance.yapilandirma_degeri_getir("ProaktifMesajEtkin", False)

                     print(f"DEBUG: Proaktif mesaj izni kontrol ediliyor: {proaktif_izin}")

                     if proaktif_izin:

                         message_content = "Sanırım son konuştuğumuz konuyla ilgili yeni bir bağlantı buldum."

                         print(f"AIX Proaktif Mesaj Gönderecek (İzin Var): {message_content}")

                         daal_instance.olay_gunlukle("PeriodicTasks", "proactive_message_triggered", "info", {"content_preview": message_content[:50]})

                         # TODO: Gerçek mesaj gönderme mekanizması

                     else:

                         print("DEBUG: Proaktif mesaj kararı verildi ancak kullanıcı izni ({ProaktifMesajEtkin}) yok.")

                         daal_instance.olay_gunlukle("PeriodicTasks", "proactive_message_blocked_by_setting", "info")



                 elif decided_action == "execute_command":

                     komut_izin = daal_instance.yapilandirma_degeri_getir("KomutCalistirmaEtkin", False)

                     print(f"DEBUG: Komut çalıştırma izni kontrol ediliyor: {komut_izin}")

                     if komut_izin:

                         command_to_run = "echo 'AIX komut testi'"

                         print(f"AIX Komut Çalıştıracak (İzin Var): {command_to_run}")

                         daal_instance.olay_gunlukle("PeriodicTasks", "command_execution_triggered", "info", {"command_preview": command_to_run[:50]})

                         # TODO: Güvenli komut çalıştırma mekanizması

                     else:

                         print("DEBUG: Komut çalıştırma kararı verildi ancak kullanıcı izni ({KomutCalistirmaEtkin}) yok.")

                         daal_instance.olay_gunlukle("PeriodicTasks", "command_execution_blocked_by_setting", "info")



                 else: # "continue_internal" veya başka bir durum

                     print("DEBUG: Merkezi döngü tamamlandı, dışsal bir eylem kararı verilmedi.")

                     daal_instance.olay_gunlukle("PeriodicTasks", "reflection_decision_cycle_complete_internal", "info", {"interval": current_interval, "decision": decided_action})



                 # --- BİTTİ: Karara Göre İşlem Yap ---



             except Exception as e:

                 print(f"HATA: Periyodik Yansıma/Karar Alma sırasında: {e}")

                 traceback.print_exc()

                 if daal_instance: daal_instance.olay_gunlukle("PeriodicTasks", "reflection_decision_run_error", "error", {"error": str(e)})

        else:

            print("UYARI: Orkestratör veya gerekli bileşenler (Yansima/Otonomi/DAAL) periyodik görev için hazır değil.")

            await asyncio.sleep(5)



        # Bir sonraki çalıştırmaya kadar bekle

        try:

            # Şimdi current_interval döngü içinde doğru şekilde belirlendi

            await asyncio.sleep(current_interval)

        except asyncio.CancelledError:

            print("Periyodik Yansıma/Karar Alma görevi iptal edildi.")

            break # Döngüden çık



                 # --- BİTTİ: Karara Göre İşlem Yap ---



             except Exception as e:

                 print(f"HATA: Periyodik Yansıma/Karar Alma sırasında: {e}")

                 traceback.print_exc() # Hatayı daha detaylı görmek için

                 if daal_instance: daal_instance.olay_gunlukle("PeriodicTasks", "reflection_decision_run_error", "error", {"error": str(e)})

        else:

            print("UYARI: Orkestratör veya gerekli bileşenler (Yansima/Otonomi/DAAL) periyodik görev için hazır değil.")

            await asyncio.sleep(5)



        # Bir sonraki çalıştırmaya kadar bekle

        try:

            await asyncio.sleep(current_interval)

        except asyncio.CancelledError:

            print("Periyodik Yansıma/Karar Alma görevi iptal edildi.")

            break



# --- BİTTİ: Güncellenmiş Periyodik Görev Fonksiyonları ---





# --- FastAPI Uygulaması ---

app = FastAPI(title="AIX Servis API", version="0.1.1") # Versiyon güncellenebilir



# --- Olaylar (Startup/Shutdown) ---

@app.on_event("startup")

async def startup_event():

    """ API sunucusu başladığında DAAL, Orkestratör'ü ve periyodik görevleri başlatır. """

    global daal_instance, orchestrator, _periodic_tasks, _keep_running_periodic_tasks

    print("AIX Servisi başlatılıyor...")

    _keep_running_periodic_tasks = True



    try:

        daal_instance = DataAccessLayer()

        orchestrator = AIXOrkestrator(daal_instance)



        # --- Güncellenmiş: Periyodik Görevleri Başlat ---

        print("   Periyodik görevler başlatılıyor...")

        # Sadece Yansıma/Karar Alma görevini başlat

        task1 = asyncio.create_task(

            _periodic_reflection_analysis(

                interval_setting_name="FikirUretmeAraligiSn",

                default_interval=300

            )

        )

        _periodic_tasks.append(task1)

        print(f"   ...{len(_periodic_tasks)} periyodik görev başlatıldı.") # Artık sadece 1 görev olmalı

        # --- BİTTİ: Güncellenmiş Periyodik Görevler ---



        print("AIX Servisi başarıyla başlatıldı.");



@app.on_event("shutdown")

def shutdown_event():

    """ API sunucusu kapandığında bağlantıları kapatır ve görevleri durdurur. """

    global _keep_running_periodic_tasks, _periodic_tasks

    print("AIX Servisi durduruluyor...");

    _keep_running_periodic_tasks = False



    # --- Periyodik Görevleri İptal Et ---

    print("   Periyodik görevler durduruluyor (iptal isteği gönderiliyor)...")

    cancelled_count = 0

    for task in _periodic_tasks:

        if task and not task.done():

            task.cancel()

            cancelled_count += 1

    print(f"   ...{cancelled_count} periyodik göreve iptal isteği gönderildi.")

    _periodic_tasks = []

    # --- BİTTİ: Periyodik Görevleri İptal Et ---



    if daal_instance:

        daal_instance.close_connection();

    print("AIX Servisi durduruldu.");

# --- Yardımcı Fonksiyonlar (Dependency Injection) ---

def get_orchestrator() -> AIXOrkestrator: 

    """ Orkestratör örneğini endpoint'lere enjekte eder. """

    if not orchestrator: 

        # Startup'ta hata olduysa veya henüz başlamadıysa 503 dön

        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Orkestratör henüz hazır değil.")

    return orchestrator;

    

def get_daal() -> DataAccessLayer: 

     """ DAAL örneğini endpoint'lere enjekte eder. """

     if not daal_instance or not daal_instance.is_connected(): 

         raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Veri Erişim Katmanı (DAAL) hazır değil veya bağlı değil.")

     return daal_instance;



# --- API Veri Modelleri (Pydantic - Türkçe Alan İsimleri ve Alias'lar) ---

# Bu modeller API'nin dış dünya ile nasıl konuşacağını tanımlar.

# JSON tarafında İngilizce (camelCase) bekleniyorsa alias kullanılır.

class SohbetGirdisi(BaseModel): 

    kullanici_kimligi: str = Field("local_user", alias="userId")

    oturum_kimligi: Optional[str] = Field(None, alias="sessionId")

    mesaj: str



class SohbetYaniti(BaseModel): 

    basarili: bool

    yanit: Optional[str] = None

    oturum_kimligi: Optional[str] = Field(None, alias="sessionId")

    hata: Optional[str] = None

    # Geri bildirim için AI yanıtının ID'sini de döndürelim

    yanit_noron_kimligi: Optional[str] = Field(None, alias="responseNeuronId") 



class AyarToggle(BaseModel): 

    parametre_adi: str = Field(..., alias="parameterName")

    deger: bool



class VeriGonderInput(BaseModel): 

    metin_icerigi: str = Field(..., alias="textContent")

    orijinal_dosya_adi: Optional[str]= Field(None, alias="originalFilename")

    kullanici_kimligi: Optional[str] = Field("local_user", alias="userId")



class GeriBildirimGonderInput(BaseModel): 

    diyalog_noron_kimligi: str = Field(..., alias="dialogueNeuronId")

    puan: str # 'iyi' veya 'kotu'

    aciklama: str # Zorunlu alan (kullanıcı isteği)

    onerilen_metin: Optional[str] = Field(None, alias="suggestedText")



class BasitDurumYaniti(BaseModel): 

    basarili: bool

    mesaj: Optional[str] = None

    hata: Optional[str] = None



class AyarGetirYaniti(BaseModel): 

    basarili: bool

    parametre_adi: str = Field(..., alias="parameterName")

    deger: Any

    hata: Optional[str] = None



# Ayarlar için yeni modeller

class TumAyarlariGetirYaniti(BaseModel):

    basarili: bool

    ayarlar: Optional[Dict[str, Any]] = None

    hata: Optional[str] = None

    

class AyarlariGuncelleInput(BaseModel):

    guncellenecek_ayarlar: Dict[str, Any] = Field(..., alias="settingsToUpdate")



# Oturum Yönetimi için yeni modeller

class OturumListesiYaniti(BaseModel):

    basarili: bool

    oturumlar: Optional[List[Dict]] = None # Oturum ID ve başlığını içeren dict listesi

    hata: Optional[str] = None



class OturumGecmisiYaniti(BaseModel):

    basarili: bool

    gecmis: Optional[List[Dict]] = None # Mesaj nöronlarını içeren dict listesi

    hata: Optional[str] = None

    

class OturumBasligiGuncelleInput(BaseModel):

    oturum_kimligi: str = Field(..., alias="sessionId")

    yeni_baslik: str = Field(..., alias="newTitle")



class OturumSilInput(BaseModel):

    oturum_kimligi: str = Field(..., alias="sessionId")





# --- API Endpoints (İskelet Mantık ve DAAL Çağrıları ile) ---



@app.post("/sohbet_girdisi", response_model=SohbetYaniti, tags=["Sohbet"]) 

async def sohbet_girdisi_isle(

    chat_input: SohbetGirdisi, 

    background_tasks: BackgroundTasks, 

    orch: AIXOrkestrator = Depends(get_orchestrator)

):

    """ Kullanıcı sohbet girdisini alır, işler ve yanıt döndürür. """

    try:

        # Orkestrator'un handle_chat_request'i çağır

        result_dict = orch.handle_chat_request(

            user_input=chat_input.mesaj, 

            session_id=chat_input.oturum_kimligi, 

            background_tasks=background_tasks

        )

        # Yanıt modelini oluştururken AI mesajının ID'sini de ekleyelim

        # Bu ID'nin _save_memory_and_log_background içinde üretilip 

        # result_dict'e eklendiğini varsayıyoruz (veya burada üretilir).

        # Şimdilik None bırakalım.

        result_dict["yanit_noron_kimligi"] = None # TODO: AI mesaj ID'sini ekle

        return SohbetYaniti(**result_dict)

    except Exception as e: 

        print(f"API HATA (/sohbet_girdisi): {e}")

        traceback.print_exc()

        # Genel hata durumunda da tutarlı yanıt dön

        return SohbetYaniti(basarili=False, hata=f"İşlem sırasında beklenmedik sunucu hatası: {e}", oturum_kimligi=chat_input.oturum_kimligi)



@app.post("/ayar_degistir", response_model=BasitDurumYaniti, tags=["Ayarlar"]) 

async def ayar_degistir(ayar: AyarToggle, daal: DataAccessLayer = Depends(get_daal)):

    """ Sistem ayarını günceller (yapilandirma_dugumu). """

    try:

        # Açıklama alanı için varsayılan bir metin veya None gönderilebilir

        success = daal.yapilandirma_degeri_ayarla(ayar.parametre_adi, ayar.deger, f"{ayar.parametre_adi} ayarı GUI'den değiştirildi.")

        if success: 

            return BasitDurumYaniti(basarili=True, mesaj=f"'{ayar.parametre_adi}' ayarı '{ayar.deger}' olarak güncellendi.")

        else: 

            # DAAL içinde hata loglanmış olmalı

            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"'{ayar.parametre_adi}' ayarlanamadı (Veritabanı hatası?).")

    except Exception as e: 

        print(f"API HATA (/ayar_degistir): {e}")

        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Ayar güncellenirken sunucu hatası: {e}")



@app.get("/ayar_getir", response_model=AyarGetirYaniti, tags=["Ayarlar"]) 

async def ayar_getir(parameter_name: str, daal: DataAccessLayer = Depends(get_daal)):

     """ Belirli bir config ayarını döndürür (yapilandirma_dugumu'ndan). """

     try:

         # Varsayılan değer None, bulunamazsa None dönecek

         deger = daal.yapilandirma_degeri_getir(parameter_name, default_value=None) 

         if deger is not None: 

             return AyarGetirYaniti(basarili=True, parametre_adi=parameter_name, deger=deger)

         else: 

             # Ayar bulunamadı

             raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Ayar bulunamadı: '{parameter_name}'")

     except Exception as e: 

         print(f"API HATA (/ayar_getir): {e}")

         raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Ayar okunurken sunucu hatası: {e}")



@app.post("/veri_gonder", response_model=BasitDurumYaniti, tags=["Veri Yönetimi"]) 

async def veri_gonder(data_input: VeriGonderInput, background_tasks: BackgroundTasks, daal: DataAccessLayer = Depends(get_daal), orch: AIXOrkestrator = Depends(get_orchestrator)):

    """ Metin verisi ekleme isteğini alır ve arka planda işlenmek üzere görevi başlatır. """

    if not daal: raise HTTPException(status_code=503, detail="DAAL hazır değil.")

    

    # Arka plan görevini tanımla

    def process_data_in_background(text, filename, user):

        try:

             # 1. Nöronu ekle

             noron_verisi = {

                 "noron_tipi": "veri_parcacigi", 

                 "icerik": {"metin": text, "orijinal_dosya_adi": filename}, 

                 "metaveri": {"kaynak": "dosya_yukleme", "kullanici_kimligi": user, "gonderim_zamani": datetime.utcnow()}

             }

             eklenen_kimlik = daal.noron_ekle(noron_verisi) 

             

             if eklenen_kimlik:

                 daal.olay_gunlukle("BGCalisan", "veri_parcacigi_eklendi", "info", {"noron_kimligi": str(eklenen_kimlik), "dosyaadi": filename})

                 

                 # 2. Vektörü Üret (İçsel) ve Qdrant'a Ekle

                 try:

                      internal_vector = orch._get_vector_for_text(text) # Orkestratördeki metodu çağır

                      if internal_vector:

                          # Nöronu tekrar çekip payload oluşturmak yerine, temel bilgiyi kullanalım

                          payload_data = {"_id": eklenen_kimlik, "metaveri": noron_verisi["metaveri"]}

                          payload = daal._create_qdrant_payload(payload_data)

                          if payload:

                              # TODO: Vektör sürümünü payload'a ekle

                              daal._upsert_vector(eklenen_kimlik, internal_vector, payload)

                          else: daal.olay_gunlukle("BGCalisan", "qdrant_payload_hatasi", "warning", {"id": str(eklenen_kimlik)})

                      else: daal.olay_gunlukle("BGCalisan", "vektor_uretme_basarisiz", "warning", {"id": str(eklenen_kimlik)})

                 except Exception as vec_e: daal.olay_gunlukle("BGCalisan", "vektor_qdrant_hatasi", "error", {"id": str(eklenen_kimlik), "error": str(vec_e)})



                 # 3. Ön Analiz ve Geçici İlişkilendirme

                 # TODO: Basit KNN veya kural tabanlı analizle ilgili uzayları bul

                 #       ve DAAL iliski_ekle ile 'gecici' ilişki kur.

                 print(f"BG Task: '{filename}' eklendi ve vektörlendi (varsa). İleri analiz/ilişkilendirme YansimaIslemcisi tarafından yapılacak.")



             else: 

                 daal.olay_gunlukle("BGCalisan", "veri_parcacigi_basarisiz", "error", {"dosyaadi": filename})

        except Exception as e: 

            print(f"HATA (BG Task - Veri): {e}")

            traceback.print_exc()

            try: daal.olay_gunlukle("BGCalisan", "veri_isleme_hatasi", "error", {"dosyaadi": filename, "error": str(e)}) 

            except: pass # Loglama da başarısız olabilir



    try:

        # Görevi arka plana ekle

        background_tasks.add_task(process_data_in_background, data_input.metin_icerigi, data_input.orijinal_dosya_adi, data_input.kullanici_kimligi)

        return BasitDurumYaniti(basarili=True, mesaj=f"'{data_input.orijinal_dosya_adi}' işlenmek üzere alındı.")

    except Exception as e: 

        print(f"API HATA (/veri_gonder): {e}")

        raise HTTPException(status_code=500, detail=f"Veri görevi başlatılamadı: {e}")



@app.post("/geribildirim_gonder", response_model=BasitDurumYaniti, tags=["Geri Bildirim"]) 

async def geribildirim_gonder(feedback_input: GeriBildirimGonderInput, daal: DataAccessLayer = Depends(get_daal)):

     """ Kullanıcı geri bildirimini (açıklama ve öneri ile) kaydeder. """

     try:

         # Pydantic modeli zaten gerekli alanları doğrular (aciklama zorunlu)

         feedback_data = {

             "puan": feedback_input.puan, 

             "aciklama": feedback_input.aciklama, 

             "onerilen_metin": feedback_input.onerilen_metin, 

             "zaman_damgasi": datetime.utcnow()

             };

         success = daal.kullanici_geri_bildirimi_kaydet(feedback_input.diyalog_noron_kimligi, feedback_data);

         if success: return BasitDurumYaniti(basarili=True, mesaj="Geri bildirim kaydedildi.");

         else: raise HTTPException(status_code=500, detail="Geri bildirim kaydedilemedi.");

     except Exception as e: print(f"API HATA (/geribildirim_gonder): {e}"); raise HTTPException(status_code=500, detail=f"Geri bildirim hatası: {e}")



# --- Oturum Yönetimi Endpoints (Yeni) ---



@app.get("/oturum_listesini_getir", response_model=OturumListesiYaniti, tags=["Oturum Yönetimi"])

async def oturum_listesini_getir(limit: int = 10, daal: DataAccessLayer = Depends(get_daal)):

    """ Son oturumların listesini (ID ve Başlık) getirir. """

    try:

        # Sadece ID ve başlığı almak için projeksiyon kullanalım

        query = {"noron_tipi": "oturum_kaydi"}

        projection = {"_id": 1, "icerik.baslik": 1}

        # En son oluşturulanlara göre sırala

        sort = [("metaveri.olusturulma_zamani", pymongo.DESCENDING)]

        sessions_cursor = daal.noronlari_bul(query, limit=limit, siralama_kriteri=sort)

        

        # Yanıt formatına uygun hale getir

        oturumlar = []

        for session in sessions_cursor:

            oturumlar.append({

                "_id": str(session["_id"]), # ID'yi string yap

                "baslik": session.get("icerik", {}).get("baslik", "Başlıksız")

            })

            

        return OturumListesiYaniti(basarili=True, oturumlar=oturumlar)

    except Exception as e:

        print(f"API HATA (/oturum_listesini_getir): {e}")

        raise HTTPException(status_code=500, detail=f"Oturum listesi alınırken hata: {e}")



@app.get("/oturum_gecmisini_getir", response_model=OturumGecmisiYaniti, tags=["Oturum Yönetimi"])

async def oturum_gecmisini_getir(oturum_kimligi: str, limit: int = 20, daal: DataAccessLayer = Depends(get_daal)):

    """ Belirli bir oturumun son N mesajını getirir. """

    try:

        session_oid = daal._string_to_objectid(oturum_kimligi)

        if not session_oid: raise HTTPException(status_code=400, detail="Geçersiz oturum kimliği formatı.")

            

        query = {"noron_tipi": "diyalog_anisi", "metaveri.oturum_kimligi": session_oid}

        # En son mesajlara göre sırala (oluşturulma zamanına göre)

        sort = [("metaveri.olusturulma_zamani", pymongo.DESCENDING)] 

        

        history_neurons = daal.noronlari_bul(query, limit=limit, siralama_kriteri=sort)

        

        # API yanıtı için formatla (ID'leri string yap, ters çevirerek doğru sıra)

        gecmis = []

        for neuron in reversed(history_neurons): # En sondan başa doğru ekle

             gecmis.append({

                 "_id": str(neuron["_id"]),

                 "icerik": neuron.get("icerik"),

                 "konusan_varlik": neuron.get("konusan_varlik"),

                 "metaveri": neuron.get("metaveri") # Tüm metaveriyi gönderebiliriz

             })

             

        return OturumGecmisiYaniti(basarili=True, gecmis=gecmis)

    except Exception as e:

        print(f"API HATA (/oturum_gecmisini_getir): {e}")

        raise HTTPException(status_code=500, detail=f"Oturum geçmişi alınırken hata: {e}")



@app.post("/oturum_basligini_guncelle", response_model=BasitDurumYaniti, tags=["Oturum Yönetimi"])

async def oturum_basligini_guncelle(update_input: OturumBasligiGuncelleInput, daal: DataAccessLayer = Depends(get_daal)):

    """ Bir oturum kaydının başlığını günceller. """

    try:

        session_oid = daal._string_to_objectid(update_input.oturum_kimligi)

        if not session_oid: raise HTTPException(status_code=400, detail="Geçersiz oturum kimliği.")

        

        # oturum_kaydi nöronunu bul ve icerik.baslik alanını güncelle

        success = daal.noron_guncelle(

            session_oid, 

            {"icerik.baslik": update_input.yeni_baslik}, 

            kaldirilacak_alanlar=None # Alan kaldırmıyoruz

        )

        

        if success:

            return BasitDurumYaniti(basarili=True, mesaj="Oturum başlığı güncellendi.")

        else:

            # noron_guncelle False dönerse (örn. bulunamadı)

            raise HTTPException(status_code=404, detail="Güncellenecek oturum kaydı bulunamadı.")

            

    except Exception as e:

        print(f"API HATA (/oturum_basligini_guncelle): {e}")

        raise HTTPException(status_code=500, detail=f"Oturum başlığı güncellenirken hata: {e}")



@app.post("/oturum_sil", response_model=BasitDurumYaniti, tags=["Oturum Yönetimi"])

async def oturum_sil(delete_input: OturumSilInput, background_tasks: BackgroundTasks, daal: DataAccessLayer = Depends(get_daal)):

    """ Belirli bir oturumu ve ilişkili diyalogları siler (Arka Planda). """

    # Dikkat: Bu işlem geri alınamaz ve potansiyel olarak uzun sürebilir.

    # Arka planda çalıştırmak daha uygun olabilir.

    session_oid = daal._string_to_objectid(delete_input.oturum_kimligi)

    if not session_oid: raise HTTPException(status_code=400, detail="Geçersiz oturum kimliği.")



    def delete_session_data_background(session_oid_to_delete):

        print(f"BG Task: Oturum siliniyor - {session_oid_to_delete}")

        try:

            # 1. İlişkili diyalog anılarını sil

            dialogue_query = {"noron_tipi": "diyalog_anisi", "metaveri.oturum_kimligi": session_oid_to_delete}

            # Qdrant'tan da silmek için önce ID'leri alalım

            dialogue_ids_to_delete = [n['_id'] for n in daal.noronlari_bul(dialogue_query, projection={"_id": 1})]

            if dialogue_ids_to_delete:

                delete_dialogue_result = daal.get_neurons_collection().delete_many(dialogue_query)

                print(f"   {delete_dialogue_result.deleted_count} diyalog anısı silindi.")

                # Qdrant'tan vektörleri sil

                for neuron_id in dialogue_ids_to_delete:

                    daal._delete_vector(neuron_id) # Hata kontrolü _delete_vector içinde

            

            # 2. Oturum kaydı nöronunu sil

            session_deleted = daal.noron_sil(session_oid_to_delete)

            if session_deleted:

                 print(f"   Oturum kaydı {session_oid_to_delete} silindi.")

                 daal.olay_gunlukle("BGCalisan", "oturum_silindi", "info", {"oturum_kimligi": str(session_oid_to_delete)})

            else:

                 print(f"   UYARI: Oturum kaydı {session_oid_to_delete} silinemedi (belki zaten yoktu?).")

                 daal.olay_gunlukle("BGCalisan", "oturum_kaydi_silme_basarisiz", "warning", {"oturum_kimligi": str(session_oid_to_delete)})



        except Exception as e:

             print(f"HATA (BG Task - Oturum Silme): {e}")

             traceback.print_exc()

             if daal: daal.olay_gunlukle("BGCalisan", "oturum_silme_hatasi", "error", {"oturum_kimligi": str(session_oid_to_delete), "error": str(e)})



    try:

        background_tasks.add_task(delete_session_data_background, session_oid)

        return BasitDurumYaniti(basarili=True, mesaj="Oturum silme işlemi arka planda başlatıldı.")

    except Exception as e:

        print(f"API HATA (/oturum_sil): {e}")

        raise HTTPException(status_code=500, detail=f"Oturum silme görevi başlatılamadı: {e}")





# --- Ayarlar Yönetimi Endpoints (Yeni) ---

@app.get("/tum_ayarlari_getir", response_model=TumAyarlariGetirYaniti, tags=["Ayarlar"])

async def tum_ayarlari_getir(daal: DataAccessLayer = Depends(get_daal)):

    """ Veritabanında saklanan tüm yapılandırma düğümlerini getirir. """

    try:

        # Sadece yapilandirma_dugumu tipindeki nöronları al

        config_neurons = daal.noronlari_bul({"noron_tipi": "yapilandirma_dugumu"})

        # Yanıt için dict formatına çevir {parametre_adi: deger}

        ayarlar = {

            n.get("icerik", {}).get("parametre_adi"): n.get("icerik", {}).get("deger")

            for n in config_neurons 

            if n.get("icerik") and n.get("icerik").get("parametre_adi") is not None

        }

        return TumAyarlariGetirYaniti(basarili=True, ayarlar=ayarlar)

    except Exception as e:

        print(f"API HATA (/tum_ayarlari_getir): {e}")

        raise HTTPException(status_code=500, detail=f"Ayarlar getirilirken hata: {e}")



@app.post("/ayarlari_guncelle", response_model=BasitDurumYaniti, tags=["Ayarlar"])

async def ayarlari_guncelle(update_input: AyarlariGuncelleInput, daal: DataAccessLayer = Depends(get_daal)):

    """ Birden fazla yapılandırma ayarını günceller. """

    try:

        results = {}

        for key, value in update_input.guncellenecek_ayarlar.items():

            # Her bir ayarı tek tek güncellemek için DAAL fonksiyonunu kullan

            # Açıklama alanı None gönderilebilir, DAAL varsayılanı kullanır.

            success = daal.yapilandirma_degeri_ayarla(key, value)

            results[key] = success

        

        failed_settings = [k for k, v in results.items() if not v]

        if not failed_settings:

            return BasitDurumYaniti(basarili=True, mesaj="Ayarlar başarıyla güncellendi.")

        else:

            # Kısmi başarı veya tam başarısızlık

            error_msg = f"Bazı ayarlar güncellenemedi: {', '.join(failed_settings)}"

            # Durumu 500 yerine belki 207 Multi-Status? Veya 400? Şimdilik 500.

            raise HTTPException(status_code=500, detail=error_msg)

            

    except Exception as e:

        print(f"API HATA (/ayarlari_guncelle): {e}")

        raise HTTPException(status_code=500, detail=f"Ayarlar güncellenirken hata: {e}")





# --- Durdurma Endpoint'i ---

@app.post("/durdurma_iste", response_model=BasitDurumYaniti, tags=["Yönetim"]) 

async def durdurma_iste(background_tasks: BackgroundTasks, daal: Optional[DataAccessLayer] = Depends(get_daal)):

    """ Sistemin kontrollü kapatılmasını sinyaller. """

    print("API: Kapatma isteği alındı.");

    try:

        if daal: background_tasks.add_task(daal.close_connection);

        # TODO: Zamanlayıcıları, Görev Kuyruğunu ve Çalışanları düzgünce durdur

        # Uvicorn'u programatik olarak durdurmak için sinyal gönderme mekanizması

        print("UYARI: Tam kapanma mekanizması henüz implemente edilmedi.")

        return BasitDurumYaniti(basarili=True, mesaj="Kapatma işlemi sinyallendi.");

    except Exception as e: print(f"API HATA (/durdurma_iste): {e}"); return BasitDurumYaniti(basarili=False, hata=f"Kapatma hatası: {e}");





# --- Uygulamayı Çalıştırma ---

if __name__ == "__main__":

    print("AIX Servisi başlatılıyor...")

    # Yönetici kontrolü

    if os.name == 'nt' and not is_admin(): 

         print("\nHATA: AIX Servisi Yönetici hakları gerektirir.")

         input("Çıkmak için Enter..."); sys.exit(1)

    elif os.name == 'nt': print("   [OK] Yönetici haklarıyla çalıştırılıyor.")



    server_settings = load_server_config(); 

    if server_settings is None: print("KRİTİK HATA: Sunucu yapılandırması okunamadı!"); sys.exit(1);

    try:

        config_port = server_settings.get("port"); config_host = server_settings.get("host");

        print(f"Sunucu {config_host}:{config_port} üzerinde başlatılacak.");

        uvicorn.run("services:app", host=config_host, port=config_port, reload=False) 

    except Exception as main_e: print(f"Ana çalıştırma hatası: {main_e}"); sys.exit(1);