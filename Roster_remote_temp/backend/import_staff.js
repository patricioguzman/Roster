const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const stuffPath = path.join(__dirname, '..', 'stuff.json');
const dbPath = path.join(__dirname, '..', 'roster.sqlite');

const stuff = JSON.parse(fs.readFileSync(stuffPath, 'utf8'));
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    console.log('Ensuring tables exist...');

    // Create Members Table
    db.run(`CREATE TABLE IF NOT EXISTS members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        base_rate REAL DEFAULT 33.19,
        employment_type TEXT DEFAULT 'casual'
    )`);

    // Create member_stores Join Table
    db.run(`CREATE TABLE IF NOT EXISTS member_stores (
        member_id INTEGER NOT NULL,
        store_id INTEGER NOT NULL,
        PRIMARY KEY (member_id, store_id),
        FOREIGN KEY (member_id) REFERENCES members (id) ON DELETE CASCADE,
        FOREIGN KEY (store_id) REFERENCES stores (id) ON DELETE CASCADE
    )`);

    console.log('Starting import...');

    // Ensure Broadmeadows exists and get its ID
    db.get("SELECT id FROM stores WHERE name = 'Broadmeadows'", (err, storeRow) => {
        const storeId = storeRow ? storeRow.id : 1;

        console.log(`Found ${stuff.staff.length} staff members in stuff.json`);
        let completed = 0;
        const total = stuff.staff.length;

        const insertMember = db.prepare("INSERT OR IGNORE INTO members (name, phone, email, base_rate, employment_type) VALUES (?, ?, ?, ?, ?)");
        const insertMemberStore = db.prepare("INSERT OR IGNORE INTO member_stores (member_id, store_id) VALUES (?, ?)");

        if (total === 0) {
            console.log('No staff to import.');
            db.close();
            return;
        }

        stuff.staff.forEach(staff => {
            console.log(`Processing: ${staff.fullName}`);
            insertMember.run([staff.fullName, staff.phone || '', staff.email || '', 33.19, 'casual'], function (err) {
                if (err) {
                    console.error(`Error inserting ${staff.fullName}:`, err.message);
                } else {
                    const memberId = this.lastID;
                    if (memberId) {
                        insertMemberStore.run([memberId, storeId], (err) => {
                            if (err) console.error(`Error linking ${staff.fullName} to store:`, err.message);
                            else console.log(`Imported and linked: ${staff.fullName}`);
                            checkDone();
                        });
                        return; // checkDone handled in nested callback
                    } else {
                        // Member might already exist, try to find them to link to store
                        db.get("SELECT id FROM members WHERE name = ?", [staff.fullName], (err, row) => {
                            if (row) {
                                insertMemberStore.run([row.id, storeId], (err) => {
                                    if (err) console.error(`Error linking existing ${staff.fullName} to store:`, err.message);
                                    else console.log(`Linked existing staff: ${staff.fullName}`);
                                    checkDone();
                                });
                            } else {
                                checkDone();
                            }
                        });
                        return; // checkDone handled in nested callback
                    }
                }
                checkDone();
            });
        });

        function checkDone() {
            completed++;
            if (completed === total) {
                console.log('All staff processed.');
                insertMember.finalize();
                insertMemberStore.finalize(() => {
                    console.log('Import finished.');
                    db.close();
                });
            }
        }
    });
});
