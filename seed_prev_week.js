const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'roster.sqlite');
const db = new sqlite3.Database(dbPath);

const storeId = 1; // Broadmeadows
const baseRate = 33.19;

const parseTime = (timeStr) => {
    if (!timeStr || timeStr === 'AW' || timeStr.includes('northland')) return null;
    let parts = timeStr.trim().split('.');
    let hours = parseInt(parts[0], 10);
    let minutes = parts[1] ? parseInt(parts[1], 10) : 0;

    // Auto-PM logic for early numbers
    if (hours >= 1 && hours <= 6) hours += 12;

    return { h: hours, m: minutes };
};

const calcDuration = (startStr, endStr) => {
    let start = parseTime(startStr);
    let end = parseTime(endStr);

    if (!start || !end) return null;

    let sh = start.h;
    let eh = end.h;

    // AM/PM heuristics fixing
    if (sh >= 12 && eh < 12) {
        eh += 12;
    }
    if (sh === 17 && eh === 9) eh = 21; // 5-9pm
    if (sh === 8 && eh === 5) eh = 17;
    if (sh === 9 && eh === 5) eh = 17;
    if (sh === 10 && eh === 5) eh = 17;
    if (sh === 11 && eh === 5) eh = 17;
    if (sh === 12 && eh === 5) eh = 17;
    if (sh === 12 && eh === 4) eh = 16;
    if (sh === 9 && eh === 4) eh = 16;
    if (sh === 9 && eh === 3) eh = 15;
    if (sh === 8 && eh === 4) eh = 16;
    if (sh === 10 && eh === 2) eh = 14;
    if (sh === 9 && eh === 2) eh = 14;
    if (sh === 8 && eh === 13) eh = 13; // 8-1 -> 8am-1pm

    if (sh === 7 && eh === 12) { sh = 7; eh = 12; }
    if (sh === 7 && eh === 11) { sh = 7; eh = 11; }
    if (sh === 8 && eh === 11) { sh = 8; eh = 11; }

    if (sh === 8 && eh === 1) eh = 13;

    if (eh <= sh) eh += 12;

    const dur = (eh + end.m / 60) - (sh + start.m / 60);

    return {
        startTime: `${String(sh).padStart(2, '0')}:${String(start.m).padStart(2, '0')}`,
        endTime: `${String(eh).padStart(2, '0')}:${String(end.m).padStart(2, '0')}`,
        duration: dur.toFixed(2)
    };
};

const rosterData = [
    { name: 'LIZ', shifts: { '2026-02-12': '9-5', '2026-02-13': '11-5.30', '2026-02-14': '9-5', '2026-02-16': '8-5.30', '2026-02-17': '11-5.30', '2026-02-18': '9-5.30' } },
    { name: 'JOANNA', shifts: { '2026-02-12': '9-5', '2026-02-13': '8-4', '2026-02-16': '8-5.30', '2026-02-17': '9-5.30', '2026-02-18': '9-5.30' } },
    { name: 'CHLOE', shifts: { '2026-02-12': '12-5', '2026-02-13': '8-5', '2026-02-17': '9-2' } },
    { name: 'TERESA', shifts: { '2026-02-14': '9-5', '2026-02-16': '9-5.30' } },
    { name: 'ASHLEY', shifts: { '2026-02-12': '5-9', '2026-02-13': '5-9', '2026-02-15': '10-5' } },
    { name: 'BRAD', shifts: { '2026-02-13': '8.30-1' } },
    { name: 'STACEY', shifts: { '2026-02-12': '10-2', '2026-02-13': '10-2' } },
    { name: 'PAT', shifts: { '2026-02-13': '5-9', '2026-02-14': '12-5', '2026-02-15': '12-5', '2026-02-16': '8-1' } },
    { name: 'JUAQUIN', shifts: { '2026-02-13': '8-1', '2026-02-16': '8-1' } },
    { name: 'RICARDO', shifts: { '2026-02-17': '1-5' } },
    { name: 'HARRY', shifts: { '2026-02-12': '5-9', '2026-02-15': '12-5' } }
];

db.serialize(() => {
    const insertMemberStmt = db.prepare('INSERT INTO members (store_id, name, phone, email, base_rate) VALUES (?, ?, ?, ?, ?)');
    const insertShiftStmt = db.prepare('INSERT INTO shifts (store_id, member_id, member_name, date, start_time, end_time, duration) VALUES (?, ?, ?, ?, ?, ?, ?)');

    // Since we already seeded the members, let's just insert the shifts if the member exists, 
    // or insert the member if they don't exist yet (JUAQUIN is new)
    db.all("SELECT id, name FROM members", [], (err, existingMembers) => {
        if (err) return console.error(err);

        rosterData.forEach(member => {
            let existing = existingMembers.find(m => m.name === member.name);
            if (!existing) {
                insertMemberStmt.run([storeId, member.name, '', '', baseRate], function (err) {
                    if (err) return console.error(err);
                    const memberId = this.lastID;
                    insertMemberShifts(member, memberId);
                });
            } else {
                insertMemberShifts(member, existing.id);
            }
        });

        function insertMemberShifts(member, memberId) {
            Object.entries(member.shifts).forEach(([date, timeStr]) => {
                // Remove extra padding from OCR like "9-5 8"
                let cleanTime = timeStr;
                if (cleanTime.includes(' ')) {
                    cleanTime = cleanTime.split(' ')[0];
                }
                const parts = cleanTime.split('-');
                if (parts.length === 2) {
                    const shiftDetails = calcDuration(parts[0], parts[1]);
                    if (shiftDetails) {
                        insertShiftStmt.run([storeId, memberId, member.name, date, shiftDetails.startTime, shiftDetails.endTime, shiftDetails.duration]);
                    }
                }
            });
        }
    });

});

console.log('Seed previous week completed.');
