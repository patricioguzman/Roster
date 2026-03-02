const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.production' });

async function check() {
    const p = mysql.createPool({ host: '178.32.171.58', user: 'roster', password: process.env.DB_PASS, database: 'astromedia_roster' });
    try {
        const [h] = await p.query("SELECT * FROM members WHERE name = 'Harry Grant'");
        console.log("HARRY GRANT REMOTE:", h);

        const [ms] = await p.query("SELECT * FROM member_stores WHERE member_id = ?", [h[0].id]);
        console.log("HARRY STORES:", ms);

        const [sh] = await p.query("SELECT * FROM shifts WHERE member_name = 'Harry Grant'");
        console.log("HARRY SHIFTS:", sh);
    } catch (e) { console.error(e); }
    process.exit(0);
}
check();
