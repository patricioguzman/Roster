const mysql = require('mysql2/promise');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config({ path: '.env.production' });

async function syncMaxHours() {
    console.log('Connecting to remote MySQL...');
    const conn = await mysql.createConnection({
        host: '178.32.171.58',
        user: 'roster',
        password: process.env.DB_PASS,
        database: 'astromedia_roster'
    });

    const [remoteStores] = await conn.query('SELECT * FROM stores');
    await conn.end();

    console.log(`Fetched ${remoteStores.length} stores from remote.`);

    const dbPath = path.join(__dirname, 'roster.sqlite');
    const db = new sqlite3.Database(dbPath);

    const runQuery = (query, params = []) => {
        return new Promise((resolve, reject) => {
            db.run(query, params, function (err) {
                if (err) reject(err);
                else resolve({ id: this.lastID, changes: this.changes });
            });
        });
    };

    console.log('Updating local SQLite database...');

    try {
        await runQuery('BEGIN TRANSACTION');

        for (const rs of remoteStores) {
            console.log(`Updating ${rs.name}: max_hours = ${rs.max_hours}`);
            await runQuery('UPDATE stores SET max_hours = ? WHERE name = ?', [rs.max_hours, rs.name]);
        }

        await runQuery('COMMIT');
        console.log('Successfully synced max_hours to local database!');

    } catch (err) {
        await runQuery('ROLLBACK');
        console.error('Error importing to local DB:', err);
    } finally {
        db.close();
    }
}

syncMaxHours().catch(console.error);
