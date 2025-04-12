# system_tray_app.py
# AIX için Sistem Tepsisi Kontrol Uygulaması (PySide6) - API Entegrasyonlu

import sys
import os
import json
import threading
import configparser 
import time
import traceback
from typing import Optional, Dict, Any, List

# Gerekli PySide6 modülleri
from PySide6.QtWidgets import (
    QApplication, QSystemTrayIcon, QMenu, QFileDialog, QMessageBox, 
    QDialog, QVBoxLayout, QLabel, QDialogButtonBox # Ayarlar penceresi için
)
from PySide6.QtGui import QIcon, QAction, QPixmap, QColor
from PySide6.QtCore import Slot, QThread, Signal, QTimer, QCoreApplication, QPoint

# API istemcisi için requests
try:
    import requests
except ImportError:
    print("HATA: 'requests' kütüphanesi bulunamadı. Lütfen kurun: pip install requests")
    sys.exit(1)

# Chat penceresini import et 
try:
    from chat import ChatWindow 
except ImportError:
    print("HATA: 'chat.py' veya içindeki 'ChatWindow' sınıfı bulunamadı!")
    class ChatWindow: # Dummy class
        def __init__(self): self._is_visible = False
        def showNormal(self): self._is_visible = True; print("Dummy ChatWindow.showNormal()")
        def activateWindow(self): print("Dummy ChatWindow.activateWindow()")
        def raise_(self): print("Dummy ChatWindow.raise_()")
        def close(self): self._is_visible = False; print("Dummy ChatWindow.close()")
        def isVisible(self): return self._is_visible
        def isMinimized(self): return False
        def open_with_context(self, msg): self.showNormal(); print(f"Dummy Chat: {msg}")

# --- Ayarlar ve Yapılandırma Okuma ---
basedir = os.path.dirname(__file__)
DEFAULT_CONFIG_PATH = os.path.join(basedir, '..', 'config', 'config.ini') 
TRAY_ICON_FILE = os.path.join(basedir, "aix_icon.png") 

def load_api_url_from_config(config_path=DEFAULT_CONFIG_PATH) -> Optional[str]:
    """ Config dosyasından API URL'sini okur. Hata durumunda None döner. """
    config = configparser.ConfigParser(); config.optionxform = str; api_url = None;
    if not os.path.exists(config_path): print(f"HATA: Config dosyası bulunamadı: {config_path}."); return None;
    try:
        config.read(config_path, encoding='utf-8'); port = config.getint('Server', 'port'); host = config.get('Server', 'host', fallback='127.0.0.1');
        api_url = f"http://{host}:{port}"; 
    except Exception as e: print(f"HATA: Config API URL okuma hatası: {e}");
    return api_url

# --- API İstemcisi (Thread içinde çalışacak) ---
class ApiClientThread(QThread):
    """ API isteklerini arka planda gönderen thread sınıfı. """
    response_received = Signal(dict); error_occurred = Signal(str); finished_signal = Signal();
    def __init__(self, endpoint, data=None, method='post', api_base_url=None): 
        super().__init__(); self.endpoint = endpoint; self.data = data; self.method = method.lower();
        self.api_base_url = api_base_url; self.session = requests.Session();
    def run(self): # Gerçek istek gönderme mantığı
        if not self.api_base_url: self.error_occurred.emit("API Adresi yapılandırılamadı."); self.finished_signal.emit(); return
        try:
            url = f"{self.api_base_url}{self.endpoint}"; 
            headers = {'Content-Type': 'application/json'}; timeout_seconds = 15; # Tepsi işlemleri için timeout
            response = None
            if self.method == 'post': response = self.session.post(url, json=self.data, headers=headers, timeout=timeout_seconds)
            elif self.method == 'get': response = self.session.get(url, params=self.data, timeout=timeout_seconds) 
            else: raise NotImplementedError(f"Desteklenmeyen metod: {self.method}")
            response.raise_for_status(); response_json = response.json(); self.response_received.emit(response_json)
        except requests.exceptions.Timeout: self.error_occurred.emit(f"API zaman aşımı ({timeout_seconds}sn).")
        except requests.exceptions.ConnectionError: self.error_occurred.emit(f"AIX servisine bağlanılamadı ({self.api_base_url}).")
        except requests.exceptions.RequestException as e:
            error_detail = str(e);
            if e.response is not None:
                try: err_json = e.response.json(); error_detail = err_json.get('detail', str(e));
                except json.JSONDecodeError: error_detail = f"{e.response.status_code} {e.response.reason}";
            self.error_occurred.emit(f"API iletişim hatası: {error_detail}")
        except json.JSONDecodeError: self.error_occurred.emit("API'den geçersiz JSON.")
        except Exception as e: self.error_occurred.emit(f"API istemcisinde hata: {type(e).__name__} - {e}")
        finally: self.session.close(); self.finished_signal.emit()

