const mysql = require('mysql2/promise');

async function fetchInfo() {
    try {
        const conn = await mysql.createConnection({
            host: '178.32.171.58',
            user: 'roster',
            password: '8qlq0^Od6YsjbR?x',
            database: 'astromedia_roster',
            connectTimeout: 10000
        });

        const [stores] = await conn.query('SELECT * FROM stores');
        console.log('Stores:', stores);

        const [members] = await conn.query('SELECT * FROM members');
        console.log('Members:', members);

        await conn.end();
    } catch (err) {
        console.error('Error:', err);
    }
}

fetchInfo();
