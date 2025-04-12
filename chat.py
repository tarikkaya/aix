# chat.py
# AIX için PySide6 tabanlı sohbet arayüzü

import sys
import os
import json
import threading
import configparser
import traceback
import math
from typing import List, Dict, Any, Optional
from datetime import datetime

# Gerekli PySide6 modülleri
from PySide6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QTextEdit, QPushButton, QSizePolicy, QMessageBox, QDialog,
    QListWidget, QDockWidget, QInputDialog, QLabel, QDialogButtonBox,
    QListWidgetItem, QMenu, QLineEdit, QScrollArea, QFrame, QSpacerItem
)
from PySide6.QtCore import Qt, Slot, QThread, Signal, QTimer, QEvent, QSize, QCoreApplication, QPoint, QUrl
from PySide6.QtGui import QIcon, QPixmap, QColor, QKeyEvent, QTextCursor, QPalette, QAction, QDesktopServices

# API istemcisi için requests
try:
    import requests
except ImportError:
    print("HATA: 'requests' kütüphanesi bulunamadı. Lütfen kurun: pip install requests")
    sys.exit(1)

# Syntax Highlighting için Pygments (opsiyonel)
try:
    from pygments import highlight
    from pygments.lexers import get_lexer_by_name, guess_lexer
    from pygments.formatters import HtmlFormatter
    PYGMENTS_STYLE = 'monokai'  # Koyu tema için uygun stil
    PYGMENTS_AVAILABLE = True
    formatter = HtmlFormatter(style=PYGMENTS_STYLE, cssclass="highlight", noclasses=False)
    PYGMENTS_CSS = formatter.get_style_defs('.highlight')
except ImportError:
    PYGMENTS_AVAILABLE = False
    PYGMENTS_CSS = ""

# --- Ayarlar ---
basedir = os.path.dirname(__file__)
DEFAULT_CONFIG_PATH = os.path.join(basedir, '..', 'config', 'config.ini')
TRAY_ICON_FILE = os.path.join(basedir, "aix_icon.png")

# --- Yapılandırmayı Oku ---
def load_api_url_from_config(config_path=DEFAULT_CONFIG_PATH) -> Optional[str]:
    """Config dosyasından API URL'sini okur. Hata durumunda None döner."""
    config = configparser.ConfigParser()
    config.optionxform = str
    if not os.path.exists(config_path):
        print(f"HATA: Config dosyası bulunamadı: {config_path}.")
        return None
    try:
        config.read(config_path, encoding='utf-8')
        port = config.getint('Server', 'port')
        host = config.get('Server', 'host', fallback='127.0.0.1')
        api_url = f"http://{host}:{port}"
        return api_url
    except Exception as e:
        print(f"HATA: Config dosyasından API URL okunurken hata: {e}")
        return None

# --- API İstemcisi (Thread içinde çalışacak) ---
class ApiClientThread(QThread):
    """API isteklerini arka planda gönderen thread sınıfı."""
    response_received = Signal(dict)
    error_occurred = Signal(str)
    finished_signal = Signal()

    def __init__(self, endpoint, data=None, method='post', api_base_url=None):
        super().__init__()
        self.endpoint = endpoint
        self.data = data
        self.method = method.lower()
        self.api_base_url = api_base_url
        self.session = requests.Session()

    def run(self):
        """API isteğini gönderir ve sinyalleri yayar."""
        if not self.api_base_url:
            self.error_occurred.emit("API Adresi yapılandırılamadı.")
            self.finished_signal.emit()
            return
        try:
            url = f"{self.api_base_url}{self.endpoint}"
            headers = {'Content-Type': 'application/json'}
            timeout_seconds = 45 if self.endpoint == '/sohbet_girdisi' else 15
            response = None
            if self.method == 'post':
                response = self.session.post(url, json=self.data, headers=headers, timeout=timeout_seconds)
            elif self.method == 'get':
                response = self.session.get(url, params=self.data, timeout=timeout_seconds)
            else:
                raise NotImplementedError(f"Desteklenmeyen metod: {self.method}")
            response.raise_for_status()
            response_json = response.json()
            self.response_received.emit(response_json)
        except requests.exceptions.Timeout:
            self.error_occurred.emit(f"API zaman aşımı ({timeout_seconds}sn).")
        except requests.exceptions.ConnectionError:
            self.error_occurred.emit(f"Servise bağlanılamadı ({self.api_base_url}).")
        except requests.exceptions.RequestException as e:
            error_detail = str(e)
            if e.response is not None:
                try:
                    err_json = e.response.json()
                    error_detail = err_json.get('detail', str(e))
                except json.JSONDecodeError:
                    error_detail = f"{e.response.status_code} {e.response.reason}"
            self.error_occurred.emit(f"API iletişim hatası: {error_detail}")
        except json.JSONDecodeError:
            self.error_occurred.emit("API'den geçersiz JSON.")
        except Exception as e:
            self.error_occurred.emit(f"API istemcisinde hata: {type(e).__name__} - {e}")
        finally:
            self.session.close()
            self.finished_signal.emit()

