const ftp = require("basic-ftp");

async function start() {
    const client = new ftp.Client();
    try {
        await client.access({
            host: "178.32.171.58",
            user: "bypat.com.au_2pxecwmrk9o",
            password: "q4of7G6~hffFTwb!",
            secure: false
        });
        await client.downloadTo(".env.remote", "/roster.bypat.com.au/.env");
    } catch (err) {
        console.error(err);
    }
    client.close();
}
start();
