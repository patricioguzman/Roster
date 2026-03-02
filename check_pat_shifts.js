const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./roster.sqlite');
db.all("SELECT * FROM shifts WHERE member_name LIKE '%Pat%' OR member_name LIKE '%Ashlyn%'", [], (err, rows) => {
    if (err) return console.error(err);
    console.log("LOCAL SHIFTS:", rows);
});
