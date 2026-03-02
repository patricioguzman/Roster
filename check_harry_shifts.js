const mysql = require('mysql2/promise');
const sqlite3 = require('sqlite3').verbose();
require('dotenv').config({ path: '.env.production' });

async function check() {
    const p = mysql.createPool({ host: '178.32.171.58', user: 'roster', password: process.env.DB_PASS, database: 'astromedia_roster' });
    const localDb = new sqlite3.Database('./roster.sqlite');
    const getSqliteData = (query) => new Promise((res, rej) => localDb.all(query, [], (err, rows) => err ? rej(err) : res(rows)));

    try {
        const localShifts = await getSqliteData("SELECT * FROM shifts WHERE member_name LIKE '%Harry%'");
        console.log("LOCAL HARRY SHIFTS:", localShifts.length, localShifts);
        const [remoteShifts] = await p.query("SELECT * FROM shifts WHERE member_name LIKE '%Harry%'");
        console.log("REMOTE HARRY SHIFTS:", remoteShifts.length, remoteShifts);
        const [remoteMembers] = await p.query("SELECT * FROM members WHERE name LIKE '%Harry%'");
        console.log("REMOTE HARRY MEMBERS:", remoteMembers);
        const localMembers = await getSqliteData("SELECT * FROM members WHERE name LIKE '%Harry%'");
        console.log("LOCAL HARRY MEMBERS:", localMembers);
    } catch (e) { console.error(e); }
    process.exit(0);
}
check();
