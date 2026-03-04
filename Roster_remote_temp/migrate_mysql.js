const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

async function migrateRemoteMySQL() {
    console.log('Connecting to remote MySQL...');
    let conn;
    try {
        conn = await mysql.createConnection({
            host: '178.32.171.58',
            user: 'roster',
            password: '8qlq0^Od6YsjbR?x',
            database: 'astromedia_roster'
        });

        console.log('Applying Schema Patches...');

        // 1. Members Table Alternations
        try {
            await conn.query(`ALTER TABLE members ADD COLUMN password_hash VARCHAR(255)`);
            console.log('Added password_hash to members.');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') console.log('password_hash already exists.');
            else throw e;
        }

        try {
            await conn.query(`ALTER TABLE members ADD COLUMN role VARCHAR(50) DEFAULT 'employee'`);
            console.log('Added role to members.');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') console.log('role already exists.');
            else throw e;
        }

        // 2. New Tables
        await conn.query(`
            CREATE TABLE IF NOT EXISTS manager_stores (
                member_id INTEGER NOT NULL,
                store_id INTEGER NOT NULL,
                PRIMARY KEY (member_id, store_id),
                FOREIGN KEY (member_id) REFERENCES members (id) ON DELETE CASCADE,
                FOREIGN KEY (store_id) REFERENCES stores (id) ON DELETE CASCADE
            )
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS reporting_periods (
                id INTEGER PRIMARY KEY AUTO_INCREMENT,
                start_date VARCHAR(20) NOT NULL,
                end_date VARCHAR(20) NOT NULL,
                type VARCHAR(50) NOT NULL,
                status VARCHAR(50) DEFAULT 'open',
                closed_at VARCHAR(50),
                closed_by INTEGER,
                FOREIGN KEY (closed_by) REFERENCES members (id) ON DELETE SET NULL
            )
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS worked_hours (
                id INTEGER PRIMARY KEY AUTO_INCREMENT,
                store_id INTEGER NOT NULL,
                member_id INTEGER NOT NULL,
                date VARCHAR(20) NOT NULL,
                ordinary_hours DECIMAL(10,2) DEFAULT 0,
                saturday_hours DECIMAL(10,2) DEFAULT 0,
                sunday_hours DECIMAL(10,2) DEFAULT 0,
                ph_hours DECIMAL(10,2) DEFAULT 0,
                al_hours DECIMAL(10,2) DEFAULT 0,
                sl_hours DECIMAL(10,2) DEFAULT 0,
                notes TEXT,
                uploaded_by INTEGER,
                uploaded_at VARCHAR(50),
                source VARCHAR(50) DEFAULT 'manual',
                FOREIGN KEY (store_id) REFERENCES stores (id) ON DELETE CASCADE,
                FOREIGN KEY (member_id) REFERENCES members (id) ON DELETE CASCADE,
                FOREIGN KEY (uploaded_by) REFERENCES members (id) ON DELETE SET NULL
            )
        `);
        console.log('Successfully initialized new tables.');

        // Initialize Admin (Leon)
        console.log("Configuring Admin ('Leon')...");
        const adminHash = await bcrypt.hash('admin123', 10);
        const [leonRows] = await conn.query("SELECT * FROM members WHERE LOWER(email) = 'leon@bodero.shop' OR LOWER(name) = 'leon'");
        if (leonRows.length === 0) {
            await conn.query("INSERT INTO members (name, email, role, password_hash) VALUES (?, ?, ?, ?)", ['Leon', 'leon@bodero.shop', 'admin', adminHash]);
        } else {
            await conn.query("UPDATE members SET role = 'admin', password_hash = ? WHERE id = ?", [adminHash, leonRows[0].id]);
        }

        // Initialize Manager (Eli)
        console.log("Configuring Manager ('Eli')...");
        const managerHash = await bcrypt.hash('eli123', 10);
        const [eliRows] = await conn.query("SELECT * FROM members WHERE LOWER(name) = 'eli'");
        let eliId;
        if (eliRows.length === 0) {
            const [res] = await conn.query("INSERT INTO members (name, employment_type, role, password_hash) VALUES (?, ?, ?, ?)", ['Eli', 'manager', 'manager', managerHash]);
            eliId = res.insertId;
        } else {
            eliId = eliRows[0].id;
            await conn.query("UPDATE members SET role = 'manager', password_hash = ? WHERE id = ?", [managerHash, eliId]);
        }

        // Map Manager to Broadmeadows
        const [storeRows] = await conn.query("SELECT id FROM stores WHERE LOWER(name) = 'broadmeadows'");
        if (storeRows.length > 0) {
            const storeId = storeRows[0].id;
            await conn.query("INSERT IGNORE INTO manager_stores (member_id, store_id) VALUES (?, ?)", [eliId, storeId]);
            console.log(`Mapped Eli to Broadmeadows (Store ID: ${storeId})`);
        } else {
            console.log('Warning: Broadmeadows store not found recursively mapping.');
        }

        console.log('Migration Complete.');

    } catch (err) {
        console.error('Migration Failed:', err);
    } finally {
        if (conn) await conn.end();
    }
}

migrateRemoteMySQL();
