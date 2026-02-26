const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'roster.sqlite');
const db = new sqlite3.Database(dbPath);

const storeId = 1; // Broadmeadows
const baseRate = 33.19;

const parseTime = (timeStr) => {
    // e.g. "9", "5", "5.30", "11.30", "8.30"
    if (timeStr === 'AW' || timeStr.includes('northland')) return null;
    let [hours, minutes] = timeStr.split('.');
    hours = parseInt(hours, 10);
    minutes = minutes ? parseInt(minutes, 10) : 0;

    // Auto-AM/PM logic specific to this roster
    // Store hours: usually 8am to 9pm.
    // If hour is 1, 2, 3, 4, 5, 6 it's PM (so add 12) UNLESS it's very early? No 1am shifts.
    // "12", "11", "10", "9", "8", "7" are AM, unless it's 7-11 (7am-11am or 7pm-11pm? usually 7am in this context, or maybe Pat's 5-9 is 5pm-9pm. "5-9" is 17:00-21:00).
    // Let's manually define:
    // 8, 9, 10, 11 -> AM
    // 12 -> PM (12:00)
    // 1, 2, 3, 4, 5, 9 (if end time) -> PM
    if (hours >= 1 && hours <= 6) hours += 12;
    // Wait, 5-9. 5 is PM. 9 is PM.
    if (hours === 7 && timeStr !== "7") {
        // "7-11" -> Pat is 7am-11am? Could be 7am - 11am or 7pm-11pm. Let's assume 7am.
    }
    // Wait, for end times, 9 can be PM. "5-9" -> 17:00 to 21:00.
    // Let's just return raw hours and minutes and we will determine AM/PM in the pair parser.
    return { h: hours, m: minutes };
};

const calcDuration = (startStr, endStr) => {
    let start = parseTime(startStr);
    let end = parseTime(endStr);

    if (!start || !end) return null;

    let sh = start.h;
    let eh = end.h;

    // Apply AM/PM heuristics
    if (sh >= 1 && sh <= 7) sh += 12; // 1pm-7pm
    if (eh >= 1 && eh <= 7) eh += 12; // 1pm-7pm

    if (sh === 8 || sh === 9 || sh === 10 || sh === 11) { } // AM
    if (sh === 12) { } // noon

    if (eh === 8 || eh === 9 || eh === 10 || eh === 11) {
        // if start is 5 (17:00), end is 9, then 9 is PM
        if (sh >= 12) eh += 12;
    }

    // Check specific edge cases
    if (sh === 17 && eh === 9) eh = 21; // 5-9
    if (sh === 8 && eh === 5) eh = 17; // 8-5:30 -> 17:30
    if (sh === 9 && eh === 5) eh = 17;
    if (sh === 10 && eh === 5) eh = 17;
    if (sh === 12 && eh === 5) eh = 17;
    if (sh === 12 && eh === 4) eh = 16;
    if (sh === 9 && eh === 4) eh = 16;
    if (sh === 9 && eh === 3) eh = 15;
    if (sh === 8 && eh === 4) eh = 16;
    if (sh === 10 && eh === 2) eh = 14;

    if (sh === 7 && eh === 12) { sh = 7; eh = 12; } // 7-12 -> 7am-noon
    if (sh === 7 && eh === 11) { sh = 7; eh = 11; } // 7-11 -> 7am-11am
    if (sh === 8 && eh === 11) { sh = 8; eh = 11; }

    if (sh === 8 && eh === 1) eh = 13; // 8:30-1 -> 13:00

    const dur = (eh + end.m / 60) - (sh + start.m / 60);

    return {
        startTime: `${String(sh).padStart(2, '0')}:${String(start.m).padStart(2, '0')}`,
        endTime: `${String(eh).padStart(2, '0')}:${String(end.m).padStart(2, '0')}`,
        duration: dur.toFixed(2)
    };
};

const rosterData = [
    { name: 'LIZ', shifts: { '2026-02-19': '9-5', '2026-02-20': '12-4', '2026-02-23': '8-5.30', '2026-02-24': '12-5.30', '2026-02-25': '8-5.30' } },
    { name: 'JOANNA', shifts: { '2026-02-19': '9-5', '2026-02-20': '8-4', '2026-02-23': '9-5.30', '2026-02-24': '9-5.30', '2026-02-25': '9-5.30' } },
    { name: 'CHLOE', shifts: { '2026-02-19': '9-3' } },
    { name: 'TERESA', shifts: { '2026-02-20': '9-5', '2026-02-21': '9-5', '2026-02-25': '12-5' } },
    { name: 'ASHLEY', shifts: { '2026-02-19': '5-9', '2026-02-20': '5-9', '2026-02-21': '9-5', '2026-02-22': '10-5' } },
    { name: 'PAT', shifts: { '2026-02-19': '5-9', '2026-02-22': '10-5', '2026-02-23': '8-11.30', '2026-02-24': '7-11', '2026-02-25': '8-11' } },
    { name: 'STACEY', shifts: { '2026-02-23': '10-2', '2026-02-24': '10-2' } },
    { name: 'BRAD', shifts: { '2026-02-20': '8.30-1' } },
    { name: 'HARRY', shifts: { '2026-02-20': '5-9', '2026-02-21': '12-5', '2026-02-22': '12-5' } },
    { name: 'RICARDO', shifts: { '2026-02-24': '12-4.30' } },
    { name: 'ELI', shifts: { '2026-02-20': '8-3' } }
];

db.serialize(() => {
    // Clear old data for a fresh start
    db.run("DELETE FROM shifts");
    db.run("DELETE FROM members");

    const insertMemberStmt = db.prepare('INSERT INTO members (store_id, name, phone, email, base_rate) VALUES (?, ?, ?, ?, ?)');
    const insertShiftStmt = db.prepare('INSERT INTO shifts (store_id, member_id, member_name, date, start_time, end_time, duration) VALUES (?, ?, ?, ?, ?, ?, ?)');

    rosterData.forEach(member => {
        insertMemberStmt.run([storeId, member.name, '', '', baseRate], function (err) {
            if (err) return console.error(err);
            const memberId = this.lastID;

            Object.entries(member.shifts).forEach(([date, timeStr]) => {
                const parts = timeStr.split('-');
                if (parts.length === 2) {
                    const shiftDetails = calcDuration(parts[0], parts[1]);
                    if (shiftDetails) {
                        insertShiftStmt.run([storeId, memberId, member.name, date, shiftDetails.startTime, shiftDetails.endTime, shiftDetails.duration]);
                    }
                }
            });
        });
    });

    // No finalize to prevent async race conditions
});

console.log('Seed completed.');
