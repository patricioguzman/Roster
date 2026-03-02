const mysql = require('mysql2/promise');

async function mapNames() {
    const names = ['Liz', 'Joanna', 'Chloe', 'Teresa', 'Ashley', 'Pat', 'Brad', 'Stacey', 'Harry', 'Ricardo'];
    try {
        const conn = await mysql.createConnection({
            host: '178.32.171.58',
            user: 'roster',
            password: '8qlq0^Od6YsjbR?x',
            database: 'astromedia_roster',
            connectTimeout: 10000
        });

        for (const name of names) {
            const [rows] = await conn.query('SELECT id, name, email FROM members WHERE name LIKE ?', [`%${name}%`]);
            console.log(`Matches for ${name}:`);
            console.log(rows);
            console.log('---');
        }

        await conn.end();
    } catch (err) {
        console.error('Error:', err);
    }
}

mapNames();
