const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./roster.sqlite');
db.all("SELECT m.name FROM members m JOIN member_stores ms ON m.id = ms.member_id JOIN stores s ON s.id = ms.store_id WHERE s.name = 'BROADY'", [], (err, rows) => {
    if (err) return console.error(err);
    console.log("LOCAL BROADY MEMBERS:", rows.length);
    console.log("NAMES:", rows.map(r => r.name).join(', '));
});
db.all("SELECT COUNT(*) as c FROM members", [], (err, rows) => {
    if (err) return;
    console.log("LOCAL TOTAL MEMBERS:", rows[0].c);
});
