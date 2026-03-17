const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.production' });

const mysqlPool = mysql.createPool({
    host: '178.32.171.58',
    user: 'roster',
    password: process.env.DB_PASS,
    database: 'astromedia_roster',
    waitForConnections: true,
});

const scheduleData = {
    "location": "BROADY",
    "period": {
        "start": "2026-02-26",
        "end": "2026-03-04"
    },
    "staff": [
        { "name": "Liz", "schedule": { "2026-02-26": "9-5", "2026-02-27": "10-5", "2026-02-28": null, "2026-03-01": null, "2026-03-02": "8-5:30", "2026-03-03": "10-5:30", "2026-03-04": "12-5:30" } },
        { "name": "Johana", "schedule": { "2026-02-26": "9-4", "2026-02-27": null, "2026-02-28": null, "2026-03-01": null, "2026-03-02": "9-5:30", "2026-03-03": "9-5:30", "2026-03-04": "9-5:30" } },
        { "name": "Chloe", "schedule": { "2026-02-26": "11-5", "2026-02-27": null, "2026-02-28": null, "2026-03-01": null, "2026-03-02": null, "2026-03-03": null, "2026-03-04": null } },
        { "name": "Teresa", "schedule": { "2026-02-26": null, "2026-02-27": "9-5", "2026-02-28": "9-5", "2026-03-01": null, "2026-03-02": "11-5", "2026-03-03": null, "2026-03-04": "11-5" } },
        { "name": "Ashlyn", "schedule": { "2026-02-26": "5-9", "2026-02-27": "9-5", "2026-02-28": "9-5", "2026-03-01": "10-5", "2026-03-02": null, "2026-03-03": null, "2026-03-04": null } },
        { "name": "Pat", "schedule": { "2026-02-26": "7-11", "2026-02-27": "5-9", "2026-02-28": "12-5", "2026-03-01": "12-5", "2026-03-02": null, "2026-03-03": "7-12", "2026-03-04": null } },
        { "name": "Brad", "schedule": { "2026-02-26": null, "2026-02-27": "7-12", "2026-02-28": null, "2026-03-01": null, "2026-03-02": "8-2", "2026-03-03": null, "2026-03-04": "8-12" } },
        { "name": "Stacey", "schedule": { "2026-02-26": null, "2026-02-27": null, "2026-02-28": null, "2026-03-01": null, "2026-03-02": null, "2026-03-03": null, "2026-03-04": null } },
        { "name": "Harry", "schedule": { "2026-02-26": "5-9", "2026-02-27": "5-9", "2026-02-28": null, "2026-03-01": "12-5", "2026-03-02": null, "2026-03-03": null, "2026-03-04": null } },
        { "name": "Ricardo", "schedule": { "2026-02-26": null, "2026-02-27": null, "2026-02-28": null, "2026-03-01": null, "2026-03-02": null, "2026-03-03": "12-5", "2026-03-04": null } },
        { "name": "Syed", "schedule": { "2026-02-26": null, "2026-02-27": null, "2026-02-28": null, "2026-03-01": null, "2026-03-02": null, "2026-03-03": null, "2026-03-04": null } }
    ]
};

