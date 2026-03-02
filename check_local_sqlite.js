const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./backend/roster.sqlite');
db.all("SELECT * FROM members", (err, rows) => {
    console.log("LOCAL SQLITE MEMBERS COUNT:", rows.length);
});
