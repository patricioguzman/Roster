const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'roster.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('Testing insert...');
db.run("INSERT INTO members (name) VALUES ('Test User')", function (err) {
    if (err) {
        console.error('Insert Error:', err.message);
    } else {
        console.log('Insert Success, ID:', this.lastID);
    }
    db.close();
});