# --- Detaylı Geri Bildirim Diyalogu ---
class FeedbackDialog(QDialog):
    """İyi/Kötü geri bildirim için detayları alan diyalog penceresi."""
    def __init__(self, parent=None, is_positive: bool = False, message_id: str = ""):
        super().__init__(parent)
        self.is_positive = is_positive
        self.message_id = message_id

        self.setWindowTitle(f"Geri Bildirim: {'Olumlu' if is_positive else 'Olumsuz'}")
        self.setMinimumWidth(400)
        self.setStyleSheet("background-color: #303134; color: #e8eaed;")  # Koyu tema

        layout = QVBoxLayout(self)

        # Açıklama Alanı (Zorunlu)
        layout.addWidget(QLabel(f"Yanıtı neden {'beğendiniz' if is_positive else 'beğenmediniz'}? (Açıklama Zorunlu)"))
        self.explanation_edit = QTextEdit()
        self.explanation_edit.setPlaceholderText("Lütfen açıklamanızı buraya yazın...")
        self.explanation_edit.setMinimumHeight(80)
        self.explanation_edit.setStyleSheet("background-color: #3c4043; border: 1px solid #5f6368;")
        layout.addWidget(self.explanation_edit)

        # Öneri Alanı (Sadece Olumsuzda)
        self.suggestion_edit = None
        if not is_positive:
            layout.addWidget(QLabel("Önerilen doğru yanıt / Daha iyi ifade (İsteğe bağlı):"))
            self.suggestion_edit = QTextEdit()
            self.suggestion_edit.setPlaceholderText("Daha iyi bir yanıt önerin...")
            self.suggestion_edit.setMinimumHeight(60)
            self.suggestion_edit.setStyleSheet("background-color: #3c4043; border: 1px solid #5f6368;")
            layout.addWidget(self.suggestion_edit)

        # Butonlar
        self.button_box = QDialogButtonBox(QDialogButtonBox.Ok | QDialogButtonBox.Cancel)
        self.button_box.button(QDialogButtonBox.Ok).setText("Gönder")
        self.button_box.button(QDialogButtonBox.Cancel).setText("İptal")
        self.button_box.button(QDialogButtonBox.Ok).clicked.connect(self.check_and_accept)
        self.button_box.rejected.connect(self.reject)
        layout.addWidget(self.button_box)

    def check_and_accept(self):
        """Açıklamanın zorunlu olup olmadığını kontrol eder ve kabul eder/uyarır."""
        if not self.explanation_edit.toPlainText().strip():
            QMessageBox.warning(self, "Eksik Bilgi", "Lütfen geri bildiriminiz için bir açıklama yazın.")
        else:
            self.accept()

    def getFeedbackData(self) -> Optional[Dict]:
        """Kullanıcı girdisini alır ve API'ye gönderilecek dict oluşturur."""
        explanation = self.explanation_edit.toPlainText().strip()
        if not explanation:
            return None

        feedback = {
            "diyalog_noron_kimligi": self.message_id,
            "puan": "iyi" if self.is_positive else "kotu",
            "aciklama": explanation,
            "onerilen_metin": None
        }
        if self.suggestion_edit:
            suggestion = self.suggestion_edit.toPlainText().strip()
            if suggestion:
                feedback["onerilen_metin"] = suggestion
        return feedback