// Helper to convert "9-5", "8-5:30", "5-9" to 24-hr standard times
function parseTimeString(timeStr) {
    // 9 -> 09:00, 5 -> 17:00
    // 5-9 -> 17:00-21:00
    // 7-11 -> 07:00-11:00 
    // 12-5 -> 12:00-17:00
    // 8-2 -> 08:00-14:00
    const parts = timeStr.split('-');

    function convertPart(p, isEndPart) {
        if (!p) return null;
        let [hourStr, minStr] = p.split(':');
        let h = parseInt(hourStr);
        let m = minStr ? parseInt(minStr) : 0;

        // Retail logic:
        // if h is 1 to 6, it's definitely PM (13 to 18) unless it is a crazy night shift, but retail usually 5 means 17:00
        // "5-9" -> 5pm to 9pm (17:00-21:00). Wait, if start time is 5, is it 05:00 or 17:00?
        // Usually retail doesn't start at 5am. It's likely 17:00. Let's make 1-6 mean PM for sure.
        // Wait, "7-11" -> is it 7am or 7pm? Usually morning shift 07:00
        if (h >= 1 && h <= 6) {
            h += 12;
        } else if (h === 7 || h === 8 || h === 9 || h === 10 || h === 11) {
            // morning
        } else if (h === 12) {
            // noon
        }

        let hh = h < 10 ? '0' + h : h.toString();
        let mm = m < 10 ? '0' + m : m.toString();
        return `${hh}:${mm}`;
    }

    let start = convertPart(parts[0], false);
    let end = convertPart(parts[1], true);

    // Sometimes 5-9 means 17:00-21:00.
    // If start is 17:00, and end part was 9, it became 09:00, but end should be later than start.
    // Let's fix end time if it's less than start time in hours
    let sh = parseInt(start.split(':')[0]);
    let eh = parseInt(end.split(':')[0]);
    if (eh <= sh && eh <= 12) {
        eh += 12;
        let mm = end.split(':')[1];
        end = `${eh}:${mm}`;
    }

    // Calculate duration
    let startD = new Date(`1970-01-01T${start}:00`);
    let endD = new Date(`1970-01-01T${end}:00`);
    let duration = (endD - startD) / (1000 * 60 * 60);

    return { start, end, duration };
}

async function run() {
    try {
        console.log("Setting up Test Store & Uploading schedule...");

        // 1. Get or create store
        let [stores] = await mysqlPool.query("SELECT * FROM stores WHERE name = ?", [scheduleData.location]);
        let storeId;
        if (stores.length === 0) {
            const [storeRes] = await mysqlPool.execute("INSERT INTO stores (name, max_hours) VALUES (?, 100)", [scheduleData.location]);
            storeId = storeRes.insertId;
            console.log(`Created new store: ${scheduleData.location}`);
        } else {
            storeId = stores[0].id;
        }

        // 2. Process staff
        const [members] = await mysqlPool.query("SELECT * FROM members");

        for (let row of scheduleData.staff) {
            // find member loosely based on name
            let member = members.find(m => m.name.toLowerCase().includes(row.name.toLowerCase()) || row.name.toLowerCase().includes(m.name.toLowerCase()));
            let memberId;
            let memberName = row.name;

            if (!member) {
                // insert member
                const [memRes] = await mysqlPool.execute("INSERT INTO members (name, employment_type) VALUES (?, 'casual')", [row.name]);
                memberId = memRes.insertId;
                console.log(`Created new member: ${row.name}`);
            } else {
                memberId = member.id;
                memberName = member.name;
            }

            // assign to store
            await mysqlPool.execute("INSERT IGNORE INTO member_stores (member_id, store_id) VALUES (?, ?)", [memberId, storeId]);

            // create shifts
            for (const [date, timeStr] of Object.entries(row.schedule)) {
                if (timeStr) {
                    const { start, end, duration } = parseTimeString(timeStr);
                    // check if shift exists
                    const [existing] = await mysqlPool.query("SELECT * FROM shifts WHERE store_id=? AND member_id=? AND date=?", [storeId, memberId, date]);
                    if (existing.length === 0) {
                        await mysqlPool.execute(
                            "INSERT INTO shifts (store_id, member_id, member_name, date, start_time, end_time, duration) VALUES (?, ?, ?, ?, ?, ?, ?)",
                            [storeId, memberId, memberName, date, start, end, duration]
                        );
                        console.log(`Added shift for ${memberName} on ${date} (${start} - ${end}) => ${duration}h`);
                    } else {
                        await mysqlPool.execute(
                            "UPDATE shifts SET start_time=?, end_time=?, duration=? WHERE id=?",
                            [start, end, duration, existing[0].id]
                        );
                        console.log(`Updated shift for ${memberName} on ${date}`);
                    }
                }
            }
        }

    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}

run();
