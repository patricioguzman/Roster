const mysql = require('mysql2/promise');

async function checkShifts() {
    try {
        const conn = await mysql.createConnection({
            host: '178.32.171.58',
            user: 'roster',
            password: '8qlq0^Od6YsjbR?x',
            database: 'astromedia_roster',
            connectTimeout: 10000
        });

        const [rows] = await conn.query('SELECT member_name, date, start_time, end_time FROM shifts WHERE store_id = 1 AND date >= "2026-03-05" AND date <= "2026-03-11" ORDER BY date, start_time');
        console.log(`Found ${rows.length} shifts for Broady between 2026-03-05 and 2026-03-11.`);

        await conn.end();
    } catch (err) {
        console.error('Error:', err);
    }
}

checkShifts();
