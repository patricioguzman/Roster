const mysql = require('mysql2/promise');

async function checkStoreMembers() {
    try {
        const conn = await mysql.createConnection({
            host: '178.32.171.58',
            user: 'roster',
            password: '8qlq0^Od6YsjbR?x',
            database: 'astromedia_roster',
            connectTimeout: 10000
        });

        const [members] = await conn.query('SELECT m.id, m.name, m.email FROM members m JOIN member_stores ms ON m.id = ms.member_id WHERE ms.store_id = 1');
        console.log('Broady Members:', members);

        await conn.end();
    } catch (err) {
        console.error('Error:', err);
    }
}

checkStoreMembers();
