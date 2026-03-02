const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./roster.sqlite');
db.all("SELECT * FROM shifts WHERE date = '2026-03-02'", [], (err, rows) => {
    if (err) return console.error(err);
    console.log("LOCAL MAR 2 SHIFTS:", rows);
});
