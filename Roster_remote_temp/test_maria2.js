const mysql = require('mysql2/promise');
async function run() {
    const conn = await mysql.createConnection({ host: '178.32.171.58', user: 'roster', password: '8qlq0^Od6YsjbR?x', database: 'astromedia_roster' });
    const startDate = '2026-03-09', endDate = '2026-03-22';

    // Admin query
    const [hours] = await conn.query(`SELECT w.*, m.name as employee_name, s.name as store_name FROM worked_hours w JOIN members m ON w.member_id = m.id JOIN stores s ON w.store_id = s.id WHERE w.date >= ? AND w.date <= ?`, [startDate, endDate]);
    console.log("Worked hours:", hours.length);

    if (hours.length === 0) {
        let shiftQuery = `
            SELECT s.id, s.store_id, s.member_id, s.member_name as employee_name, s.date, s.duration, st.name as store_name
            FROM shifts s
            JOIN stores st ON s.store_id = st.id
            WHERE s.date >= ? AND s.date <= ?
        `;
        const [rawShifts] = await conn.query(shiftQuery, [startDate, endDate]);
        console.log("Raw shifts returned:", rawShifts.length);
        const agg = {};
        for (let rs of rawShifts) {
            const key = `${rs.store_id}_${rs.member_id}`;
            if (!agg[key]) {
                agg[key] = { store_id: rs.store_id, member_id: rs.member_id, employee_name: rs.employee_name, store_name: rs.store_name, ordinary_hours: 0, saturday_hours: 0, sunday_hours: 0, ph_hours: 0, al_hours: 0, sl_hours: 0 };
            }
            const d = new Date(rs.date + 'T00:00:00');
            const day = d.getDay();
            if (day === 0) agg[key].sunday_hours += parseFloat(rs.duration);
            else if (day === 6) agg[key].saturday_hours += parseFloat(rs.duration);
            else agg[key].ordinary_hours += parseFloat(rs.duration);
        }
        let hr = Object.values(agg);
        console.log("Final array size:", hr.length);
    }
    await conn.end();
}
run();