# --- Mesaj Widget ---
class MessageWidget(QWidget):
    """Tek bir sohbet mesajını (gönderen, metin, feedback butonları) gösteren widget."""
    feedback_requested = Signal(bool, str)  # is_positive, message_id

    def __init__(self, sender: str, message_html: str, message_id: Optional[str] = None, is_ai: bool = False, parent=None):
        super().__init__(parent)
        self.message_id = message_id
        self.is_ai = is_ai

        self.layout = QVBoxLayout(self)
        self.layout.setContentsMargins(5, 5, 5, 5)
        self.layout.setSpacing(3)

        # Mesaj İçeriği (HTML destekli QLabel)
        self.message_label = QLabel(message_html)
        self.message_label.setWordWrap(True)
        self.message_label.setTextInteractionFlags(Qt.TextSelectableByMouse | Qt.LinksAccessibleByMouse)
        self.message_label.setOpenExternalLinks(True)
        self.layout.addWidget(self.message_label)

        # Geri Bildirim Butonları (Sadece AI mesajları için)
        if self.is_ai and self.message_id:
            self.feedback_layout = QHBoxLayout()
            self.feedback_layout.addSpacerItem(QSpacerItem(40, 20, QSizePolicy.Expanding, QSizePolicy.Minimum))

            self.good_button = QPushButton("👍")
            self.good_button.setToolTip("İyi Yanıt")
            self.good_button.setCursor(Qt.PointingHandCursor)
            self.good_button.setStyleSheet("background-color: transparent; border: none; font-size: 12pt;")
            self.good_button.clicked.connect(lambda: self.feedback_requested.emit(True, self.message_id))
            self.feedback_layout.addWidget(self.good_button)

            self.bad_button = QPushButton("👎")
            self.bad_button.setToolTip("Kötü Yanıt")
            self.bad_button.setCursor(Qt.PointingHandCursor)
            self.bad_button.setStyleSheet("background-color: transparent; border: none; font-size: 12pt;")
            self.bad_button.clicked.connect(lambda: self.feedback_requested.emit(False, self.message_id))
            self.feedback_layout.addWidget(self.bad_button)

            self.layout.addLayout(self.feedback_layout)

