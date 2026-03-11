import ftplib
FTP_HOST = '178.32.171.58'
FTP_USER = 'bypat.com.au_2pxecwmrk9o'
PASSWORDS = ['q4of7G6~hffFTwb!']

ftp = ftplib.FTP(FTP_HOST)
ftp.login(FTP_USER, PASSWORDS[0])
ftp.cwd('roster.bypat.com.au')

print("Contents of roster.bypat.com.au:")
ftp.retrlines('LIST')

print("\nContents of roster.bypat.com.au/public:")
try:
    ftp.retrlines('LIST public')
except Exception as e:
    print(e)

ftp.quit()
