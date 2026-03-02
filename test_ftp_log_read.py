import ftplib
import os
from dotenv import load_dotenv

load_dotenv('.env.production')

ftp = ftplib.FTP(os.getenv('FTP_HOST'))
ftp.login(os.getenv('FTP_USER'), os.getenv('FTP_PASS'))

ftp.cwd('/roster.bypat.com.au')

with open('remote_backend.log', 'wb') as fp:
    ftp.retrbinary('RETR backend/backend.log', fp.write)

ftp.quit()
print("Log downloaded to remote_backend.log")
