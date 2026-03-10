require('dotenv').config({ path: '.env' });
const mysql = require('mysql2/promise');

async function seed() {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST || '178.32.171.58',
        user: process.env.DB_USER || 'roster',
        password: process.env.DB_PASS || '8qlq0^Od6YsjbR?x',
        database: process.env.DB_NAME || 'astromedia_roster'
    });

    const [stores] = await conn.query('SELECT * FROM stores');
    const [memberStores] = await conn.query('SELECT store_id FROM member_stores');
    const storesWithMembers = new Set(memberStores.map(ms => parseInt(ms.store_id)));

    const emptyStores = stores.filter(s => !storesWithMembers.has(parseInt(s.id)));
    console.log(`Found ${emptyStores.length} empty stores: ${emptyStores.map(s => s.name).join(', ')}`);

    for (const store of emptyStores) {
        // Create 2 members for each
        for (let i = 1; i <= 2; i++) {
            const memberName = `Test Emp ${i} ${store.name.split(' ')[0]}`;
            const [res] = await conn.query(
                `INSERT INTO members (name, base_rate, employment_type) VALUES (?, ?, ?)`,
                [memberName, parseFloat((25 + Math.random() * 10).toFixed(2)), 'casual']
            );
            const memberId = res.insertId;
            await conn.query(`INSERT INTO member_stores (member_id, store_id) VALUES (?, ?)`, [memberId, store.id]);

            // Add 4 shifts spanning a sample fortnight
            const dates = ['2026-03-09', '2026-03-12', '2026-03-16', '2026-03-20'];
            for (const date of dates) {
                await conn.query(
                    `INSERT INTO shifts (store_id, member_id, member_name, date, start_time, end_time, duration) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [store.id, memberId, memberName, date, '09:00', '17:00', 8]
                );
            }
        }
        console.log(`Seeded store: ${store.name}`);
    }

    await conn.end();
    console.log('Seeding complete.');
}
seed().catch(err => {
    console.error(err);
    process.exit(1);
});
