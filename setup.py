# setup.py
# AIX projesinin ilk kurulumunu ve ortam hazırlığını yapar.
# Kurulum adımlarını s*.txt dosyalarından okuyarak çalıştırır.

import os
import sys
import time
import glob       # Dosya deseni eşleştirme için
import subprocess # pip çalıştırmak için (s2.txt içinde)
import traceback  # Hata ayıklama için

# --- Ayarlar ---
STEP_FILES_PATTERN = "s[0-9]*.txt"  # Çalıştırılacak adım dosyalarının deseni (s1.txt, s2.txt, s10.txt vb.)
WAIT_SECONDS_BETWEEN_STEPS = 1 # Adımlar arası bekleme süresi (saniye)

# --- Yardımcı Fonksiyonlar ---

def execute_step_from_file(filename):
    """ Verilen .txt dosyasındaki Python kodunu çalıştırır. """
    print(f"\n--- Çalıştırılıyor: {filename} ---")
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            script_content = f.read()
            
        # .txt içeriğindeki Python kodunu çalıştır
        # exec() fonksiyonu, dosya içeriğine güvenildiği varsayılarak kullanılır.
        # Bu kod, setup.py'nin çalıştığı global ve lokal isim alanında çalışır.
        exec(script_content, globals()) 
        
        print(f"--- Tamamlandı: {filename} ---")
        return True
        
    except FileNotFoundError:
        print(f"HATA: Adım dosyası bulunamadı: {filename}")
        return False
    except SystemExit as e:
        # Adım dosyası içindeki sys.exit() çağrısını yakala ve kurulumu durdur
        print(f"HATA: {filename} adımı '{e.code}' koduyla sonlandırıldı.")
        return False
    except Exception as e:
        print(f"HATA: {filename} çalıştırılırken hata oluştu:")
        traceback.print_exc() # Hatanın detayını yazdır
        return False

def get_sorted_step_files():
    """ s*.txt dosyalarını bulur ve numaralarına göre doğru sıralar (s1, s2, ..., s10). """
    files = glob.glob(STEP_FILES_PATTERN)
    try:
        # Dosya adından numarayı çıkarıp integer'a çevirerek sırala
        sorted_files = sorted(files, key=lambda x: int(os.path.splitext(os.path.basename(x))[0][1:]))
        return sorted_files
    except ValueError:
        print("HATA: s*.txt dosyaları beklenmedik bir formatta isimlendirilmiş. 's' harfinden sonra sadece sayı olmalı.")
        return None
    except Exception as e:
        print(f"HATA: Adım dosyaları sıralanırken hata: {e}")
        return None

# --- Ana Kurulum Mantığı ---

def main():
    """ Ana kurulum sürecini yönetir. """
    print("="*50)
    print(" AIX Kurulum Scripti Başlatılıyor...")
    print(f" Çalışma Dizini: {os.getcwd()}")
    print("="*50)

    step_files = get_sorted_step_files()

    if step_files is None: # Sıralama hatası
        sys.exit(1)
        
    if not step_files:
        print(f"HATA: Çalıştırılacak kurulum adımı dosyası ({STEP_FILES_PATTERN}) bulunamadı!")
        sys.exit(1)

    print(f"Bulunan Kurulum Adımları: {', '.join(step_files)}")

    total_steps = len(step_files) # Toplam adım sayısını dinamik alalım
    for i, step_file in enumerate(step_files, 1):
        print(f"\n[Adım {i}/{total_steps}]")
        success = execute_step_from_file(step_file)
        if not success:
            print(f"\n!!! Kurulum {i}. adımda ('{step_file}') başarısız oldu. Script durduruluyor. !!!")
            sys.exit(1) # Hata durumunda çık
        
        # Son adım değilse bekle
        if i < total_steps:
            print(f"{WAIT_SECONDS_BETWEEN_STEPS} saniye bekleniyor...")
            time.sleep(WAIT_SECONDS_BETWEEN_STEPS)

    # Kurulum Tamamlandı Mesajı
    print("\n"+"="*50)
    print(" AIX Kurulumu başarıyla tamamlandı!")
    print(" Sistemi başlatmak için Sistem Tepsisi uygulamasını (system_tray_app.py) çalıştırabilirsiniz.")
    print(" (Bu script sistemi otomatik olarak başlatmaz).")
    print("="*50)

# Script doğrudan çalıştırıldığında main fonksiyonunu çağır
if __name__ == "__main__":
    main()
