const mysql = require('mysql2/promise');
async function run() {
    const conn = await mysql.createConnection({
        host: '178.32.171.58',
        user: 'roster',
        password: '8qlq0^Od6YsjbR?x',
        database: 'astromedia_roster'
    });

    const [eliRows] = await conn.query("SELECT id FROM members WHERE LOWER(name) = 'eli'");
    if (eliRows.length > 0) {
        const eliId = eliRows[0].id;
        // Map to BROADY (Store ID 5)
        await conn.query("INSERT IGNORE INTO manager_stores (member_id, store_id) VALUES (?, ?)", [eliId, 5]);
        console.log("Successfully mapped Eli to BROADY (Store 5)!");
    } else {
        console.log("Could not find Eli in Live Database.");
    }

    await conn.end();
}
run();
