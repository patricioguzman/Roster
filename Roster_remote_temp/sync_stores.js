const mysql = require('mysql2/promise');

async function syncStores() {
    console.log('Connecting to remote MySQL...');
    let conn;
    try {
        conn = await mysql.createConnection({
            host: '178.32.171.58',
            user: 'roster',
            password: '8qlq0^Od6YsjbR?x',
            database: 'astromedia_roster'
        });

        const storesToSync = [
            { id: 1, name: 'Northland' },
            { id: 2, name: 'Airport West' },
            { id: 5, name: 'Broadmeadows' },
            { id: 6, name: 'Dandenong' },
            { id: 7, name: 'Parkmore' },
            { id: 8, name: 'Southland' },
            { id: 9, name: 'Werribee' }
        ];

        console.log('Syncing Stores...');
        for (const store of storesToSync) {
            // Upsert store logic
            const [existing] = await conn.query('SELECT id FROM stores WHERE id = ?', [store.id]);
            if (existing.length > 0) {
                await conn.query('UPDATE stores SET name = ? WHERE id = ?', [store.name, store.id]);
                console.log(`Updated Store ID ${store.id}: ${store.name}`);
            } else {
                await conn.query('INSERT INTO stores (id, name, max_hours) VALUES (?, ?, ?)', [store.id, store.name, 0]);
                console.log(`Inserted Store ID ${store.id}: ${store.name}`);
            }
        }

        console.log('Successfully synced all stores to Remote Database!');
    } catch (err) {
        console.error('Sync Failed:', err);
    } finally {
        if (conn) await conn.end();
    }
}

syncStores();
