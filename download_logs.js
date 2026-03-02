require('dotenv').config({ path: '.env.production' });
const ftp = require("basic-ftp");
async function run() {
    const client = new ftp.Client();
    try {
        await client.access({
            host: process.env.FTP_HOST,
            user: process.env.FTP_USER,
            password: process.env.FTP_PASS,
            secure: false
        });
        await client.downloadTo("remote_backend.log", "/roster.bypat.com.au/backend/backend.log");
        console.log("Log downloaded");
    } catch (e) { console.error(e); }
    client.close();
}
run();
