const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'roster.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('Starting migration script...');

db.serialize(() => {
    // 1. Create the new members table (temporary name)
    db.run(`CREATE TABLE IF NOT EXISTS members_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        base_rate REAL DEFAULT 33.19,
        employment_type TEXT DEFAULT 'casual'
    )`);

    // 2. Check schema
    db.all("PRAGMA table_info(members)", (err, rows) => {
        if (err) {
            console.error('Pragma error:', err.message);
            db.close();
            return;
        }

        const hasStoreId = rows && rows.some(r => r.name === 'store_id');

        if (hasStoreId) {
            console.log('Old schema (with store_id) detected. Migrating data...');

            db.serialize(() => {
                // Ensure member_stores exists
                db.run(`CREATE TABLE IF NOT EXISTS member_stores (
                    member_id INTEGER NOT NULL,
                    store_id INTEGER NOT NULL,
                    PRIMARY KEY (member_id, store_id),
                    FOREIGN KEY (member_id) REFERENCES members (id) ON DELETE CASCADE,
                    FOREIGN KEY (store_id) REFERENCES stores (id) ON DELETE CASCADE
                )`);

                // Copy data to members_new
                db.run(`INSERT INTO members_new (id, name, phone, email, base_rate, employment_type)
                        SELECT id, name, phone, email, base_rate, employment_type FROM members`);

                // Populate member_stores from old store_id
                db.run(`INSERT OR IGNORE INTO member_stores (member_id, store_id)
                        SELECT id, store_id FROM members`);

                // 3. Replace old table
                db.run("DROP TABLE members");
                db.run("ALTER TABLE members_new RENAME TO members", (err) => {
                    if (err) console.error('Rename error:', err.message);
                    else console.log('Migration complete. members table updated.');
                    db.close();
                });
            });
        } else {
            console.log('Already using the new schema or table missing.');
            db.run("DROP TABLE IF EXISTS members_new", () => {
                db.close();
            });
        }
    });
});
