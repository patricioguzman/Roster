const mysql = require('mysql2/promise');
async function run() {
    const conn = await mysql.createConnection({
        host: '178.32.171.58',
        user: 'roster',
        password: '8qlq0^Od6YsjbR?x',
        database: 'astromedia_roster'
    });

    const [members] = await conn.query("SELECT id, name, email, role, password_hash FROM members WHERE LOWER(name) IN ('eli', 'leon') OR LOWER(email) = 'leon@bodero.shop'");
    console.log("MEMBERS TABLE:", members);

    const [admins] = await conn.query("SELECT * FROM admins");
    console.log("ADMINS TABLE:", admins);

    await conn.end();
}
run();
