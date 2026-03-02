import ftplib
import sys
import os

FTP_HOST = '178.32.171.58'
FTP_USER = 'bypat.com.au_2pxecwmrk9o'
PWD = 'q4of7G6~hffFTwb!'

try:
    ftp = ftplib.FTP(FTP_HOST, timeout=30)
    ftp.login(FTP_USER, PWD)
    ftp.cwd('roster.bypat.com.au/public')
    with open('public/index.html', 'rb') as f:
        ftp.storbinary('STOR index.html', f)
    print("Fast upload of index.html complete!")
    ftp.quit()
except Exception as e:
    print("Upload failed:", e)
    sys.exit(1)
