# data_access_layer.py
# AIX Projesi için Merkezi Veri Erişim Katmanı (DAAL)
# MongoDB ve Qdrant ile etkileşimi yönetir. İçsel vektörleştirme varsayılır.

import pymongo
import configparser
import os
from pymongo.errors import ConnectionFailure, ConfigurationError, OperationFailure
from bson.objectid import ObjectId
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import numpy as np

# Qdrant importları
try:
    import qdrant_client
    from qdrant_client.http import models as qdrant_models
    from qdrant_client.http.models import Distance, VectorParams, PointStruct
    from qdrant_client.http.models import Filter, FieldCondition, Range, MatchValue, PointIdsList
    QDRANT_AVAILABLE = True
except ImportError:
    QDRANT_AVAILABLE = False
    qdrant_models = None
    PointStruct = None # Hata vermemesi için None atayalım
    # print("DAAL UYARI: 'qdrant-client' kütüphanesi bulunamadı...") # Loglama ile ele alınacak

# --- Sabitler ve Yapılandırma Anahtarları ---
DEFAULT_EMBEDDING_DIMENSION = 384 # Bu değer config'den okunur
QDRANT_COLLECTION_NAME = "aix_internal_embeddings" # Koleksiyon adı
# EMBEDDING_MODEL_KEY kaldırıldı
INDEXED_NEURON_TYPES = ["diyalog_anisi", "veri_parcacigi", "kavram"] # Indexlenecek tipler