# --- Ayarlar Penceresi (Basit İskelet) ---
class SettingsDialog(QDialog):
    """ AIX ayarlarını göstermek ve değiştirmek için diyalog penceresi. """
    # Bu sınıfın içi daha sonra detaylandırılacak (Tablar, Checkboxlar, Spinboxlar vb.)
    def __init__(self, parent=None, daal_instance=None, api_url=None):
        super().__init__(parent)
        self.daal = daal_instance # Ayarları okumak/yazmak için (veya API kullanılır)
        self.api_url = api_url
        self.setWindowTitle("AIX Ayarları")
        self.setMinimumWidth(450)
        
        layout = QVBoxLayout(self)
        label = QLabel("Ayarlar penceresi içeriği buraya eklenecek.\n(Genel, Arayüz, Gelişmiş sekmeleri)")
        label.setAlignment(Qt.AlignCenter)
        layout.addWidget(label)
        
        # Kaydet/İptal Butonları
        button_box = QDialogButtonBox(QDialogButtonBox.Ok | QDialogButtonBox.Cancel)
        button_box.accepted.connect(self.accept) # Şimdilik direkt kabul et
        button_box.rejected.connect(self.reject)
        layout.addWidget(button_box)
        
        # TODO: API'den ayarları çekme (/tum_ayarlari_getir ?)
        # TODO: Sekmeleri ve ayar widget'larını oluşturma
        # TODO: Kaydet butonuna basıldığında API'ye gönderme (/ayarlari_guncelle ?)

