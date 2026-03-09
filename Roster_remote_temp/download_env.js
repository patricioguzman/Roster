const ftp = require("basic-ftp");

async function start() {
    const client = new ftp.Client();
    try {
        if (!process.env.FTP_PASS) {
            throw new Error("FTP_PASS environment variable not set.");
        }

        await client.access({
            host: process.env.FTP_HOST || "178.32.171.58",
            user: process.env.FTP_USER || "bypat.com.au_2pxecwmrk9o",
            password: process.env.FTP_PASS,
            secure: false
        });
        await client.downloadTo(".env.remote", "/roster.bypat.com.au/.env");
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
    client.close();
}
start();
