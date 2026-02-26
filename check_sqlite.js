const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('/Users/patguzman/Desktop/Roster/roster.sqlite');
db.serialize(() => {
    db.all("SELECT count(*) as c FROM stores", (err, rows) => console.log("Stores:", rows[0].c));
    db.all("SELECT count(*) as c FROM shifts", (err, rows) => console.log("Shifts:", rows[0].c));
    db.all("SELECT count(*) as c FROM members", (err, rows) => console.log("Members:", rows[0].c));
});
