const ftp = require("basic-ftp");
const path = require("path");
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

        console.log("Connected. Uploading specific modified files...");

        // Ensure remote directories exist
        await client.ensureDir("/roster.bypat.com.au");
        await client.ensureDir("/roster.bypat.com.au/backend");
        await client.ensureDir("/roster.bypat.com.au/public");

        // Navigate back to root
        await client.cd("/roster.bypat.com.au");

        // Upload files
        console.log("Uploading package.json...");
        await client.uploadFrom("package.json", "package.json");
        console.log("Uploading package-lock.json...");
        await client.uploadFrom("package-lock.json", "package-lock.json");
        console.log("Uploading backend/server.js...");
        await client.uploadFrom("backend/server.js", "backend/server.js");
        console.log("Uploading public/index.html...");
        await client.uploadFrom("public/index.html", "public/index.html");

        console.log("Upload Complete! Please restart the remote Node application (usually via cPanel) and let it run `npm install` for the new `xlsx` package.");

    } catch (err) {
        console.error(err);
    }
    client.close();
}

start();