class DataAccessLayer:
    """
    MongoDB ve Qdrant veritabanları ile etkileşim kurmak için merkezi erişim katmanı.
    """
    def __init__(self, config_file='config.ini'):
        """
        DAAL'ı başlatır, yapılandırmayı yükler ve veritabanlarına bağlanır.
        """
        self.config_file = config_file
        self.config: Optional[configparser.ConfigParser] = None
        self.db_uri: Optional[str] = None
        self.db_name: Optional[str] = None
        self.qdrant_path: Optional[str] = None
        self.embedding_dimension: int = DEFAULT_EMBEDDING_DIMENSION
        self.client: Optional[pymongo.MongoClient] = None
        self.db: Optional[pymongo.database.Database] = None
        self.neurons_collection: Optional[pymongo.collection.Collection] = None
        self.relationships_collection: Optional[pymongo.collection.Collection] = None
        self.log_collection: Optional[pymongo.collection.Collection] = None
        self.qdrant_client: Optional[qdrant_client.QdrantClient] = None

        try:
            self._load_config()
            self._connect_db()
            if QDRANT_AVAILABLE and self.qdrant_path:
                self._init_qdrant()
        except Exception as e:
            print(f"DAAL KRİTİK HATA: Başlatma sırasında hata: {e}")
            raise

    def _load_config(self):
        """Yapılandırmayı belirtilen INI dosyasından yükler."""
        if not os.path.exists(self.config_file):
             raise FileNotFoundError(f"Yapılandırma dosyası '{self.config_file}' mevcut değil.")
        self.config = configparser.ConfigParser(); self.config.optionxform = str
        self.config.read(self.config_file, encoding='utf-8')
        try:
            self.db_uri = self.config.get('MongoDB', 'uri')
            self.db_name = self.config.get('MongoDB', 'database_name')
        except (configparser.Error, KeyError) as e:
             raise ValueError(f"Config [MongoDB] 'uri' veya 'database_name' hatası/eksik: {e}") from e
        try:
            self.qdrant_path = self.config.get('Qdrant', 'local_path')
            self.embedding_dimension = self.config.getint('Qdrant', 'embedding_dimension')
        except (configparser.Error, KeyError, ValueError) as e:
             print(f"DAAL UYARI: Config [Qdrant] ayarları okunamadı/hatalı: {e}. Qdrant kullanılamayabilir.")
             self.qdrant_path = None
             self.embedding_dimension = DEFAULT_EMBEDDING_DIMENSION

    def _connect_db(self):
        """MongoDB bağlantısını kurar ve koleksiyonları seçer."""
        if not self.db_uri or not self.db_name: raise ValueError("DB URI/Adı yüklenemedi.")
        try:
            self.client = pymongo.MongoClient(self.db_uri, serverSelectionTimeoutMS=5000)
            self.client.admin.command('ping')
            self.db = self.client[self.db_name]
            # Türkçe koleksiyon isimleri
            self.neurons_collection = self.db['noronlar']
            self.relationships_collection = self.db['iliskiler']
            self.log_collection = self.db['gunluk_kayitlari']
        except Exception as e:
            self.client = None; self.db = None; # Hata durumunda temizle
            raise ConnectionFailure(f"MongoDB bağlantı hatası: {e}") from e

    def _init_qdrant(self):
        """Qdrant istemcisini başlatır ve koleksiyonu hazırlar."""
        if not QDRANT_AVAILABLE or not self.qdrant_path: return
        try:
            self.qdrant_client = qdrant_client.QdrantClient(path=self.qdrant_path)
            collection_name = QDRANT_COLLECTION_NAME; collection_exists = False;
            try:
                if any(c.name == collection_name for c in self.qdrant_client.get_collections().collections): collection_exists = True;
            except Exception: pass

            vectors_config=qdrant_models.VectorParams(size=self.embedding_dimension, distance=qdrant_models.Distance.COSINE)

            if collection_exists:
                 try:
                     coll_info = self.qdrant_client.get_collection(collection_name=collection_name)
                     if coll_info.vectors_config.params.size != self.embedding_dimension or \
                        coll_info.vectors_config.params.distance != qdrant_models.Distance.COSINE:
                          self.qdrant_client.recreate_collection(collection_name=collection_name, vectors_config=vectors_config)
                 except Exception as get_coll_e:
                      try: self.qdrant_client.recreate_collection(collection_name=collection_name, vectors_config=vectors_config)
                      except Exception as recreate_e: raise Exception(f"Qdrant koleksiyonu kontrol/yeniden oluşturma hatası: {recreate_e}") from get_coll_e
            else:
                 self.qdrant_client.create_collection(collection_name=collection_name, vectors_config=vectors_config)
            print(f"DAAL: Qdrant istemcisi '{collection_name}' koleksiyonu ile hazır.")
        except Exception as e:
            print(f"DAAL HATA: Qdrant başlatılırken/koleksiyon oluşturulurken hata: {e}")
            self.qdrant_client = None

    # --- Koleksiyonlara Erişim Metotları ---
    def get_neurons_collection(self) -> Optional[pymongo.collection.Collection]:
        """'noronlar' koleksiyon nesnesini döndürür."""
        return self.neurons_collection

    def get_relationships_collection(self) -> Optional[pymongo.collection.Collection]:
        """'iliskiler' koleksiyon nesnesini döndürür."""
        return self.relationships_collection

    def get_log_collection(self) -> Optional[pymongo.collection.Collection]:
        """'gunluk_kayitlari' koleksiyon nesnesini döndürür."""
        return self.log_collection

    # --- Yardımcı Metotlar ---
    def is_connected(self) -> bool:
        """MongoDB istemcisinin bağlı olup olmadığını kontrol eder."""
        if not self.client: return False;
        try: self.client.admin.command('ping'); return True;
        except: return False;

    def close_connection(self):
        """MongoDB bağlantısını kapatır."""
        if self.client: self.client.close(); self.client = None;
        self.qdrant_client = None; # Lokal modda referansı kaldırmak yeterli
        print("DAAL: Bağlantılar kapatıldı.");

    def _string_to_objectid(self, id_str: str) -> Optional[ObjectId]:
        """String'i güvenli ObjectId'ye çevirir."""
        if isinstance(id_str, ObjectId): return id_str
        if not isinstance(id_str, str) or len(id_str) != 24: return None;
        try: return ObjectId(id_str);
        except: return None;

    # --- Qdrant Senkronizasyon Yardımcıları ---
    def _create_qdrant_payload(self, noron_dokumani: dict) -> Optional[dict]:
        """ Nöron dokümanından Qdrant payload'u oluşturur (mongo_kimligi, kullanici_kimligi, olusturulma_ts)."""
        if not noron_dokumani or '_id' not in noron_dokumani: return None
        payload = {"mongo_kimligi": str(noron_dokumani['_id'])} # Türkçe anahtar
        metaveri = noron_dokumani.get('metaveri', {})
        if metaveri:
             kullanici_kimligi = metaveri.get('kullanici_kimligi'); olusturulma_zamani = metaveri.get('olusturulma_zamani');
             if kullanici_kimligi: payload['kullanici_kimligi'] = str(kullanici_kimligi) # Türkçe anahtar
             if isinstance(olusturulma_zamani, datetime): payload['olusturulma_ts'] = olusturulma_zamani.timestamp() # Türkçe anahtar
        return payload

    def _upsert_vector(self, noron_kimligi: ObjectId, vektor: list[float], payload: dict = None) -> bool:
        """Qdrant'a vektör ekler/günceller."""
        if not self.qdrant_client or not QDRANT_AVAILABLE: return False
        if not isinstance(noron_kimligi, ObjectId) or not vektor or len(vektor) != self.embedding_dimension: return False
        if payload is None: payload = {};
        payload['mongo_kimligi'] = str(noron_kimligi) # Türkçe anahtar
        try:
            nokta_kimligi_str = str(noron_kimligi);
            # PointStruct import edildiği varsayılır
            if PointStruct:
                self.qdrant_client.upsert(collection_name=QDRANT_COLLECTION_NAME, points=[PointStruct(id=nokta_kimligi_str, vector=vektor, payload=payload)], wait=True);
                return True
            else:
                # Loglama daha iyi olabilir
                print("DAAL HATA: Qdrant PointStruct import edilemedi.")
                return False
        except Exception as e: self.olay_gunlukle("DAAL", "qdrant_upsert_hatasi", "error", {"mongo_kimligi": str(noron_kimligi), "hata": str(e)}); return False

    def _delete_vector(self, noron_kimligi: ObjectId | str) -> bool:
        """Qdrant'tan vektör siler."""
        if not self.qdrant_client or not QDRANT_AVAILABLE: return False
        nokta_kimligi_str = str(noron_kimligi) if isinstance(noron_kimligi, ObjectId) else (noron_kimligi if self._string_to_objectid(noron_kimligi) else None)
        if not nokta_kimligi_str: return False
        try:
            # PointIdsList import edildiği varsayılır
            if qdrant_models:
                self.qdrant_client.delete(collection_name=QDRANT_COLLECTION_NAME, points_selector=qdrant_models.PointIdsList(points=[nokta_kimligi_str]), wait=True);
                return True
            else:
                print("DAAL HATA: Qdrant modelleri import edilemedi.")
                return False
        except Exception as e: self.olay_gunlukle("DAAL", "qdrant_silme_hatasi", "error", {"mongo_kimligi": nokta_kimligi_str, "hata": str(e)}); return False

    # --- Nöron CRUD Operasyonları ---
    def noron_ekle(self, noron_verisi: dict) -> Optional[ObjectId]:
        """Yeni bir nöronu MongoDB'ye ekler ve (gerekirse) Qdrant'ı senkronize eder."""
        neurons_col = self.get_neurons_collection();
        if neurons_col is None: self.olay_gunlukle("DAAL", "noron_ekle_hata", "error", {"sebep": "Koleksiyon yok"}); return None;
        inserted_id = None;
        try:
            now = datetime.utcnow(); noron_verisi.setdefault('metaveri', {})['olusturulma_zamani'] = noron_verisi['metaveri'].get('olusturulma_zamani', now);
            noron_verisi['metaveri']['son_degistirme_zamani'] = now;
            if '_id' in noron_verisi: del noron_verisi['_id'];
            qdrant_icin_veri = noron_verisi.copy();
            insert_result = neurons_col.insert_one(noron_verisi); inserted_id = insert_result.inserted_id;
            if inserted_id and qdrant_icin_veri.get('noron_tipi') in INDEXED_NEURON_TYPES:
                 vektor_alani = qdrant_icin_veri.get('vektorler', {})
                 if vektor_alani and isinstance(vektor_alani, dict):
                      vektor = vektor_alani.get('vektor')
                      if vektor and isinstance(vektor, list) and len(vektor) == self.embedding_dimension:
                          final_data = qdrant_icin_veri | {"_id": inserted_id, "metaveri": qdrant_icin_veri.get('metaveri',{})};
                          payload = self._create_qdrant_payload(final_data);
                          if payload:
                              upsert_ok = self._upsert_vector(inserted_id, vektor, payload);
                              if not upsert_ok: self.olay_gunlukle("DAAL", "qdrant_sync_error", "warning", {"op": "add", "id": str(inserted_id)});
            return inserted_id;
        except Exception as e: self.olay_gunlukle("DAAL", "noron_ekle_hata", "error", {"hata": str(e)}); return None;

    def kimlikle_noron_getir(self, noron_kimligi: str | ObjectId) -> Optional[dict]:
        """ID ile nöron getirir."""
        neurons_col = self.get_neurons_collection();
        if neurons_col is None: return None;
        oid = noron_kimligi if isinstance(noron_kimligi, ObjectId) else self._string_to_objectid(noron_kimligi);
        if oid is None: return None;
        try: return neurons_col.find_one({"_id": oid});
        except Exception as e: self.olay_gunlukle("DAAL", "noron_getir_hata", "error", {"kimlik": str(oid), "hata": str(e)}); return None;

    def noronlari_bul(self, sorgu: dict, limit: int = 0, siralama_kriteri: list = None) -> List[dict]:
        """Sorgu ile nöronları bulur."""
        neurons_col = self.get_neurons_collection();
        if neurons_col is None: return [];
        try:
             cursor=neurons_col.find(sorgu);
             if siralama_kriteri: cursor=cursor.sort(siralama_kriteri);
             if limit > 0: cursor=cursor.limit(limit);
             return list(cursor);
        except Exception as e: self.olay_gunlukle("DAAL", "noron_bul_hata", "error", {"sorgu": str(sorgu), "hata": str(e)}); return [];

    def noron_guncelle(self, noron_kimligi: str | ObjectId, guncelleme_alanlari: dict, kaldirilacak_alanlar: Optional[list] = None) -> bool:
        """Nöronu MongoDB'de günceller ve Qdrant'ı senkronize eder."""
        neurons_col = self.get_neurons_collection();
        if neurons_col is None: return False;
        oid = noron_kimligi if isinstance(noron_kimligi, ObjectId) else self._string_to_objectid(noron_kimligi);
        if oid is None: return False;
        try:
            update_doc = {}; now = datetime.utcnow(); set_ops = guncelleme_alanlari or {}; unset_ops = kaldirilacak_alanlar or [];
            current_set = update_doc.setdefault('$set', {}); current_set.update(set_ops);
            if '_id' in current_set: del current_set['_id'];
            current_set['metaveri.son_degistirme_zamani'] = now;
            if unset_ops: safe_unset_fields = [f for f in unset_ops if f != 'metaveri.son_degistirme_zamani'];
                 if safe_unset_fields: update_doc['$unset'] = {field: "" for field in safe_unset_fields};
            if not update_doc.get('$set') and not update_doc.get('$unset'): return True;

            update_result = neurons_col.update_one({"_id": oid}, update_doc);
            if update_result.matched_count == 0: return False;

            neuron_after_update = self.kimlikle_noron_getir(oid);
            if neuron_after_update and neuron_after_update.get('noron_tipi') in INDEXED_NEURON_TYPES:
                 embedding_present_after = 'vektorler' in neuron_after_update and isinstance(neuron_after_update['vektorler'],dict) and 'vektor' in neuron_after_update['vektorler']
                 if embedding_present_after:
                     vektor_alani = neuron_after_update['vektorler']
                     vector = vektor_alani.get('vektor')
                     payload = self._create_qdrant_payload(neuron_after_update)
                     if payload and vector and isinstance(vector, list) and len(vector) == self.embedding_dimension:
                         # if algoritma_surumu: payload['vektor_surumu'] = algoritma_surumu # Yorum kaldırıldı
                         upsert_ok = self._upsert_vector(oid, vector, payload)
                         if not upsert_ok: self.olay_gunlukle("DAAL", "qdrant_sync_error", "warning", {"op": "update_upsert", "id": str(oid)})
                     else: self._delete_vector(oid);
                 else: self._delete_vector(oid)

            return True;
        except Exception as e: self.olay_gunlukle("DAAL", "noron_guncelleme_hatasi", "error", {"id": str(oid), "hata": str(e)}); return False;

    def noron_sil(self, noron_kimligi: str | ObjectId) -> bool:
        """Nöronu MongoDB'den ve Qdrant'tan siler."""
        self._delete_vector(noron_kimligi) # Önce Qdrant'tan silmeyi dene
        neurons_col = self.get_neurons_collection();
        if neurons_col is None: return False;
        oid = noron_kimligi if isinstance(noron_kimligi, ObjectId) else self._string_to_objectid(noron_kimligi);
        if oid is None: return False;
        mongo_delete_success = False;
        try:
            delete_result = neurons_col.delete_one({"_id": oid});
            mongo_delete_success = (delete_result.deleted_count == 1);
            return mongo_delete_success;
        except Exception as e: self.olay_gunlukle("DAAL", "noron_silme_hatasi", "error", {"id": str(oid), "hata": str(e)}); return False;

    # --- İlişki CRUD Operasyonları ---
    def iliski_ekle(self, iliski_verisi: dict) -> Optional[ObjectId]:
        """Yeni bir ilişki ekler."""
        rels_col=self.get_relationships_collection(); if rels_col is None: return None;
        try:
             iliski_verisi.setdefault('metaveri', {})['olusturulma_zamani'] = datetime.utcnow();
             for k in ['kaynak_noron_kimligi','hedef_noron_kimligi']:
                 if k in iliski_verisi:
                     o = iliski_verisi[k] if isinstance(iliski_verisi[k], ObjectId) else self._string_to_objectid(str(iliski_verisi[k]))
                     if o is None: raise ValueError(f"Geçersiz ObjectId: {k}");
                     iliski_verisi[k]=o;
             if not all(f in iliski_verisi for f in ['kaynak_noron_kimligi','hedef_noron_kimligi','iliski_tipi']): raise ValueError("Zorunlu ilişki alanları eksik");
             if '_id' in iliski_verisi: del iliski_verisi['_id'];
             return rels_col.insert_one(iliski_verisi).inserted_id;
        except Exception as e: self.olay_gunlukle("DAAL","iliski_ekleme_hatasi","error",{"error":str(e)}); return None;

    def kimlikle_iliski_getir(self, iliski_kimligi: str|ObjectId) -> Optional[dict]:
        """ID ile ilişki getirir."""
        rels_col = self.get_relationships_collection(); if rels_col is None: return None;
        oid = iliski_kimligi if isinstance(iliski_kimligi,ObjectId) else self._string_to_objectid(iliski_kimligi); if oid is None: return None;
        try: return rels_col.find_one({"_id":oid});
        except Exception as e: self.olay_gunlukle("DAAL","iliski_getirme_hatasi","error",{"kimlik": str(oid), "error":str(e)}); return None;

    def iliskileri_bul(self, sorgu: dict, limit: int=0, siralama: list=None)-> List[dict]:
        """Sorgu ile ilişkileri bulur."""
        rels_col = self.get_relationships_collection(); if rels_col is None: return [];
        try:
             if 'kaynak_noron_kimligi' in sorgu and isinstance(sorgu['kaynak_noron_kimligi'], str): sorgu['kaynak_noron_kimligi'] = self._string_to_objectid(sorgu['kaynak_noron_kimligi'])
             if 'hedef_noron_kimligi' in sorgu and isinstance(sorgu['hedef_noron_kimligi'], str): sorgu['hedef_noron_kimligi'] = self._string_to_objectid(sorgu['hedef_noron_kimligi'])
             cursor=rels_col.find(sorgu);
             if siralama: cursor=cursor.sort(siralama);
             if limit>0: cursor=cursor.limit(limit);
             return list(cursor);
        except Exception as e: self.olay_gunlukle("DAAL","iliski_bulma_hatasi","error",{"sorgu":str(sorgu),"error":str(e)}); return [];

    def iliski_guncelle(self, iliski_kimligi: str|ObjectId, guncelleme_alanlari: dict, kaldirilacak_alanlar: list=None) -> bool:
        """ID ile ilişkiyi günceller."""
        rels_col = self.get_relationships_collection(); if rels_col is None: return False;
        oid = iliski_kimligi if isinstance(iliski_kimligi,ObjectId) else self._string_to_objectid(iliski_kimligi); if oid is None: return False;
        try:
             update_doc={}; set_ops=guncelleme_alanlari.copy(); unset_ops=kaldirilacak_alanlar or [];
             if set_ops:
                 if '_id' in set_ops: del set_ops['_id'];
                 for k in ['kaynak_noron_kimligi','hedef_noron_kimligi']:
                     if k in set_ops:
                         o = set_ops[k] if isinstance(set_ops[k], ObjectId) else self._string_to_objectid(str(set_ops[k]))
                         if o is None: del set_ops[k];
                         else: set_ops[k]=o;
                 if set_ops: update_doc['$set']=set_ops;
             if unset_ops: update_doc['$unset']={f:"" for f in unset_ops};
             if not update_doc.get('$set') and not update_doc.get('$unset'): return True;
             update_result=rels_col.update_one({"_id":oid}, update_doc); return update_result.matched_count > 0;
        except Exception as e: self.olay_gunlukle("DAAL","iliski_guncelleme_hatasi","error",{"kimlik":str(oid),"error":str(e)}); return False;

    def iliski_sil(self, iliski_kimligi: str|ObjectId) -> bool:
        """ID ile ilişkiyi siler."""
        rels_col = self.get_relationships_collection(); if rels_col is None: return False;
        oid = iliski_kimligi if isinstance(iliski_kimligi,ObjectId) else self._string_to_objectid(iliski_kimligi); if oid is None: return False;
        try: delete_result=rels_col.delete_one({"_id":oid}); return delete_result.deleted_count == 1;
        except Exception as e: self.olay_gunlukle("DAAL","iliski_silme_hatasi","error",{"kimlik":str(oid),"error":str(e)}); return False;
