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
        const [members] = await p.query("SELECT m.name FROM members m JOIN member_stores ms ON m.id = ms.member_id JOIN stores s ON s.id = ms.store_id WHERE s.name = 'BROADY'");
        console.log("BROADY MEMBERS DB COUNT:", members.length);
        console.log("NAMES:", members.map(m => m.name).join(', '));
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
check();
