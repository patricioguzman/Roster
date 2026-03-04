const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'roster_remote.sqlite');

async function migrate() {
    const db = new sqlite3.Database(DB_FILE, (err) => {
        if (err) {
            console.error("Error connecting to remote DB:", err.message);
            process.exit(1);
        }
    });

    const run = (sql, params = []) => new Promise((res, rej) => db.run(sql, params, function (err) { if (err) rej(err); else res(this); }));
    const get = (sql, params = []) => new Promise((res, rej) => db.get(sql, params, (err, row) => { if (err) rej(err); else res(row); }));

    console.log("Applying schema migrations to remote DB...");

    try {
        // 1. Alter Members Table
        await run(`ALTER TABLE members ADD COLUMN password_hash TEXT`).catch(() => console.log('password_hash exists'));
        await run(`ALTER TABLE members ADD COLUMN role TEXT DEFAULT 'employee'`).catch(() => console.log('role exists'));

        // 2. Create new tables
        await run(`
            CREATE TABLE IF NOT EXISTS manager_stores (
                member_id INTEGER,
                store_id INTEGER,
                PRIMARY KEY (member_id, store_id),
                FOREIGN KEY (member_id) REFERENCES members(id),
                FOREIGN KEY (store_id) REFERENCES stores(id)
            )
        `);

        await run(`
            CREATE TABLE IF NOT EXISTS worked_hours (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                store_id INTEGER NOT NULL,
                member_id INTEGER NOT NULL,
                date TEXT NOT NULL,
                ordinary_hours REAL DEFAULT 0,
                saturday_hours REAL DEFAULT 0,
                sunday_hours REAL DEFAULT 0,
                ph_hours REAL DEFAULT 0,
                al_hours REAL DEFAULT 0,
                sl_hours REAL DEFAULT 0,
                notes TEXT,
                uploaded_by INTEGER,
                uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (store_id) REFERENCES stores(id),
                FOREIGN KEY (member_id) REFERENCES members(id)
            )
        `);

        await run(`
            CREATE TABLE IF NOT EXISTS reporting_periods (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                store_id INTEGER NOT NULL,
                start_date TEXT NOT NULL,
                end_date TEXT NOT NULL,
                type TEXT NOT NULL,
                status TEXT DEFAULT 'closed',
                closed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                closed_by INTEGER,
                FOREIGN KEY (store_id) REFERENCES stores(id)
            )
        `);

        // 3. Setup Admin User (Leon)
        console.log("Configuring Admin ('Leon')...");
        const adminHash = await bcrypt.hash('admin123', 10);
        let leonRow = await get("SELECT * FROM members WHERE LOWER(email) = 'leon@bodero.shop' OR LOWER(name) = 'leon'");
        if (!leonRow) {
            await run("INSERT INTO members (name, email, role, password_hash) VALUES (?, ?, ?, ?)", ['Leon', 'leon@bodero.shop', 'admin', adminHash]);
        } else {
            await run("UPDATE members SET role = 'admin', password_hash = ? WHERE id = ?", [adminHash, leonRow.id]);
        }

        // 4. Setup Manager User (Eli)
        console.log("Configuring Manager ('Eli')...");
        const managerHash = await bcrypt.hash('eli123', 10);
        let eliRow = await get("SELECT * FROM members WHERE LOWER(name) = 'eli'");
        let eliId;
        if (!eliRow) {
            const res = await run("INSERT INTO members (name, employment_type, role, password_hash) VALUES (?, ?, ?, ?)", ['Eli', 'manager', 'manager', managerHash]);
            eliId = res.lastID;
        } else {
            eliId = eliRow.id;
            await run("UPDATE members SET role = 'manager', password_hash = ? WHERE id = ?", [managerHash, eliId]);
        }

        // Assuming Store 5 is Broadmeadows based on local DB exploration
        const storeId = 5;
        await run("INSERT OR IGNORE INTO manager_stores (member_id, store_id) VALUES (?, ?)", [eliId, storeId]);

        console.log("Migration Complete.");
    } catch (e) {
        console.error("Migration Error:", e);
    }
    db.close();
}

migrate();
