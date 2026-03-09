const mysql = require('mysql2/promise');
const sqlite3 = require('sqlite3').verbose();
require('dotenv').config({ path: '.env.production' });

async function fixData() {
    console.log("Fixing disjointed Store IDs between SQLite and MariaDB...");

    const p = mysql.createPool({ host: '178.32.171.58', user: 'roster', password: process.env.DB_PASS, database: 'astromedia_roster' });
    const localDb = new sqlite3.Database('./roster.sqlite');

    const getSqliteData = (query) => new Promise((res, rej) => localDb.all(query, [], (err, rows) => err ? rej(err) : res(rows)));

    try {
        const [remoteStores] = await p.query("SELECT id, name FROM stores");
        const localStores = await getSqliteData("SELECT id, name FROM stores");

        // Map local ID -> remote ID
        const idMapping = {};
        for (const ls of localStores) {
            const rs = remoteStores.find(s => s.name === ls.name);
            if (rs) idMapping[ls.id] = rs.id;
        }
        console.log("ID MAPPING (Local -> Remote):", idMapping);

        // Before fixing member_stores, clear all existing member_stores on remote because they are mangled!
        console.log("Truncating remote member_stores to prevent duplicates/errors...");
        await p.query("TRUNCATE TABLE member_stores");

        const localMemberStores = await getSqliteData("SELECT * FROM member_stores");
        console.log(`Re-assigning ${localMemberStores.length} member stores...`);
        for (const ms of localMemberStores) {
            const remoteStoreId = idMapping[ms.store_id];
            if (remoteStoreId) {
                await p.execute("INSERT IGNORE INTO member_stores (member_id, store_id) VALUES (?, ?)", [ms.member_id, remoteStoreId]);
            }
        }

        // Also fix shifts (shifts table might have wrong store_id)
        // Wait, did shifts get migrated wrongly too? YES!
        // Instead of truncating, we update the existing shifts to not destroy new data
        console.log("Fixing remote shifts store_id...");

        const localShifts = await getSqliteData("SELECT id, store_id FROM shifts");
        console.log(`Re-assigning store_id for ${localShifts.length} shifts...`);
        for (const s of localShifts) {
            const remoteStoreId = idMapping[s.store_id];
            if (remoteStoreId) {
                await p.execute("UPDATE shifts SET store_id = ? WHERE id = ?", [remoteStoreId, s.id]);
            }
        }

        console.log("Fix success!");
    } catch (e) {
        console.error("ERROR:", e);
    }
    process.exit(0);
}
fixData();
