import ftplib
import os
import sys

FTP_HOST = '178.32.171.58'
FTP_USER = 'bypat.com.au_2pxecwmrk9o'
# Using the correct password
PASSWORDS = ['q4of7G6~hffFTwb!']

ftp = None
for pwd in PASSWORDS:
    try:
        ftp = ftplib.FTP(FTP_HOST)
        ftp.login(FTP_USER, pwd)
        print(f"LOGIN SUCCESS")
        break
    except ftplib.error_perm:
        print(f"Failed to login")
        ftp = None
    except Exception as e:
        print(f"Error: {e}")
        ftp = None

if not ftp:
    print("ALL LOGINS FAILED")
    sys.exit(1)

print("Navigating to subdomain directory /roster.bypat.com.au ...")
try:
    ftp.cwd('roster.bypat.com.au')
except Exception as e:
    print("Could not change directory:", e)
    sys.exit(1)

def upload_file(local_path, remote_path):
    with open(local_path, 'rb') as f:
        ftp.storbinary(f'STOR {remote_path}', f)
    print(f"Uploaded {local_path} to {remote_path}")

def upload_dir(local_dir, remote_dir):
    try:
        if remote_dir != '':
             ftp.mkd(remote_dir)
    except ftplib.error_perm:
        pass # Directory expected to exist
    for item in os.listdir(local_dir):
        if item in ['.DS_Store']: continue
        local_path = os.path.join(local_dir, item)
        # If remote_dir is empty string, we want item bare, else dir/item
        remote_path = f"{remote_dir}/{item}" if remote_dir else item
        if os.path.isfile(local_path):
            upload_file(local_path, remote_path)
        elif os.path.isdir(local_path):
            upload_dir(local_path, remote_path)

print("Starting deployment via FTP...")
# 1. Upload app.js to the root of the app
upload_file('app.js', 'app.js')

# 2. Upload backend explicitly to backend/
upload_dir('backend', 'backend')

# 3. Upload public explicitly to public/ (Plesk Document Root requirement)
upload_dir('public', 'public')

# Upload package files
upload_file('package.json', 'package.json')
upload_file('package-lock.json', 'package-lock.json')
upload_file('.env.production', '.env')

# Restart Passenger
print("Triggering Passenger restart...")
try:
    ftp.mkd('tmp')
except:
    pass
with open('restart.txt', 'w') as f:
    f.write('restart')
upload_file('restart.txt', 'tmp/restart.txt')
os.remove('restart.txt')

print("Deployment finished successfully!")
ftp.quit()
