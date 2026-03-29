import ftplib
import sys
import os

FTP_HOST = os.getenv('FTP_HOST', '178.32.171.58')
FTP_USER = os.getenv('FTP_USER', 'bypat.com.au_2pxecwmrk9o')
FTP_PASS = os.getenv('FTP_PASS')

if not FTP_PASS:
    print("Error: FTP_PASS environment variable not set.")
    sys.exit(1)

try:
    ftp = ftplib.FTP(FTP_HOST)
    ftp.login(FTP_USER, FTP_PASS)
    print("LOGIN SUCCESS")
    print("Current remote directory:", ftp.pwd())
    print("Directory listing:")
    print(ftp.nlst())
    ftp.quit()
except Exception as e:
    print("LOGIN FAILED:", e)
    sys.exit(1)
