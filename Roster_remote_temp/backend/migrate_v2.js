const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'roster.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('Starting migration v2 for stores table...');

db.serialize(() => {
    db.all("PRAGMA table_info(stores)", (err, rows) => {
        if (err) {
            console.error('Pragma error:', err.message);
            db.close();
            return;
        }

        const hasMaxHours = rows && rows.some(r => r.name === 'max_hours');

        if (!hasMaxHours) {
            console.log('Adding max_hours column to stores table...');
            db.run("ALTER TABLE stores ADD COLUMN max_hours REAL DEFAULT 0", (err) => {
                if (err) console.error('Error adding column:', err.message);
                else console.log('Migration v2 complete.');
                db.close();
            });
        } else {
            console.log('Stores table already has max_hours column.');
            db.close();
        }
    });
});
