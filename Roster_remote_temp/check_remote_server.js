const ftp = require("basic-ftp");

async function downloadServerJs() {
    const client = new ftp.Client();
    try {
        await client.access({
            host: "178.32.171.58",
            user: "bypat.com.au_2pxecwmrk9o",
            password: "q4of7G6~hffFTwb!",
            secure: false
        });
        await client.downloadTo("server_live.js", "/roster.bypat.com.au/backend/server.js");
        console.log("Downloaded live server.js");
    } catch (err) {
        console.error(err);
    }
    client.close();
}
downloadServerJs();