class DataAccessLayer:


    # --- Yapılandırma (Config) Yönetimi ---
    def yapilandirma_degeri_getir(self, parametre_adi: str, varsayilan: Any = None) -> Any:
        """Yapılandırma değerini okur ('yapilandirma_dugumu' tipinden)."""
        n_col = self.get_neurons_collection(); 
        if n_col is None: return varsayilan;
        try: 
            sorgu={"noron_tipi":"yapilandirma_dugumu", "icerik.parametre_adi":parametre_adi}; 
            projeksiyon={"icerik.deger":1, "_id":0};
            cfg=n_col.find_one(sorgu, projeksiyon); 
            return cfg['icerik']['deger'] if cfg and 'icerik' in cfg and 'deger' in cfg['icerik'] else varsayilan;
        except Exception as e: 
            # Config okuma hatası genellikle kritik değildir, uyarı loglanabilir.
            print(f"DAAL UYARI (Config Oku - {parametre_adi}): {e}"); 
            return varsayilan; 

    def yapilandirma_degeri_ayarla(self, parametre_adi: str, deger: Any, aciklama: str = None) -> bool:
        """Yapılandırma değerini ayarlar/günceller ('yapilandirma_dugumu' oluşturur/günceller)."""
        n_col = self.get_neurons_collection(); 
        if n_col is None: return False;
        try: 
            sorgu={"noron_tipi":"yapilandirma_dugumu","icerik.parametre_adi":parametre_adi}; 
            now=datetime.utcnow();
            guncelleme_seti={
                'icerik.deger':deger, 
                'metaveri.son_degistirme_zamani':now
            }
            ilk_ekleme_seti={
                'noron_tipi':'yapilandirma_dugumu',
                'icerik.parametre_adi':parametre_adi, 
                'metaveri.olusturulma_zamani':now, 
                'metaveri.kaynak':'daal_ayarlama'
            }
            desc = aciklama if aciklama is not None else f"{parametre_adi} ayarı."; 
            guncelleme_seti['icerik.aciklama']=desc; 
            ilk_ekleme_seti['icerik.aciklama']=desc;
            
            update_doc = {'$set': guncelleme_seti, '$setOnInsert': ilk_ekleme_seti}
            
            res=n_col.update_one(sorgu, update_doc, upsert=True);
            success = res.acknowledged and (res.matched_count > 0 or res.upserted_id is not None);
            if not success: 
                self.olay_gunlukle("DAAL", "yapilandirma_ayarlama_basarisiz", "error", {"parametre":parametre_adi});
            return success;
        except Exception as e: 
            self.olay_gunlukle("DAAL","yapilandirma_ayarlama_hatasi","error",{"parametre":parametre_adi, "error":str(e)}); 
            return False;

    # --- Loglama ---
    def olay_gunlukle(self, kaynak_bilesen: str, olay_tipi: str, seviye: str='info', detaylar: dict=None) -> Optional[ObjectId]:
         """Sistem olaylarını loglar ('gunluk_kayitlari' koleksiyonuna)."""
         l_col=self.get_log_collection(); 
         if l_col is None: 
             # Veritabanı hazır değilse konsola yazdır
             print(f"!!! LOGLAMA HATASI (Koleksiyon Yok): [{kaynak_bilesen}] {olay_tipi} - {detaylar}")
             return None;
         try: 
             doc={
                 "zaman_damgasi":datetime.utcnow(), 
                 "kaynak_bilesen":kaynak_bilesen, 
                 "olay_tipi":olay_tipi, 
                 "seviye":seviye, 
                 "detaylar":detaylar if detaylar else {}
             };
             res=l_col.insert_one(doc); 
             return res.inserted_id;
         except Exception as e: 
             # Loglama hatası kritik olmayabilir, sadece konsola yazdır
             print(f"DAAL HATA (Log Yaz - {olay_tipi}): {e}"); 
             return None; 

    # --- Kullanıcı Girdisi Yönetimi ---
    def kullanici_geri_bildirimi_kaydet(self, diyalog_noron_kimligi: str | ObjectId, geri_bildirim_verisi: dict) -> bool:
        """Kullanıcı geri bildirimini ilgili diyalog nöronunun metaverisine kaydeder."""
        # Geri bildirime zaman damgası ekle (varsa üzerine yazmaz)
        geri_bildirim_verisi.setdefault("zaman_damgasi", datetime.utcnow());
        # metaveri.kullanici_geri_bildirimi alanını güncelle
        return self.noron_guncelle(diyalog_noron_kimligi, {"metaveri.kullanici_geri_bildirimi": geri_bildirim_verisi});


    # --- Hipotez Yönetimi ---
    def hipotez_ekle(self, ifade: str, guven: float=0.5, lehte_kanit_kimlikleri: Optional[List[ObjectId]]=None, aleyhte_kanit_kimlikleri: Optional[List[ObjectId]]=None, kaynak: str='yansima') -> Optional[ObjectId]:
        """Yeni hipotez nöronu ekler."""
        noron_verisi={
            "noron_tipi":"hipotez_dugumu", 
            "icerik":{
                "ifade":ifade, 
                "lehte_kanit_kimlikleri":lehte_kanit_kimlikleri if lehte_kanit_kimlikleri else [], 
                "aleyhte_kanit_kimlikleri":aleyhte_kanit_kimlikleri if aleyhte_kanit_kimlikleri else [], 
                "guven":max(0.0, min(1.0, guven)) # 0-1 aralığında
            }, 
            "metaveri":{
                "durum":"beklemede", # pending
                "kaynak":kaynak, 
                "test_gunluk_kimlikleri":[]
            }
        }; 
        return self.noron_ekle(noron_verisi);

    def hipotez_durumu_guncelle(self, hipotez_kimligi: str|ObjectId, yeni_durum: str, kanit_kimligi: Optional[ObjectId]=None, guven: Optional[float]=None) -> bool:
        """Hipotez durumunu, güvenini ve (varsa) kanıtını günceller."""
        gecerli_durumlar = ['beklemede','onaylandi','reddedildi']
        if yeni_durum not in gecerli_durumlar: return False; 
        
        guncelleme_seti={"metaveri.durum":yeni_durum};
        if guven is not None: 
            guncelleme_seti["icerik.guven"]=max(0.0, min(1.0, guven));
            
        # Önce durumu/güveni güncelle
        ok=self.noron_guncelle(hipotez_kimligi, guncelleme_seti); 
        if not ok: 
            self.olay_gunlukle("DAAL", "hipotez_durum_guncelleme_basarisiz", "error", {"hipotez_kimligi": str(hipotez_kimligi)})
            return False;
            
        # Sonra kanıtı ekle (eğer varsa ve durum değiştiyse)
        if kanit_kimligi and isinstance(kanit_kimligi, ObjectId):
             kanit_alani = None
             if yeni_durum == 'onaylandi': kanit_alani = 'icerik.lehte_kanit_kimlikleri'
             elif yeni_durum == 'reddedildi': kanit_alani = 'icerik.aleyhte_kanit_kimlikleri'
             
             if kanit_alani: 
                 n_col=self.get_neurons_collection(); if n_col is None: return False;
                 oid=hipotez_kimligi if isinstance(hipotez_kimligi, ObjectId) else self._string_to_objectid(hipotez_kimligi); 
                 if oid is None: return False;
                 try: 
                     # $addToSet ile aynı kanıtın tekrar eklenmesini önle
                     kanit_guncelleme = {'$addToSet': {kanit_alani: kanit_kimligi}};
                     res=n_col.update_one({"_id":oid}, kanit_guncelleme); 
                     # Eşleşme olmaması sorun değil, ana güncelleme yapıldı.
                     # return res.matched_count > 0; # Bu satır kaldırıldı
                 except Exception as e: 
                     self.olay_gunlukle("DAAL","hipotez_kanit_guncelleme_hatasi","error", {"kimlik": str(oid), "kanit_kimligi": str(kanit_kimligi), "hata":str(e)}); 
                     return False; # Kanıt ekleme hatası kritik olabilir
                     
        return True; # Durum güncellendi

    def hipotezleri_bul(self, durum: Optional[str]=None, min_guven: Optional[float]=None, max_guven: Optional[float]=None, limit: int=0, siralama: Optional[list]=None) -> List[dict]:
        """Hipotezleri sorgular."""
        sorgu={"noron_tipi":"hipotez_dugumu"};
        if durum: sorgu["metaveri.durum"]=durum;
        guven_sorgusu={};
        if min_guven is not None: guven_sorgusu['$gte']=max(0.0,min(1.0,min_guven));
        if max_guven is not None: guven_sorgusu['$lte']=max(0.0,min(1.0,max_guven));
        if guven_sorgusu: sorgu["icerik.guven"]=guven_sorgusu;
        return self.noronlari_bul(sorgu, limit, siralama);

    # --- Anlamsal Hafıza Erişimi (İçsel Vektörlerle) ---
    def ilgili_gecmisi_getir(self, baglam_vektoru: List[float], k: int=5, kullanici_kimligi: Optional[str]=None, gun_araligi: Optional[float]=None, benzerlik_esigi: Optional[float]=None)-> List[Dict]:
        """Qdrant ile anlamsal geçmişi getirir (AIX üretimi içsel vektörlerle)."""
        if not self.qdrant_client or not QDRANT_AVAILABLE: self.olay_gunlukle("DAAL","anlamsal_arama_hatasi", "error", {"sebep": "Qdrant yok"}); return [];
        if not baglam_vektoru or not isinstance(baglam_vektoru, list) or len(baglam_vektoru)!=self.embedding_dimension: self.olay_gunlukle("DAAL","anlamsal_arama_hatasi", "error", {"sebep": "Geçersiz vektör"}); return [];
        if k<=0: return [];
        try:
            # Payload filtrelerini oluştur (Türkçe anahtarlarla)
            kosullar=[];
            if kullanici_kimligi: kosullar.append(qdrant_models.FieldCondition(key="kullanici_kimligi",match=qdrant_models.MatchValue(value=kullanici_kimligi)));
            if gun_araligi and gun_araligi>0: try: baslangic_ts=(datetime.utcnow()-timedelta(days=gun_araligi)).timestamp(); kosullar.append(qdrant_models.FieldCondition(key="olusturulma_ts",range=qdrant_models.Range(gte=baslangic_ts))); except: pass;
            # TODO: Vektör sürümü filtresi eklenebilir (payload'da varsa)
            # if vektor_surumu: kosullar.append(qdrant_models.FieldCondition(key="vektor_surumu", match=...))
            qdrant_filtre = qdrant_models.Filter(must=kosullar) if kosullar else None;
            
            # Qdrant araması
            arama_sonucu: List[qdrant_models.ScoredPoint] = self.qdrant_client.search(
                collection_name=QDRANT_COLLECTION_NAME, 
                query_vector=baglam_vektoru, 
                query_filter=qdrant_filtre, 
                limit=k, 
                score_threshold=benzerlik_esigi, 
                with_payload=True, # Payload'u al (mongo_kimligi için)
                with_vectors=False # Vektörleri tekrar çekmeye gerek yok
            );
            
            # MongoDB'den tam nöronları çek
            mongo_kimlikleri_str=[h.payload.get('mongo_kimligi') for h in arama_sonucu if h.payload and h.payload.get('mongo_kimligi')];
            skorlar={h.payload.get('mongo_kimligi'):h.score for h in arama_sonucu if h.payload and h.payload.get('mongo_kimligi')};
            if not mongo_kimlikleri_str: return []; 
            oidler=[o for s in mongo_kimlikleri_str if (o:=self._string_to_objectid(s))]; 
            if not oidler: return [];
            
            # MongoDB'den nöronları toplu çek
            mongo_harita={str(n['_id']):n for n in self.noronlari_bul({"_id":{"$in":oidler}})};
            
            # Skorları ekleyerek ve Qdrant sırasına göre sonuç listesini oluştur
            son_liste=[(noron:=mongo_harita.get(kimlik_s), noron.__setitem__('benzerlik_skoru', skorlar.get(kimlik_s)))[0] for kimlik_s in mongo_kimlikleri_str if kimlik_s in mongo_harita];
            
            return son_liste;
        except Exception as e: 
            self.olay_gunlukle("DAAL","anlamsal_arama_hatasi","error",{"error":str(e)}); 
            return [];

    # --- Modül Yönetimi ---
    def modul_durumu_guncelle(self, modul_kimligi: str|ObjectId, yeni_durum: str, detaylar: Optional[Dict]=None)-> bool:
        """Modül tanımı nöronunun durumunu günceller."""
        n_col = self.get_neurons_collection(); if n_col is None: return False;
        oid = modul_kimligi if isinstance(modul_kimligi, ObjectId) else self._string_to_objectid(modul_kimligi); if oid is None: return False;
        try: 
            u={'$set':{}, '$push':{}}; now=datetime.utcnow(); 
            u['$set']['metaveri.durum']=yeni_durum; 
            u['$set']['metaveri.son_degistirme_zamani']=now;
            if detaylar and isinstance(detaylar, dict): 
                detaylar.setdefault('zaman_damgasi',now); 
                detaylar.setdefault('yeni_durum',yeni_durum); 
                u['$push']['metaveri.durum_gecmisi']={'$each':[detaylar],'$slice':-20}; # Son 20 durumu tut
            if not u['$push']: del u['$push']; 
            if not u['$set']: del u['$set']; # Sadece push varsa $set'i silme
            if not u: return False; # Güncelleme yoksa
            
            res=n_col.update_one({"_id":oid, "noron_tipi":"modul_tanimi"}, u);
            if res.matched_count == 0: self.olay_gunlukle("DAAL", "modul_durum_guncelleme_uyari", "warning", {"id": str(oid), "sebep": "Bulunamadı"}); return False;
            return True;
        except Exception as e: self.olay_gunlukle("DAAL","modul_durum_guncelleme_hatasi","error",{"id":str(oid),"error":str(e)}); return False;

    def modul_bilesenlerini_getir(self, modul_kimligi: str | ObjectId) -> List[Dict]:
        """Modülün 'noron_icerir' ilişkisiyle bağlı bileşen nöronlarını getirir."""
        r_col=self.get_relationships_collection(); n_col=self.get_neurons_collection(); if r_col is None or n_col is None: return [];
        oid = modul_kimligi if isinstance(modul_kimligi,ObjectId) else self._string_to_objectid(modul_kimligi); if oid is None: return []; 
        bilesen_kimlikleri=[];
        try: 
            sorgu={"kaynak_noron_kimligi":oid, "iliski_tipi":"noron_icerir"}; 
            cursor=r_col.find(sorgu, {"hedef_noron_kimligi":1}); # Sadece hedef ID'yi al
            bilesen_kimlikleri=[rel.get('hedef_noron_kimligi') for rel in cursor if rel.get('hedef_noron_kimligi')]; 
            if not bilesen_kimlikleri: return [];
            # Bileşen nöronlarını toplu olarak getir
            return self.noronlari_bul({"_id":{"$in":bilesen_kimlikleri}});
        except Exception as e: self.olay_gunlukle("DAAL","modul_bilesen_getirme_hatasi","error",{"modul_kimligi":str(oid),"error":str(e)}); return [];

    # --- Benlik/Durum Yönetimi ---
    def ego_verisi_getir(self) -> Optional[Dict]:
        """ Tekil ego_dugumu nöronunu getirir. """
        try:
            sonuclar = self.noronlari_bul({"noron_tipi": "ego_dugumu"}, limit=1)
            if sonuclar: return sonuclar[0]
            else: self.olay_gunlukle("DAAL", "ego_getirme_hatasi", "warning", {"sebep": "Ego düğümü bulunamadı"}); return None
        except Exception as e: self.olay_gunlukle("DAAL", "ego_getirme_hatasi", "error", {"error": str(e)}); return None

    def oturum_cekirdegi_getir_veya_olustur(self, oturum_kimligi: str | ObjectId) -> Optional[Dict]:
        """ Verilen oturum_kimligi için oturum_cekirdegi nöronunu getirir veya varsayılanla oluşturur."""
        n_col = self.get_neurons_collection(); if n_col is None: return None;
        oturum_oid = oturum_kimligi if isinstance(oturum_kimligi, ObjectId) else self._string_to_objectid(oturum_kimligi);
        if oturum_oid is None: self.olay_gunlukle("DAAL", "oturum_cekirdegi_hatasi", "error", {"sebep": "Geçersiz oturum kimliği"}); return None;
        sorgu = {"noron_tipi": "oturum_cekirdegi", "metaveri.oturum_kimligi": oturum_oid};
        try:
            mevcut = n_col.find_one(sorgu);
            if mevcut: return mevcut;
            else: # Yoksa oluştur
                now = datetime.utcnow(); varsayilan_icerik = {"aktif_duygu_kimligi": None, "aktif_ruh_hali_kimligi": None, "duygu_yogunlugu": 0.0, "ruh_hali_yogunlugu": 0.1, "odak_seviyesi": 1.0, "islem_yuku": 0.0};
                noron_verisi = {"noron_tipi": "oturum_cekirdegi", "icerik": varsayilan_icerik, "metaveri": {"oturum_kimligi": oturum_oid, "olusturulma_zamani": now, "son_degistirme_zamani": now, "kaynak": "daal_getir_veya_olustur"}};
                eklenen_kimlik = self.noron_ekle(noron_verisi);
                if eklenen_kimlik: return self.kimlikle_noron_getir(eklenen_kimlik);
                else: self.olay_gunlukle("DAAL", "oturum_cekirdegi_hatasi", "error", {"sebep": "Yeni oluşturulamadı", "oturum_kimligi": str(oturum_oid)}); return None;
        except Exception as e: self.olay_gunlukle("DAAL", "oturum_cekirdegi_getirme_hatasi", "error", {"oturum_kimligi": str(oturum_oid), "error": str(e)}); return None;

    def oturum_cekirdegi_guncelle(self, oturum_kimligi: str | ObjectId, durum_icerik_verisi: Dict) -> bool:
         """ İlgili oturum_cekirdegi nöronunun icerik alanını $set ile günceller. """
         oid = oturum_kimligi if isinstance(oturum_kimligi, ObjectId) else self._string_to_objectid(oturum_kimligi);
         if oid is None: return False;
         guncelleme_alanlari = {f"icerik.{anahtar}": deger for anahtar, deger in durum_icerik_verisi.items()};
         # noron_guncelle metodu son_degistirme_zamani'nı otomatik günceller.
         return self.noron_guncelle(oid, guncelleme_alanlari);

