import ftplib
import time
import sys
import os

FTP_HOST = os.getenv('FTP_HOST', '178.32.171.58')
FTP_USER = os.getenv('FTP_USER', 'bypat.com.au_2pxecwmrk9o')
PWD = os.getenv('FTP_PASS')

if not PWD:
    print("Error: FTP_PASS environment variable not set.")
    sys.exit(1)

print("Conectando suavemente al servidor FTP...")
try:
    ftp = ftplib.FTP()
    # Conectar con un timeout alto
    ftp.connect(FTP_HOST, 21, timeout=60)
    print("Conexión establecida. Pausando 2 segundos por seguridad...")
    time.sleep(2)
    
    ftp.login(FTP_USER, PWD)
    print("Login aceptado. Pausando 2 segundos...")
    time.sleep(2)
    
    # Activar modo pasivo explicitamente (suele ser más amigable con firewalls)
    ftp.set_pasv(True)
    
    ftp.cwd('roster.bypat.com.au/public')
    print("Directorio encontrado. Transfiriendo index.html lentamente...")
    
    with open('public/index.html', 'rb') as f:
        # Subir el archivo
        ftp.storbinary('STOR index.html', f, blocksize=8192)
        
    print("¡Archivo subido exitosamente!")
    time.sleep(1)
    ftp.quit()
    print("Conexión cerrada.")
except Exception as e:
    print(f"Error de conexión o transferencia: {e}")
    sys.exit(1)
