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
        const [members] = await p.query("SELECT id, name FROM members");
        console.log("TOTAL MEMBERS IN DB:", members.length);
        const [member_stores] = await p.query("SELECT * FROM member_stores");
        console.log("TOTAL STORE ASSIGNMENTS:", member_stores.length);
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
check();
