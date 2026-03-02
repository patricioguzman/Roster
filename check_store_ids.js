const mysql = require('mysql2/promise');
const sqlite3 = require('sqlite3').verbose();
require('dotenv').config({ path: '.env.production' });

async function checkStores() {
    const p = mysql.createPool({ host: '178.32.171.58', user: 'roster', password: process.env.DB_PASS, database: 'astromedia_roster' });
    const [remoteStores] = await p.query("SELECT id, name FROM stores");
    console.log("REMOTE STORES:", remoteStores);

    const db = new sqlite3.Database('./roster.sqlite');
    db.all("SELECT id, name FROM stores", [], (err, localStores) => {
        console.log("LOCAL STORES:", localStores);
        process.exit(0);
    });
}
checkStores();
