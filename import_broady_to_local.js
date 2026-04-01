const mysql = require('mysql2/promise');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config({ path: '.env.production' });

async function importBroady() {
    console.log('Connecting to remote MySQL...');
    const conn = await mysql.createConnection({
        host: '178.32.171.58',
        user: 'roster',
        password: process.env.DB_PASS,
        database: 'astromedia_roster'
    });

    console.log('Fetching Broady store data...');
    // Get store
    const [stores] = await conn.query('SELECT * FROM stores WHERE name = "BROADY"');
    if (stores.length === 0) {
        console.error('Store BROADY not found in remote database.');
        await conn.end();
        process.exit(1);
    }
    const remoteStore = stores[0];

    // Get shifts for this store
    console.log('Fetching shifts for Broady...');
    const [shifts] = await conn.query('SELECT * FROM shifts WHERE store_id = ?', [remoteStore.id]);

    // Get members for this store
    console.log('Fetching members associated with Broady...');
    // We get all members that have shifts in Broady, and all members linked to Broady
    const [members] = await conn.query(`
        SELECT m.* FROM members m
        JOIN member_stores ms ON m.id = ms.member_id
        WHERE ms.store_id = ?
    `, [remoteStore.id]);


    await conn.end();
    console.log(`Fetched ${shifts.length} shifts and ${members.length} members from remote.`);

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

    const getQuery = (query, params = []) => {
        return new Promise((resolve, reject) => {
            db.get(query, params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    };

    console.log('Applying to local SQLite database...');

    try {
        await runQuery('BEGIN TRANSACTION');

        // 1. Insert or get local store ID
        let localStore = await getQuery('SELECT id FROM stores WHERE name = ?', [remoteStore.name]);
        let localStoreId;
        if (!localStore) {
            const res = await runQuery('INSERT INTO stores (name, max_hours) VALUES (?, ?)', [remoteStore.name, remoteStore.max_hours]);
            localStoreId = res.id;
        } else {
            localStoreId = localStore.id;
        }

        // Map remote member IDs to local member IDs
        const memberIdMap = {};

        // 2. Insert or update members
        for (const rm of members) {
            // Try to find if member already exists locally by name
            let localMember = await getQuery('SELECT id FROM members WHERE name = ?', [rm.name]);
            let localMemberId;

            if (!localMember) {
                const res = await runQuery('INSERT INTO members (name, phone, email, base_rate, employment_type) VALUES (?, ?, ?, ?, ?)',
                    [rm.name, rm.phone || null, rm.email || null, rm.base_rate, rm.employment_type || 'casual']);
                localMemberId = res.id;
            } else {
                localMemberId = localMember.id;
            }
            memberIdMap[rm.id] = localMemberId;

            // Link member to store
            await runQuery('INSERT OR IGNORE INTO member_stores (member_id, store_id) VALUES (?, ?)', [localMemberId, localStoreId]);
        }

        // 3. Insert shifts
        // First delete all existing shifts for this store in local DB
        await runQuery('DELETE FROM shifts WHERE store_id = ?', [localStoreId]);

        for (const rs of shifts) {
            const localMemId = memberIdMap[rs.member_id];
            if (localMemId) {
                await runQuery(`INSERT INTO shifts (store_id, member_id, member_name, date, start_time, end_time, duration) 
                                VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [localStoreId, localMemId, rs.member_name, rs.date, rs.start_time, rs.end_time, rs.duration]);
            }
        }

        await runQuery('COMMIT');
        console.log('Successfully imported Broady store, members, and shifts to local database!');

    } catch (err) {
        await runQuery('ROLLBACK');
        console.error('Error importing to local DB:', err);
    } finally {
        db.close();
    }
}

importBroady().catch(console.error);