# --- Sistem Tepsisi Uygulaması ---
class SystemTrayApp:
    """ Sistem tepsisi ikonunu ve menüsünü yönetir. """
    def __init__(self, app: QApplication, chat_window: ChatWindow):
        self.app = app
        self.chat_window = chat_window 
        self.tray_icon = QSystemTrayIcon()
        self.api_url = load_api_url_from_config() 
        self.api_thread: Optional[ApiClientThread] = None

        # Başlangıç durumları (API'den çekilecek varsayılanlar)
        self.current_proactive_state = True 
        self.current_cmdexec_state = False  
        self.model_running = True # Başlangıçta çalıştığını varsayalım

        if not self.api_url:
             QMessageBox.critical(None, "Yapılandırma Hatası", "config.ini okunamadı veya [Server] ayarları geçersiz.\nUygulama kapatılacak.")
             sys.exit(1)

        self._create_icon() 
        self._create_menu() 

        self.tray_icon.setContextMenu(self.menu)
        self.tray_icon.show()
        
        if self.tray_icon.isVisible():
             print("AIX Sistem Tepsisi ikonu aktif.")
             self.fetch_initial_states() # Başlangıç ayar durumlarını çek
        else:
             print("HATA: AIX Sistem Tepsisi ikonu gösterilemedi.")
             QMessageBox.critical(None, "Hata", "Sistem Tepsisi ikonu oluşturulamadı.")
             sys.exit(1)

    def _create_icon(self):
        """ İkonu oluşturur veya varsayılanı kullanır. """
        if os.path.exists(TRAY_ICON_FILE): self.tray_icon.setIcon(QIcon(TRAY_ICON_FILE))
        else: print(f"UYARI: İkon bulunamadı: {TRAY_ICON_FILE}."); pixmap = QPixmap(32, 32); pixmap.fill(QColor("#202124")); self.tray_icon.setIcon(QIcon(pixmap))
        self.tray_icon.setToolTip("AIX Kontrol Paneli")
        self.tray_icon.activated.connect(self.handle_icon_activation)

    def _create_menu(self):
        """ Sağ tık menüsünü oluşturur ve eylemleri bağlar. """
        self.menu = QMenu()
        # --- Eylemler ---
        self.show_chat_action = QAction("Sohbeti Başlat/Göster"); self.show_chat_action.triggered.connect(self.handle_show_chat); self.menu.addAction(self.show_chat_action);
        self.add_data_action = QAction("Veri Ekle..."); self.add_data_action.triggered.connect(self.handle_add_data); self.menu.addAction(self.add_data_action);
        self.settings_action = QAction("Ayarlar..."); self.settings_action.triggered.connect(self.handle_show_settings); self.menu.addAction(self.settings_action); # Ayarlar eklendi
        self.menu.addSeparator()
        self.proactive_action = QAction(); self.proactive_action.triggered.connect(self.handle_toggle_proactive); self.menu.addAction(self.proactive_action);
        self.cmdexec_action = QAction(); self.cmdexec_action.triggered.connect(self.handle_toggle_command_exec); self.menu.addAction(self.cmdexec_action);
        self.menu.addSeparator()
        self.stop_action = QAction("Durdur"); self.stop_action.triggered.connect(self.handle_stop_model); self.menu.addAction(self.stop_action);
        self.exit_action = QAction("Çıkış"); self.exit_action.triggered.connect(self.handle_exit); self.menu.addAction(self.exit_action);
        # Başlangıç metinlerini ayarla
        self._update_proactive_action_text()
        self._update_cmdexec_action_text()
        self.stop_action.setEnabled(self.model_running) 

    def _update_proactive_action_text(self):
        """ Proaktif Mesaj menü öğesinin metnini günceller. """
        text = f"Proaktif Mesaj: {'Açık' if self.current_proactive_state else 'Kapalı'}"
        self.proactive_action.setText(text)

    def _update_cmdexec_action_text(self):
        """ Komut Çalıştırma menü öğesinin metnini günceller. """
        text = f"Komut Çalıştırma: {'Açık' if self.current_cmdexec_state else 'Kapalı'}"
        self.cmdexec_action.setText(text)

    def fetch_initial_states(self):
        """ Başlangıç ayarlarını API'den çeker. """
        print("Başlangıç ayarları API'den çekiliyor...")
        if not self.api_url: return 
        self._run_in_thread(self._get_setting_from_api, args=("ProaktifMesajEtkin",)) # Türkçe config adı
        self._run_in_thread(self._get_setting_from_api, args=("KomutCalistirmaEtkin",)) # Türkçe config adı

    def _get_setting_from_api(self, setting_name):
        """ Belirli bir ayarı API'den alır. """
        endpoint = "/ayar_getir"; # Türkçe endpoint
        # Parametre adını API'nin beklediği şekilde (İngilizce?) göndermek gerekebilir
        # veya API Türkçe kabul ediyorsa direkt gönderilir. Şimdilik Türkçe varsayalım.
        data = {"parameter_name": setting_name}; 
        api_thread = ApiClientThread(endpoint, data, method='get', api_base_url=self.api_url)
        # Lambda ile hangi ayarın istendiğini handlera taşı
        api_thread.response_received.connect(lambda response, name=setting_name: self._handle_get_setting_response(name, response))
        api_thread.error_occurred.connect(lambda error, name=setting_name: print(f"API Hatası ({name} durumu alınamadı): {error}"))
        api_thread.start() 

    @Slot(str, dict)
    def _handle_get_setting_response(self, setting_name, response_data):
        """ /ayar_getir API yanıtını işler ve durumu/menüyü günceller. """
        if response_data.get("basarili"):
            value = response_data.get("deger") # Türkçe anahtar
            print(f"API'den Gelen Durum: {setting_name} = {value}")
            if setting_name == "ProaktifMesajEtkin": self.current_proactive_state = bool(value); self._update_proactive_action_text();
            elif setting_name == "KomutCalistirmaEtkin": self.current_cmdexec_state = bool(value); self._update_cmdexec_action_text();
        else: 
            error_msg = response_data.get('hata', 'Bilinmeyen hata') # Türkçe anahtar
            print(f"API Hatası ({setting_name} durumu alınamadı): {error_msg}")

    # --- Eylem Handler'ları (Slotlar) ---

    def _run_in_thread(self, target_func, args=()):
        """ İşlemleri ayrı thread'de çalıştırır. """
        thread = threading.Thread(target=target_func, args=args); thread.daemon = True; thread.start();

    @Slot(QSystemTrayIcon.ActivationReason)
    def handle_icon_activation(self, reason):
        """ Tepsi ikonuna sol tıklandığında sohbeti gösterir. """
        if reason == QSystemTrayIcon.Trigger: self.handle_show_chat();

    @Slot()
    def handle_show_chat(self):
        """ Sohbet penceresini gösterir/odaklar. """
        if self.chat_window:
            if not self.chat_window.isVisible() or self.chat_window.isMinimized(): self.chat_window.showNormal();
            self.chat_window.activateWindow(); self.chat_window.raise_();
        else: self.message("Hata", "Sohbet penceresi başlatılamadı.", QSystemTrayIcon.Warning);

    @Slot()
    @Slot()
    def handle_add_data(self):
        """ Veri Ekle menüsü - Dosya seçtirir ve içeriği API'ye gönderir. """
        file_path, _ = QFileDialog.getOpenFileName(None, "Eklenecek Metin Dosyası (.txt)", "", "Metin Dosyaları (*.txt)")
        if file_path:
        try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                self._run_in_thread(self._send_data_file_to_api, args=(file_path,))
            except Exception as e:
                self.message("Hata", f"Dosya okuma hatası:\n{e}", QSystemTrayIcon.Critical)
            if os.path.getsize(file_path) > max_size:
                self.message("Hata", f"Dosya boyutu çok büyük (Max: {max_size//(1024*1024)} MB).", QSystemTrayIcon.Warning)
                return
                
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                
            endpoint = "/veri_gonder"
            data_to_send = {
                "textContent": content,
                "originalFilename": os.path.basename(file_path),
                "userId": "tray_user"
            }
            
            api_thread = ApiClientThread(endpoint, data_to_send, method='post', api_base_url=self.api_url)
            api_thread.response_received.connect(lambda r: self.message("Veri Ekle", r.get("mesaj", "İstek alındı.")))
            api_thread.error_occurred.connect(self._handle_api_error)
            api_thread.start()
            
        except Exception as e:
            print(f"Hata (Veri Ekle): {e}")
            self.message("Hata", f"Dosya işlenirken hata:\n{e}", QSystemTrayIcon.Critical)
                "userId": "tray_user"
            }
            
            api_thread = ApiClientThread(endpoint, data_to_send, method='post', api_base_url=self.api_url)
            api_thread.response_received.connect(lambda r: self.message("Veri Ekle", r.get("mesaj", "İstek alındı.")))
            api_thread.error_occurred.connect(self._handle_api_error)
            api_thread.start()
            
        except Exception as e:
            print(f"Hata (Veri Ekle): {e}")
            self.message("Hata", f"Dosya işlenirken hata:\n{e}", QSystemTrayIcon.Critical)
                "userId": "tray_user"
            }
            
            api_thread = ApiClientThread(endpoint, data_to_send, method='post', api_base_url=self.api_url)
            api_thread.response_received.connect(lambda r: self.message("Veri Ekle", r.get("mesaj", "İstek alındı.")))
            api_thread.error_occurred.connect(self._handle_api_error)
            api_thread.start()
            
        except Exception as e:
            print(f"Hata (Veri Ekle): {e}")
            self.message("Hata", f"Dosya işlenirken hata:\n{e}", QSystemTrayIcon.Critical)

    @Slot()
    def handle_show_settings(self):
        """ Ayarlar penceresini açar. """
        print("Menü: Ayarlar seçildi.")
        # TODO: Ayarlar penceresinin içeriğini API'den gelen verilerle doldur
        settings_dialog = SettingsDialog(None, api_url=self.api_url) # Parent None olabilir
        settings_dialog.exec() # Modsal olarak açalım
        # TODO: Eğer kullanıcı Kaydet'e bastıysa, değişiklikleri API'ye gönder (/ayarlari_guncelle ?)

    @Slot()
    def handle_toggle_proactive(self):
        """ Proaktif mesaj özelliğini aç/kapa. """
        new_state = not self.current_proactive_state
        self._run_in_thread(self._send_toggle_to_api, args=("ProaktifMesajEtkin", new_state))

    @Slot()
    def handle_toggle_command_exec(self):
        """ Komut çalıştırma özelliğini aç/kapa. """
        new_state = not self.current_cmdexec_state
        self._run_in_thread(self._send_toggle_to_api, args=("KomutCalistirmaEtkin", new_state))

    def _send_toggle_to_api(self, setting_name, new_value):
        """ /ayar_degistir API endpoint'ine istek gönderir. """
        try:
            endpoint = "/ayar_degistir"; # Türkçe endpoint
            # Pydantic modeline uygun (alias ile)
            data_to_send = {"parameterName": setting_name, "deger": new_value}; 
            api_thread = ApiClientThread(endpoint, data_to_send, method='post', api_base_url=self.api_url)
            api_thread.response_received.connect(lambda response, name=setting_name, req_val=new_value: self._handle_toggle_response(name, req_val, response))
            api_thread.error_occurred.connect(self._handle_api_error) 
            api_thread.start()
        except Exception as e: print(f"Hata (Toggle Thread): {e}"); self.message("Hata", "Ayar değiştirme başlatılamadı.")

    @Slot(str, bool, dict)
    def _handle_toggle_response(self, setting_name, requested_value, response_data):
        """ /ayar_degistir API yanıtını işler. """
        if response_data.get("basarili"):
            print(f"API Yanıtı: {setting_name} -> {requested_value} ayarlandı.")
            if setting_name == "ProaktifMesajEtkin": self.current_proactive_state = requested_value; self._update_proactive_action_text();
            elif setting_name == "KomutCalistirmaEtkin": self.current_cmdexec_state = requested_value; self._update_cmdexec_action_text();
            # self.message("Ayar Değiştirildi", f"{setting_name}: {'Açık' if requested_value else 'Kapalı'}.") # İsteğe bağlı bildirim
        else: 
            error_msg = response_data.get('hata', 'Bilinmeyen hata'); print(f"API Yanıtı: Başarısız - {error_msg}");
            self.message("Ayar Hatası", f"{setting_name} değiştirilemedi:\n{error_msg}", QSystemTrayIcon.Warning);
            # Hata durumunda mevcut durumu API'den tekrar çek
            QTimer.singleShot(500, lambda name=setting_name: self._run_in_thread(self._get_setting_from_api, args=(name,)))
            
    @Slot(str)
    def _handle_api_error(self, error_message):
        """ Genel API hatalarını tepsi mesajı olarak gösterir. """
        print(f"HATA [system_tray_app.py]: API Hatası: {error_message}")
        self.message("API Hatası", error_message, QSystemTrayIcon.Warning) 

    @Slot()
    def handle_stop_model(self):
        """ Modeli Durdur menüsü. """
        print("Menü: Durdur seçildi.")
        self.stop_action.setEnabled(False) # Tekrar basılmasın
        self.message("İstek Gönderildi", "Model durdurma isteği gönderiliyor...")
        self._run_in_thread(self._send_stop_request_to_api)

    def _send_stop_request_to_api(self):
        """ /durdurma_iste API'sine istek gönderir. """
        try:
            endpoint = "/durdurma_iste"; # Türkçe endpoint
            api_thread = ApiClientThread(endpoint, None, method='post', api_base_url=self.api_url)
            api_thread.response_received.connect(self._handle_stop_response)
            api_thread.error_occurred.connect(lambda err: (self.message("Durdurma Hatası", f"API isteği başarısız: {err}", QSystemTrayIcon.Warning), self.stop_action.setEnabled(True))) # Hata olursa butonu tekrar aç
            api_thread.start()
        except Exception as e: 
            print(f"Hata (Durdurma Thread): {e}"); 
            self.message("Hata", "Durdurma işlemi başlatılamadı.", QSystemTrayIcon.Critical)
            self.stop_action.setEnabled(True) # Hata olursa butonu tekrar aç

    @Slot(dict)
    def _handle_stop_response(self, response_data):
        """ /durdurma_iste API yanıtını işler. """
        if response_data.get("basarili"): 
            self.message("Model Durduruldu", "AIX servisleri kapatıldı/kapatılıyor.")
            self.model_running = False 
            self.stop_action.setEnabled(False)
            # Diğer eylemleri de pasif yap
            self.proactive_action.setEnabled(False)
            self.cmdexec_action.setEnabled(False)
            self.add_data_action.setEnabled(False)
            self.settings_action.setEnabled(False) # Ayarlar da kapanmalı mı?
        else: 
            self.message("Durdurma Hatası", f"Model durdurulamadı: {response_data.get('hata', '')}", QSystemTrayIcon.Warning)
            self.stop_action.setEnabled(True) # Başarısızsa butonu tekrar aç

    @Slot()
    def handle_exit(self):
        """ Çıkış menüsü. """
        print("Menü: Çıkış seçildi.")
        if self.model_running: 
             print("Model çalışıyor, önce durdurma isteği gönderiliyor...")
             self._run_in_thread(self._send_stop_request_to_api) 
             QTimer.singleShot(2500, self._quit_application) # 2.5 saniye bekle
        else:
            self._quit_application() 

    def _quit_application(self):
        """ Uygulamayı kapatır. """
        print("Uygulamadan çıkılıyor...")
        if self.chat_window: try: self.chat_window.close() 
            except Exception as chat_close_e: print(f"Chat kapatılırken hata: {chat_close_e}")
        self.tray_icon.hide() 
        self.app.quit() 

    def message(self, title, msg, icon=QSystemTrayIcon.Information, duration=3000):
        """ Tepsi mesajı gösterir."""
        # Ana thread'den çağrıldığından emin olmak için QTimer kullanılabilir ama şimdilik direkt
        # print(f"Tepsi Mesajı: [{title}] {msg}") # Konsola da yazdır
        self.tray_icon.showMessage(title, msg, icon, duration)


# Ana uygulama bloğu
if __name__ == '__main__':
    app = QApplication(sys.argv)
    app.setQuitOnLastWindowClosed(False) 

    api_url = load_api_url_from_config()
    if not api_url:
         QMessageBox.critical(None, "Yapılandırma Hatası", "config.ini okunamadı veya [Server] ayarları geçersiz.\nUygulama başlatılamıyor.")
         sys.exit(1)

    # ChatWindow'u oluştur ama gösterme
    chat_window_instance = ChatWindow() 
    
    # SystemTrayApp'i oluştur
    try:
        tray_app = SystemTrayApp(app, chat_window_instance)
    except Exception as e:
         QMessageBox.critical(None, "Başlatma Hatası", f"Sistem Tepsisi başlatılamadı:\n{e}")
         sys.exit(1)
         
    print("AIX GUI Uygulaması başlatıldı. Kontrol için sistem tepsisi ikonuna sağ tıklayın.")
    sys.exit(app.exec()) # Olay döngüsünü başlat
