const ftp = require("basic-ftp");
const fs = require("fs");

async function start() {
    const client = new ftp.Client();
    client.ftp.verbose = true;
    try {
        console.log("Connecting...");
        await client.access({
            host: "178.32.171.58",
            user: "bypat.com.au_2pxecwmrk9o",
            password: "q4of7G6~hffFTwb!",
            secure: false
        });

        console.log("Downloading remote database securely...");
        await client.downloadTo("roster_remote.sqlite", "/roster.bypat.com.au/roster.sqlite");
        console.log("Done.");
    } catch (err) {
        console.error(err);
    }
    client.close();
}
start();
