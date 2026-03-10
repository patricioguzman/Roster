const db = require('./backend/db');

async function seedData() {
    console.log("Starting seed data generation...");

    // Insert Stores
    const stores = [
        "Airport West", "Broadmeadows", "Dandenong", "Northland", "Parkmore", "Southland", "Werribee"
    ];
    const storeIds = [];
    for (let s of stores) {
        let exists = await db.get("SELECT id FROM stores WHERE name = ?", [s]);
        if (!exists) {
            let res = await db.run("INSERT INTO stores (name, max_hours) VALUES (?, ?)", [s, 100]);
            storeIds.push({id: res.insertId, name: s});
        } else {
            storeIds.push({id: exists.id, name: s});
        }
    }

    // Insert Members
    const members = ["John Doe", "Jane Smith", "Bob Roberts", "Alice Johnson", "Charlie Brown", "Diana Prince"];
    const memberIds = [];
    for (let m of members) {
        let exists = await db.get("SELECT id FROM members WHERE name = ?", [m]);
        if (!exists) {
            let res = await db.run("INSERT INTO members (name, email) VALUES (?, ?)", [m, m.split(' ')[0].toLowerCase() + '@example.com']);
            memberIds.push({id: res.insertId, name: m});
        } else {
            memberIds.push({id: exists.id, name: m});
        }
    }

    // Link Members to Stores randomly
    for (let m of memberIds) {
        for (let s of storeIds) {
            if (Math.random() > 0.5) {
                try {
                    await db.run("INSERT INTO member_stores (member_id, store_id) VALUES (?, ?)", [m.id, s.id]);
                } catch (e) {} // ignore ignore dupes
            }
        }
    }

    // Clear and insert worked hours for last 14 days
    await db.run("DELETE FROM worked_hours");

    let count = 0;
    for (let s of storeIds) {
        for (let m of memberIds) {
            if (Math.random() > 0.3) {
                const ord = Math.floor(Math.random() * 20);
                const sat = Math.floor(Math.random() * 5);
                const sun = Math.floor(Math.random() * 5);
                const ph = Math.floor(Math.random() * 2);
                const al = 0;
                const sl = 0;
                
                await db.run(
                    "INSERT INTO worked_hours (store_id, member_id, date, ordinary_hours, saturday_hours, sunday_hours, ph_hours, al_hours, sl_hours) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    [s.id, m.id, '2026-03-01', ord, sat, sun, ph, al, sl]
                );
                count++;
            }
        }
    }

    console.log(`Inserted ${count} worked hours records.`);
    console.log("Done seeding.");
    process.exit(0);
}

seedData().catch(console.error);
