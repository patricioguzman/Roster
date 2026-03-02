const mysql = require('mysql2/promise');
const sqlite3 = require('sqlite3').verbose();
require('dotenv').config({ path: '.env.production' });

async function fixMembers() {
    console.log("Migrating missing local members to remote DB...");

    const p = mysql.createPool({ host: '178.32.171.58', user: 'roster', password: process.env.DB_PASS, database: 'astromedia_roster' });
    const localDb = new sqlite3.Database('./roster.sqlite');
    const getSqliteData = (query) => new Promise((res, rej) => localDb.all(query, [], (err, rows) => err ? rej(err) : res(rows)));

    try {
        const localMembers = await getSqliteData("SELECT * FROM members");
        const [remoteMembers] = await p.query("SELECT * FROM members");

        // We also need the local -> remote store ID mapping for member_stores
        const localStores = await getSqliteData("SELECT * FROM stores");
        const [remoteStores] = await p.query("SELECT * FROM stores");
        const storeMapping = {};
        for (const ls of localStores) {
            const rs = remoteStores.find(s => s.name === ls.name);
            if (rs) storeMapping[ls.id] = rs.id;
        }

        const localMemberStores = await getSqliteData("SELECT * FROM member_stores");

        console.log(`Checking ${localMembers.length} local members against ${remoteMembers.length} remote members...`);

        for (const lm of localMembers) {
            let remoteMember = remoteMembers.find(rm => rm.name.toLowerCase() === lm.name.toLowerCase());

            if (!remoteMember) {
                console.log(`-> Missing remote member: ${lm.name}. Inserting...`);
                // Insert without prescribing ID so auto_increment can do its job
                const [result] = await p.execute("INSERT INTO members (name, phone, email, base_rate, employment_type) VALUES (?, ?, ?, ?, ?)",
                    [lm.name, lm.phone, lm.email, lm.base_rate, lm.employment_type]);

                remoteMember = { id: result.insertId, name: lm.name };
            }

            // Now, regardless of whether they were just inserted or existed, let's make sure their stores are assigned correctly
            const localStoresForMember = localMemberStores.filter(ms => ms.member_id === lm.id);
            for (const ms of localStoresForMember) {
                const remoteStoreId = storeMapping[ms.store_id];
                if (remoteStoreId) {
                    await p.execute("INSERT IGNORE INTO member_stores (member_id, store_id) VALUES (?, ?)", [remoteMember.id, remoteStoreId]);
                }
            }
        }

        console.log("Missing members and their stores assigned successfully.");

    } catch (e) { console.error("ERROR:", e); }
    process.exit(0);
}
fixMembers();
