import ftplib
import sys

try:
    ftp = ftplib.FTP('178.32.171.58')
    ftp.login('bypat.com.au_2pxecwmrk9o', 'q4of7G6~hffFTwb!')
    print("LOGIN SUCCESS")
    print("Current remote directory:", ftp.pwd())
    print("Directory listing:")
    print(ftp.nlst())
    ftp.quit()
except Exception as e:
    print("LOGIN FAILED:", e)
    sys.exit(1)