# --- Ana Sohbet Penceresi ---
class ChatWindow(QMainWindow):
    """Ana sohbet arayüzünü oluşturan ve yöneten sınıf."""
    new_message_signal = Signal(str, str, bool, str)  # sender, message, is_html, message_id
    enable_input_signal = Signal(bool)
    clear_history_signal = Signal()
    populate_sidebar_signal = Signal(list)  # Oturum listesi için

    def __init__(self):
        super().__init__()
        self.setWindowTitle("AIX Sohbet Arayüzü")
        self.setGeometry(150, 150, 850, 800)  # Kenar çubuğu için daha geniş

        icon_path = TRAY_ICON_FILE
        if os.path.exists(icon_path):
            self.setWindowIcon(QIcon(icon_path))
        else:
            pixmap = QPixmap(32, 32)
            pixmap.fill(QColor("#202124"))
            self.setWindowIcon(QIcon(pixmap))

        self.api_thread: Optional[ApiClientThread] = None
        self.current_session_id: Optional[str] = None
        self.api_url = load_api_url_from_config()
        self.active_message_widgets: Dict[str, QWidget] = {}  # Mesaj ID'si -> Widget referansı

        self._setup_styles()
        self._setup_ui()
        self._connect_signals()

        if self.api_url:
            QTimer.singleShot(200, self.request_initial_greeting)
        else:
            self.new_message_signal.emit("Sistem", "<font color='red'>HATA: Yapılandırma okunamadı.</font>", True, "")
            self.enable_input_signal.emit(False)

    def _setup_styles(self):
        """Pencere ve bileşenler için stil sayfasını ayarlar."""
        self.setStyleSheet(f"""
            QMainWindow {{ background-color: #202124; }}
            QWidget {{ color: #e8eaed; font-family: "Segoe UI", Arial, sans-serif; font-size: 10pt; }}
            QDockWidget {{ background-color: #282a2d; color: #bdc1c6; titlebar-close-icon: none; titlebar-normal-icon: none; }}
            QDockWidget::title {{ text-align: left; background: #303134; padding: 5px; font-weight: bold; }}
            QListWidget {{ background-color: #282a2d; border: none; padding: 5px; }}
            QListWidget::item {{ padding: 8px 5px; border-bottom: 1px solid #3c4043; }}
            QListWidget::item:selected {{ background-color: #3c4043; color: #e8eaed; }}
            QListWidget::item:hover {{ background-color: #35363a; }}
            QTextEdit#InputArea {{ background-color: #303134; color: #e8eaed; border: 1px solid #5f6368; border-radius: 18px; padding: 8px 12px; min-height: 22px; max-height: 150px; font-size: 10pt; }}
            QTextEdit#InputArea:disabled {{ background-color: #282a2d; }}
            QPushButton#SendButton {{ background-color: #8ab4f8; color: #202124; font-weight: bold; border-radius: 18px; padding: 8px 16px; border: none; min-height: 22px; }}
            QPushButton#SendButton:hover {{ background-color: #aecbfa; }}
            QPushButton#SendButton:disabled {{ background-color: #5f6368; color: #9aa0a6; }}
            QScrollBar:vertical {{ border: none; background: #303134; width: 10px; margin: 0; }}
            QScrollBar::handle:vertical {{ background: #5f6368; min-height: 20px; border-radius: 5px; }}
            QScrollBar::handle:vertical:hover {{ background: #9aa0a6; }}
            QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {{ height: 0px; }}
            QScrollBar::add-page:vertical, QScrollBar::sub-page:vertical {{ background: none; }}
            pre {{ background-color: #282a2d; padding: 10px; border: 1px solid #5f6368; border-radius: 5px; display: block; white-space: pre-wrap; word-wrap: break-word; font-family: "Consolas", "Monaco", monospace; font-size: 9.5pt; }}
            {PYGMENTS_CSS}
            QTextEdit {{ selection-background-color: #8ab4f8; selection-color: #202124; }}
            QPushButton.FeedbackButton {{ background-color: transparent; border: none; padding: 2px; }}
            QPushButton.FeedbackButton:hover {{ background-color: #3c4043; }}
            QLabel {{ color: #e8eaed; }}
        """)

    def _setup_ui(self):
        """Arayüz elemanlarını oluşturur ve yerleştirir (ScrollArea ile)."""
        central_widget = QWidget()
        self.main_layout = QVBoxLayout(central_widget)
        self.main_layout.setContentsMargins(0, 8, 8, 8)
        self.main_layout.setSpacing(8)

        # Konuşma Geçmişi Alanı (ScrollArea ve İçindeki Layout)
        self.scroll_area = QScrollArea()
        self.scroll_area.setWidgetResizable(True)
        self.scroll_area.setStyleSheet("QScrollArea { border: none; background-color: #202124; }")
        self.scroll_area.verticalScrollBar().setStyleSheet("""
            QScrollBar:vertical { border: none; background: #303134; width: 10px; margin: 0; }
            QScrollBar::handle:vertical { background: #5f6368; min-height: 20px; border-radius: 5px; }
            QScrollBar::handle:vertical:hover { background: #9aa0a6; }
            QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical { height: 0px; }
            QScrollBar::add-page:vertical, QScrollBar::sub-page:vertical { background: none; }
        """)

        self.history_widget = QWidget()
        self.history_layout = QVBoxLayout(self.history_widget)
        self.history_layout.setContentsMargins(8, 8, 8, 8)
        self.history_layout.setSpacing(10)
        self.history_layout.addStretch(1)

        self.scroll_area.setWidget(self.history_widget)
        self.main_layout.addWidget(self.scroll_area, 1)

        # Girdi Alanı ve Buton
        input_layout = QHBoxLayout()
        input_layout.setSpacing(5)
        self.input_area = QTextEdit()
        self.input_area.setObjectName("InputArea")
        self.input_area.setPlaceholderText("Mesajınızı yazın...")
        self.input_area.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Maximum)
        self.input_area.setFixedHeight(42)
        self.input_area.setVerticalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
        self.input_area.setHorizontalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
        self.input_area.installEventFilter(self)
        input_layout.addWidget(self.input_area)
        self.send_button = QPushButton("Gönder")
        self.send_button.setObjectName("SendButton")
        self.send_button.setSizePolicy(QSizePolicy.Fixed, QSizePolicy.Fixed)
        self.send_button.setFixedHeight(42)
        input_layout.addWidget(self.send_button)
        self.main_layout.addLayout(input_layout)
        self.setCentralWidget(central_widget)

        # Kenar Çubuğu (Dock Widget)
        self.history_dock = QDockWidget("Sohbet Geçmişi", self)
        self.history_dock.setObjectName("HistoryDock")
        self.history_dock.setAllowedAreas(Qt.LeftDockWidgetArea | Qt.RightDockWidgetArea)
        self.history_list_widget = QListWidget()
        self.history_list_widget.setContextMenuPolicy(Qt.CustomContextMenu)
        self.history_dock.setWidget(self.history_list_widget)
        self.addDockWidget(Qt.LeftDockWidgetArea, self.history_dock)

    def _connect_signals(self):
        """Sinyalleri slotlara bağlar."""
        self.send_button.clicked.connect(self.send_message)
        self.input_area.textChanged.connect(self._adjust_input_height)
        self.new_message_signal.connect(self._add_message_to_history_slot)
        self.enable_input_signal.connect(self.set_input_enabled)
        self.clear_history_signal.connect(self._clear_history)
        self.populate_sidebar_signal.connect(self._update_sidebar_list)
        self.history_list_widget.currentItemChanged.connect(self._on_session_selected)
        self.history_list_widget.customContextMenuRequested.connect(self._show_sidebar_context_menu)

    def eventFilter(self, watched, event):
        """Enter ve Shift+Enter tuşlarını yakalar."""
        if watched == self.input_area and event.type() == QEvent.KeyPress:
            keyEvent = QKeyEvent(event)
            if keyEvent.key() in (Qt.Key_Return, Qt.Key_Enter):
                if keyEvent.modifiers() & Qt.ShiftModifier:
                    return super().eventFilter(watched, event)
                else:
                    self.send_message()
                    return True
        return super().eventFilter(watched, event)

    @Slot()
    def _adjust_input_height(self):
        """Girdi alanının yüksekliğini içeriğe göre ayarlar."""
        document_height = self.input_area.document().size().height()
        extra_space = 18
        target_height = int(document_height + extra_space)
        max_h = 150
        min_h = 42
        new_height = max(min_h, min(target_height, max_h))
        if self.input_area.height() != new_height:
            self.input_area.setFixedHeight(new_height)

    @Slot(str, str, bool, str)
    def _add_message_to_history_slot(self, sender: str, message: str, is_html: bool = False, message_id: str = ""):
        """Konuşma geçmişine yeni bir MesajWidget ekler."""
        final_html_content = ""
        if is_html:
            final_html_content = message
        else:
            parts = message.split("```")
            formatted_parts = []
            is_code_block_content = False

            for i, part in enumerate(parts):
                if not part and i > 0 and i < len(parts) - 1:
                    is_code_block_content = not is_code_block_content
                    continue
                if i > 0:
                    is_code_block_content = not is_code_block_content

                if is_code_block_content:
                    lines = part.split('\n', 1)
                    language = lines[0].strip().lower() if lines and lines[0].strip() else "text"
                    code_content = lines[1] if len(lines) > 1 else ''
                    escaped_code = code_content.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
                    highlighted_code = escaped_code

                    if PYGMENTS_AVAILABLE:
                        try:
                            lexer = get_lexer_by_name(language, stripall=True) if language != "text" else guess_lexer(code_content, stripall=True)
                            local_formatter = HtmlFormatter(nobackground=True, style=PYGMENTS_STYLE, cssclass="highlight", wrapcode=True)
                            highlighted_code = highlight(code_content.strip(), lexer, local_formatter)
                            highlighted_code = highlighted_code.replace('<div class="highlight">', '').replace('</div>', '').strip()
                        except Exception as e:
                            print(f"Pygments hatası: {e}")
                    formatted_parts.append(f'<pre><code class="language-{language}">{highlighted_code}</code></pre>')
                else:
                    escaped_text = part.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
                    formatted_parts.append(escaped_text.replace(os.linesep, '<br/>'))

            sender_html = f"<b>{sender}:</b><br>"
            if formatted_parts:
                final_html_content = sender_html + "".join(filter(None, formatted_parts))
            else:
                final_html_content = sender_html + message.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')

        is_ai = (sender == "AIX")
        message_widget = MessageWidget(sender, final_html_content, message_id, is_ai)
        if is_ai and message_id:
            message_widget.feedback_requested.connect(self._show_feedback_dialog)

        self.history_layout.insertWidget(self.history_layout.count() - 1, message_widget)
        QTimer.singleShot(0, lambda: self.scroll_area.verticalScrollBar().setValue(self.scroll_area.verticalScrollBar().maximum()))

    @Slot()
    def _clear_history(self):
        """Konuşma geçmişini temizler."""
        for i in reversed(range(self.history_layout.count() - 1)):  # Stretch item hariç
            widget = self.history_layout.itemAt(i).widget()
            if widget:
                widget.deleteLater()
        self.history_layout.addStretch(1)

    @Slot()
    def send_message(self):
        """Kullanıcı girdisini alır ve API'ye gönderme işlemini başlatır."""
        user_input = self.input_area.toPlainText().strip()
        if not user_input or not self.api_url or (self.api_thread and self.api_thread.isRunning()):
            return

        self.new_message_signal.emit("Siz", user_input, False, "")
        self.input_area.clear()
        QTimer.singleShot(0, lambda: self._adjust_input_height())
        self.enable_input_signal.emit(False)
        self.new_message_signal.emit("AIX", "<i>yazıyor...</i>", True, "")
        QCoreApplication.processEvents()

        endpoint = "/sohbet_girdisi"
        data = {"kullanici_kimligi": "local_user", "oturum_kimligi": self.current_session_id, "mesaj": user_input}
        self._start_api_thread(endpoint, data, 'post', self._handle_api_response, self._handle_api_error)

    @Slot()
    def request_initial_greeting(self):
        """Başlangıç selamlamasını API'den ister."""
        if not self.api_url:
            return
        self.enable_input_signal.emit(False)
        self.new_message_signal.emit("AIX", "<i>bağlanıyor...</i>", True, "")
        QCoreApplication.processEvents()
        endpoint = "/sohbet_girdisi"
        data = {"kullanici_kimligi": "local_user", "oturum_kimligi": None, "mesaj": "__INITIAL_GREETING__"}
        self._start_api_thread(endpoint, data, 'post', self._handle_api_response, self._handle_api_error)

    def _start_api_thread(self, endpoint, data, method, response_slot, error_slot):
        """API thread'ini belirli slotlarla başlatır."""
        if not self.api_url:
            error_slot("API Adresi yapılandırılamadı.")
            self.enable_input_signal.emit(True)
            return
        if self.api_thread and self.api_thread.isRunning():
            print("UYARI: Önceki API isteği hala devam ediyor.")
            return
        self.api_thread = ApiClientThread(endpoint, data, method=method, api_base_url=self.api_url)
        self.api_thread.response_received.connect(response_slot)
        self.api_thread.error_occurred.connect(error_slot)
        self.api_thread.finished_signal.connect(self._on_api_thread_finished)
        self.api_thread.start()

    @Slot(dict)
    def _handle_api_response(self, response_data):
        """ /sohbet_girdisi API yanıtını işler."""
        self._remove_last_status_message()
        if response_data.get("basarili"):
            ai_response = response_data.get("yanit", "...")
            new_session_id = response_data.get("oturum_kimligi")
            message_id = response_data.get("yanit_noron_kimligi")

            if new_session_id and self.current_session_id != new_session_id:
                self.current_session_id = new_session_id
                print(f"DEBUG: Oturum ID ayarlandı/güncellendi: {self.current_session_id}")
                self._populate_history_sidebar()

            self.new_message_signal.emit("AIX", ai_response, False, message_id)
        else:
            error_message = response_data.get('hata', 'Bilinmeyen API hatası')
            self.new_message_signal.emit("AIX", f"<i>Hata: {error_message}</i>", True, "")
            QMessageBox.warning(self, "API Hatası", f"AIX servisinden hata döndü:\n{error_message}")

    @Slot(str)
    def _handle_api_error(self, error_message):
        """API iletişim hatasını işler."""
        self._remove_last_status_message()
        self.new_message_signal.emit("AIX", f"<i>İletişim Hatası: {error_message}</i>", True, "")
        QMessageBox.critical(self, "İletişim Hatası", error_message)
        self.enable_input_signal.emit(True)

    @Slot()
    def _on_api_thread_finished(self):
        """API thread'i bitince çalışır (inputu aktif eder)."""
        self.enable_input_signal.emit(True)

    def _remove_last_status_message(self):
        """Son eklenen status mesajını siler."""
        if self.history_layout.count() > 1:  # Stretch item hariç
            last_item = self.history_layout.itemAt(self.history_layout.count() - 2)
            if last_item and last_item.widget():
                last_widget = last_item.widget()
                if isinstance(last_widget, MessageWidget) and ("yazıyor..." in last_widget.message_label.text() or "bağlanıyor..." in last_widget.message_label.text()):
                    last_widget.deleteLater()

    @Slot(bool)
    def set_input_enabled(self, enabled: bool):
        """Girdi alanı ve gönder butonunu aktif/pasif yapar."""
        self.input_area.setEnabled(enabled)
        self.send_button.setEnabled(enabled)
        if enabled:
            self.input_area.setFocus()

    def open_with_context(self, context_message: str):
        """Bildirimden çağrıldığında pencereyi açar ve mesajı ekler."""
        self.showNormal()
        self.activateWindow()
        self.raise_()
        self.new_message_signal.emit("AIX", context_message, False, "")

    # --- Kenar Çubuğu Metotları ---
    @Slot()
    def _populate_history_sidebar(self):
        """Kenar çubuğunu API'den gelen son oturumlarla doldurur."""
        print("DEBUG: Kenar çubuğu yenileniyor...")
        if not self.api_url:
            return
        endpoint = "/oturum_listesini_getir"
        limit = 10
        data = {"limit": limit}
        self._start_api_thread(endpoint, data, 'get', self._handle_sidebar_response, self._handle_api_error)

    @Slot(list)
    def _update_sidebar_list(self, sessions: List[Dict]):
        """API'den gelen oturum listesiyle kenar çubuğunu günceller."""
        self.history_list_widget.clear()
        if not sessions:
            return
        for session in sessions:
            title = session.get("baslik", "Başlıksız")
            session_id = session.get("_id")
            if session_id:
                item = QListWidgetItem(title)
                item.setData(Qt.UserRole, session_id)
                self.history_list_widget.addItem(item)
                if session_id == self.current_session_id:
                    item.setSelected(True)

    @Slot(dict)
    def _handle_sidebar_response(self, response_data):
        """ /oturum_listesini_getir API yanıtını işler."""
        if response_data.get("basarili"):
            sessions = response_data.get("oturumlar", [])
            self.populate_sidebar_signal.emit(sessions)
        else:
            self._handle_api_error(f"Oturum listesi alınamadı: {response_data.get('hata')}")

    @Slot(QListWidgetItem, QListWidgetItem)
    def _on_session_selected(self, current_item: QListWidgetItem, previous_item: QListWidgetItem):
        """Kenar çubuğundan bir oturum seçildiğinde geçmişi yükler."""
        if not current_item or (self.api_thread and self.api_thread.isRunning()):
            return
        session_id = current_item.data(Qt.UserRole)
        if not session_id or session_id == self.current_session_id:
            return

        self.current_session_id = session_id
        self._clear_history()
        self.new_message_signal.emit("Sistem", f"<i>'{current_item.text()}' oturumu yükleniyor...</i>", True, "")
        self.enable_input_signal.emit(False)

        endpoint = "/oturum_gecmisini_getir"
        limit = 20
        data = {"oturum_kimligi": session_id, "limit": limit}
        self._start_api_thread(endpoint, data, 'get', self._handle_load_history_response, self._handle_api_error)

    @Slot(dict)
    def _handle_load_history_response(self, response_data):
        """ /oturum_gecmisini_getir API yanıtını işler."""
        self._remove_last_status_message()
        if response_data.get("basarili"):
            history_messages = response_data.get("gecmis", [])
            self._clear_history()
            for msg in history_messages:
                sender = "AIX" if msg.get("konusan_varlik") == "benlik" else "Siz"
                message_id = msg.get("_id")
                text = msg.get("icerik", {}).get("metin", "")
                formatted_html = f"<b>{sender}:</b><br>{text.replace(os.linesep, '<br/>')}"
                is_ai = (sender == "AIX")
                message_widget = MessageWidget(sender, formatted_html, message_id, is_ai)
                if is_ai and message_id:
                    message_widget.feedback_requested.connect(self._show_feedback_dialog)
                self.history_layout.insertWidget(self.history_layout.count() - 1, message_widget)
            QTimer.singleShot(0, lambda: self.scroll_area.verticalScrollBar().setValue(self.scroll_area.verticalScrollBar().maximum()))
        else:
            self._handle_api_error(f"Oturum geçmişi yüklenemedi: {response_data.get('hata')}")
        self.enable_input_signal.emit(True)

    @Slot(QPoint)
    def _show_sidebar_context_menu(self, position):
        """Kenar çubuğu öğesi üzerinde sağ tık menüsünü gösterir."""
        item = self.history_list_widget.itemAt(position)
        if not item:
            return

        menu = QMenu()
        rename_action = menu.addAction("Yeniden Adlandır")
        delete_action = menu.addAction("Sil")

        action = menu.exec(self.history_list_widget.mapToGlobal(position))

        if action == rename_action:
            self._rename_session(item)
        elif action == delete_action:
            self._delete_session(item)

    def _rename_session(self, item: QListWidgetItem):
        """Seçili oturumu yeniden adlandırır (API çağrısı yapar)."""
        session_id = item.data(Qt.UserRole)
        current_title = item.text()
        new_title, ok = QInputDialog.getText(self, "Oturumu Yeniden Adlandır", "Yeni Başlık:", QLineEdit.Normal, current_title)
        if ok and new_title and new_title.strip() != current_title:
            endpoint = "/oturum_basligini_guncelle"
            data = {"oturum_kimligi": session_id, "yeni_baslik": new_title.strip()}
            self._start_api_thread(endpoint, data, 'post', lambda r: self._handle_rename_delete_response(r, item, new_title), self._handle_api_error)

    def _delete_session(self, item: QListWidgetItem):
        """Seçili oturumu siler (API çağrısı yapar)."""
        session_id = item.data(Qt.UserRole)
        title = item.text()
        reply = QMessageBox.question(self, "Oturumu Sil", f"'{title}' başlıklı oturumu silmek istediğinizden emin misiniz?", QMessageBox.Yes | QMessageBox.No, QMessageBox.No)
        if reply == QMessageBox.Yes:
            endpoint = "/oturum_sil"
            data = {"oturum_kimligi": session_id}
            self._start_api_thread(endpoint, data, 'post', lambda r: self._handle_rename_delete_response(r, item, None), self._handle_api_error)

    @Slot(dict, QListWidgetItem, Optional[str])
    def _handle_rename_delete_response(self, response_data, item, new_title):
        """Yeniden adlandırma veya silme API yanıtını işler."""
        if response_data.get("basarili"):
            if new_title is not None:
                item.setText(new_title)
            else:
                row = self.history_list_widget.row(item)
                self.history_list_widget.takeItem(row)
                if item.data(Qt.UserRole) == self.current_session_id:
                    self.current_session_id = None
                    self._clear_history()
        else:
            action_text = "yeniden adlandırılamadı" if new_title is not None else "silinemedi"
            self._handle_api_error(f"Oturum {action_text}: {response_data.get('hata')}")

    # --- Geri Bildirim Metotları ---
    @Slot(bool, str)
    def _show_feedback_dialog(self, rating_is_positive: bool, message_id: str):
        """Detaylı geri bildirim diyalogunu gösterir ve sonucu işler."""
        if not message_id:
            return
        dialog = FeedbackDialog(self, rating_is_positive, message_id)
        if dialog.exec() == QDialog.Accepted:
            feedback_data = dialog.getFeedbackData()
            if feedback_data:
                self._handle_feedback_submission(feedback_data)

    def _handle_feedback_submission(self, feedback_data: dict):
        """Geri bildirimi API'ye gönderir."""
        print(f"DEBUG: Geri bildirim gönderiliyor: {feedback_data}")
        endpoint = "/geribildirim_gonder"
        api_data = {
            "dialogueNeuronId": feedback_data["diyalog_noron_kimligi"],
            "puan": feedback_data["puan"],
            "aciklama": feedback_data["aciklama"],
            "suggestedText": feedback_data.get("onerilen_metin")
        }
        self._start_api_thread(endpoint, api_data, 'post',
                               lambda r: self.message("Geri Bildirim", r.get("mesaj", "Gönderildi.")),
                               self._handle_api_error)

    def message(self, title, text, duration=2000):
        """Basit QMessageBox gösterir."""
        QMessageBox.information(self, title, text)

if __name__ == "__main__":
    app = QApplication(sys.argv)
    window = ChatWindow()
    window.show()
    sys.exit(app.exec())