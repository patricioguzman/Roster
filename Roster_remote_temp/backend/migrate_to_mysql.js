const sqlite3 = require('sqlite3').verbose();
const mysql = require('mysql2/promise');
const path = require('path');
const bcrypt = require('bcrypt');

async function migrateData() {
    console.log("Starting database migration from SQLite to MariaDB...");

    // Connect to SQLite
    const dbPath = path.join(__dirname, '..', 'roster.sqlite');
    const sqliteDb = await new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) reject(err);
            else resolve(db);
        });
    });

    const getSqliteData = (query) => {
        return new Promise((resolve, reject) => {
            sqliteDb.all(query, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    };

    try {
        // Connect to Remote MariaDB
        const mysqlPool = mysql.createPool({
            host: '178.32.171.58',
            user: 'roster',
            password: '8qlq0^Od6YsjbR?x',
            database: 'astromedia_roster',
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });

        // 1. Create Tables
        console.log("Creating tables on remote MariaDB...");
        const createQueries = [
            `CREATE TABLE IF NOT EXISTS stores (id INTEGER PRIMARY KEY AUTO_INCREMENT, name VARCHAR(255) NOT NULL UNIQUE, max_hours DECIMAL(10,2) DEFAULT 0)`,
            `CREATE TABLE IF NOT EXISTS members (id INTEGER PRIMARY KEY AUTO_INCREMENT, name VARCHAR(255) NOT NULL, phone VARCHAR(100), email VARCHAR(255), base_rate DECIMAL(10,2) DEFAULT 33.19, employment_type VARCHAR(50) DEFAULT 'casual')`,
            `CREATE TABLE IF NOT EXISTS member_stores (member_id INTEGER NOT NULL, store_id INTEGER NOT NULL, PRIMARY KEY (member_id, store_id), FOREIGN KEY (member_id) REFERENCES members (id) ON DELETE CASCADE, FOREIGN KEY (store_id) REFERENCES stores (id) ON DELETE CASCADE)`,
            `CREATE TABLE IF NOT EXISTS settings (key_name VARCHAR(100) PRIMARY KEY, value VARCHAR(255))`,
            `CREATE TABLE IF NOT EXISTS shifts (id INTEGER PRIMARY KEY AUTO_INCREMENT, store_id INTEGER NOT NULL, member_id INTEGER NOT NULL, member_name VARCHAR(255), date VARCHAR(20) NOT NULL, start_time VARCHAR(20) NOT NULL, end_time VARCHAR(20) NOT NULL, duration DECIMAL(10,2) NOT NULL)`,
            `CREATE TABLE IF NOT EXISTS admins (id INTEGER PRIMARY KEY AUTO_INCREMENT, username VARCHAR(100) NOT NULL UNIQUE, password_hash VARCHAR(255) NOT NULL)`
        ];
        for (let q of createQueries) await mysqlPool.query(q);

        // 2. Fetch data from SQLite
        console.log("Reading data from local SQLite database...");
        const stores = await getSqliteData("SELECT * FROM stores");
        const members = await getSqliteData("SELECT * FROM members");
        const memberStores = await getSqliteData("SELECT * FROM member_stores");
        const settings = await getSqliteData("SELECT * FROM settings");
        const shifts = await getSqliteData("SELECT * FROM shifts");
        const admins = await getSqliteData("SELECT * FROM admins");

        // 3. Insert into MariaDB
        console.log("Migrating Admin Users...");
        for (let a of admins) await mysqlPool.execute("INSERT IGNORE INTO admins (id, username, password_hash) VALUES (?, ?, ?)", [a.id, a.username, a.password_hash]);
        if (admins.length === 0) {
            const hash = await bcrypt.hash('eli123', 10);
            await mysqlPool.execute("INSERT IGNORE INTO admins (username, password_hash) VALUES (?, ?)", ['eli', hash]);
        }

        console.log("Migrating Stores...");
        for (let s of stores) await mysqlPool.execute("INSERT IGNORE INTO stores (id, name, max_hours) VALUES (?, ?, ?)", [s.id, s.name, s.max_hours]);

        console.log("Migrating Members...");
        for (let m of members) await mysqlPool.execute("INSERT IGNORE INTO members (id, name, phone, email, base_rate, employment_type) VALUES (?, ?, ?, ?, ?, ?)", [m.id, m.name, m.phone, m.email, m.base_rate, m.employment_type]);

        console.log("Migrating Member-Store Allocations...");
        for (let ms of memberStores) await mysqlPool.execute("INSERT IGNORE INTO member_stores (member_id, store_id) VALUES (?, ?)", [ms.member_id, ms.store_id]);

        console.log("Migrating Settings...");
        for (let s of settings) await mysqlPool.execute("REPLACE INTO settings (key_name, value) VALUES (?, ?)", [s.key, s.value]);

        console.log("Migrating Shifts...");
        for (let s of shifts) await mysqlPool.execute("INSERT IGNORE INTO shifts (id, store_id, member_id, member_name, date, start_time, end_time, duration) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [s.id, s.store_id, s.member_id, s.member_name, s.date, s.start_time, s.end_time, s.duration]);

        console.log("Migration Complete! 🎉");
        process.exit(0);

    } catch (err) {
        console.error("Migration failed:", err);
        process.exit(1);
    }
}

migrateData();
