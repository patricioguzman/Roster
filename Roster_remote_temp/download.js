const ftp = require("basic-ftp");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

async function downloadDir(client, remotePath, localPath) {
    console.log(`Downloading ${remotePath} to ${localPath}`);
    if (!fs.existsSync(localPath)) {
        fs.mkdirSync(localPath, { recursive: true });
    }

    try {
        const list = await client.list(remotePath);
        for (const item of list) {
            const remoteItemPath = `${remotePath}/${item.name}`;
            const localItemPath = path.join(localPath, item.name);

            if (item.isDirectory) {
                if (item.name !== '.' && item.name !== '..' && item.name !== 'node_modules') {
                    await downloadDir(client, remoteItemPath, localItemPath);
                }
            } else {
                console.log(` - File: ${item.name}`);
                await client.downloadTo(localItemPath, remoteItemPath);
            }
        }
    } catch (err) {
        console.error(`Error processing ${remotePath}:`, err);
    }
}

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

        console.log("Connected.");
        await downloadDir(client, "/roster.bypat.com.au", __dirname);

    }
    catch (err) {
        console.log(err);
    }
    client.close();
}

start();
