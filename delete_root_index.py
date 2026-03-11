import ftplib
FTP_HOST = '178.32.171.58'
FTP_USER = 'bypat.com.au_2pxecwmrk9o'
PASSWORDS = ['q4of7G6~hffFTwb!']

ftp = ftplib.FTP(FTP_HOST)
ftp.login(FTP_USER, PASSWORDS[0])
ftp.cwd('roster.bypat.com.au')

try:
    ftp.delete('index.html')
    print("Successfully deleted index.html from root")
except Exception as e:
    print("Could not delete index.html:", e)

ftp.quit()
