const ftp = require("basic-ftp");

async function downloadServerJs() {
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
        await client.downloadTo("server_live.js", "/roster.bypat.com.au/backend/server.js");
        console.log("Downloaded live server.js");
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
    client.close();
}
downloadServerJs();
