const mysql = require('mysql2/promise');
async function run() {
    const conn = await mysql.createConnection({
        host: '178.32.171.58',
        user: 'roster',
        password: '8qlq0^Od6YsjbR?x',
        database: 'astromedia_roster'
    });
    const [rows] = await conn.query("SELECT id, name FROM stores");
    console.log(rows);
    await conn.end();
}
run();
