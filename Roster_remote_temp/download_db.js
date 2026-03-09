const ftp = require("basic-ftp");
const fs = require("fs");

async function start() {
    const client = new ftp.Client();
    client.ftp.verbose = true;
    try {
        console.log("Connecting...");

        if (!process.env.FTP_PASS) {
            throw new Error("FTP_PASS environment variable not set.");
        }

        await client.access({
            host: process.env.FTP_HOST || "178.32.171.58",
            user: process.env.FTP_USER || "bypat.com.au_2pxecwmrk9o",
            password: process.env.FTP_PASS,
            secure: false
        });

        console.log("Downloading remote database securely...");
        await client.downloadTo("roster_remote.sqlite", "/roster.bypat.com.au/roster.sqlite");
        console.log("Done.");
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
    client.close();
}
start();
