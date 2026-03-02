const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.production' });

async function check() {
    const p = mysql.createPool({ host: '178.32.171.58', user: 'roster', password: process.env.DB_PASS, database: 'astromedia_roster' });
    try {
        const [member61] = await p.query("SELECT * FROM members WHERE id = 61");
        console.log("MEMBER 61:", member61);

        const [harryByName] = await p.query("SELECT * FROM members WHERE name = 'Harry Grant'");
        console.log("HARRY BY NAME:", harryByName);

    } catch (e) { console.error(e); }
    process.exit(0);
}
check();
