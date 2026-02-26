const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');

const dbPath = path.join(__dirname, '..', 'roster.sqlite');
const db = new sqlite3.Database(dbPath);

async function reset() {
    const hash = await bcrypt.hash('123', 10);
    db.run("UPDATE admins SET password_hash = ? WHERE username = 'eli'", [hash], (err) => {
        if (err) console.error(err);
        else console.log("Password reset success for 'eli' to '123'");
        db.close();
    });
}

reset();
