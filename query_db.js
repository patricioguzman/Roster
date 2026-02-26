const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.production' });
async function start() {
    const p = mysql.createPool({ host: '178.32.171.58', user: 'roster', password: process.env.DB_PASS, database: 'astromedia_roster' });
    const [stores] = await p.query("SELECT * FROM stores");
    console.log("MariaDB Stores:", stores);
    process.exit(0);
}
start();
