const mysql = require('mysql2/promise');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

async function importData() {
    console.log('Connecting to remote MySQL...');
    const conn = await mysql.createConnection({
        host: '178.32.171.58',
        user: 'roster',
        password: '8qlq0^Od6YsjbR?x',
        database: 'astromedia_roster'
    });

    const tables = ['stores', 'members', 'member_stores', 'settings', 'shifts', 'admins'];
    const data = {};

    for (const table of tables) {
        if (table === 'settings') {
            const [rows] = await conn.query(`SELECT key_name as "key", value FROM settings`);
            data[table] = rows;
        } else {
            const [rows] = await conn.query(`SELECT * FROM ${table}`);
            data[table] = rows;
        }
    }
    await conn.end();
    console.log('Remote data fetched successfully.');

    const dbPath = path.join(__dirname, 'roster.sqlite');

    // Connect to SQLite
    const db = new sqlite3.Database(dbPath);

    db.serialize(() => {
        // Drop and recreate tables to ensure clean slate
        db.run(`DROP TABLE IF EXISTS member_stores`);
        db.run(`DROP TABLE IF EXISTS shifts`);
        db.run(`DROP TABLE IF EXISTS members`);
        db.run(`DROP TABLE IF EXISTS stores`);
        db.run(`DROP TABLE IF EXISTS settings`);
        db.run(`DROP TABLE IF EXISTS admins`);

        db.run(`CREATE TABLE IF NOT EXISTS stores (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, max_hours REAL DEFAULT 0)`);
        db.run(`CREATE TABLE IF NOT EXISTS members (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, phone TEXT, email TEXT, base_rate REAL DEFAULT 33.19, employment_type TEXT DEFAULT 'casual')`);
        db.run(`CREATE TABLE IF NOT EXISTS member_stores (member_id INTEGER NOT NULL, store_id INTEGER NOT NULL, PRIMARY KEY (member_id, store_id), FOREIGN KEY (member_id) REFERENCES members (id) ON DELETE CASCADE, FOREIGN KEY (store_id) REFERENCES stores (id) ON DELETE CASCADE)`);
        db.run(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)`);
        db.run(`CREATE TABLE IF NOT EXISTS shifts (id INTEGER PRIMARY KEY AUTOINCREMENT, store_id INTEGER NOT NULL, member_id INTEGER NOT NULL, member_name TEXT, date TEXT NOT NULL, start_time TEXT NOT NULL, end_time TEXT NOT NULL, duration REAL NOT NULL)`);
        db.run(`CREATE TABLE IF NOT EXISTS admins (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL)`);

        db.run('BEGIN TRANSACTION');

        const insertStore = db.prepare(`INSERT INTO stores (id, name, max_hours) VALUES (?, ?, ?)`);
        for (const r of data['stores']) insertStore.run(r.id, r.name, r.max_hours);
        insertStore.finalize();

        const insertMember = db.prepare(`INSERT INTO members (id, name, phone, email, base_rate, employment_type) VALUES (?, ?, ?, ?, ?, ?)`);
        for (const r of data['members']) insertMember.run(r.id, r.name, r.phone, r.email, r.base_rate, r.employment_type);
        insertMember.finalize();

        const insertMemberStore = db.prepare(`INSERT INTO member_stores (member_id, store_id) VALUES (?, ?)`);
        for (const r of data['member_stores']) insertMemberStore.run(r.member_id, r.store_id);
        insertMemberStore.finalize();

        const insertSetting = db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?)`);
        for (const r of data['settings']) insertSetting.run(r.key, r.value);
        insertSetting.finalize();

        const insertShift = db.prepare(`INSERT INTO shifts (id, store_id, member_id, member_name, date, start_time, end_time, duration) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
        for (const r of data['shifts']) insertShift.run(r.id, r.store_id, r.member_id, r.member_name, r.date, r.start_time, r.end_time, r.duration);
        insertShift.finalize();

        const insertAdmin = db.prepare(`INSERT INTO admins (id, username, password_hash) VALUES (?, ?, ?)`);
        for (const r of data['admins']) insertAdmin.run(r.id, r.username, r.password_hash);
        insertAdmin.finalize();

        db.run('COMMIT', () => {
            console.log('Import completed. Local SQLite database updated with production data.');
        });
    });
}
importData().catch(console.error);
