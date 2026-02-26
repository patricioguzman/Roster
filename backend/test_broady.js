const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.production' });

async function check() {
    try {
        const p = mysql.createPool({
            host: '178.32.171.58',
            user: 'roster',
            password: process.env.DB_PASS,
            database: 'astromedia_roster'
        });
        const [stores] = await p.query("SELECT * FROM stores");
        console.log("STORES IN DB:", stores);

        const [shifts] = await p.query("SELECT * FROM shifts WHERE store_id IN (SELECT id FROM stores WHERE name = 'BROADY')");
        console.log("SHIFTS IN BROADY:", shifts.length);
    } catch (e) {
        console.error("ERROR:", e);
    }
    process.exit(0);
}
check();
