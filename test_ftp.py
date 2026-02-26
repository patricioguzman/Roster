import ftplib
import sys

try:
    ftp = ftplib.FTP('178.32.171.58')
    ftp.login('bypat.com.au_2pxecwmrk9o', 'epnH!?6K6bpoyL6v')
    print("LOGIN SUCCESS")
    print(ftp.nlst())
    ftp.quit()
except Exception as e:
    print("LOGIN FAILED:", e)
    sys.exit(1)
