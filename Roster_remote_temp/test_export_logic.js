require('dotenv').config({ path: '.env.production' }); 
const db = require('./backend/db');

async function run() {
    const startDate = '2026-03-09', endDate = '2026-03-22';
    let query = `
        SELECT w.*, m.name as employee_name, s.name as store_name 
        FROM worked_hours w 
        JOIN members m ON w.member_id = m.id 
        JOIN stores s ON w.store_id = s.id 
        WHERE w.date >= ? AND w.date <= ?
    `;
    let params = [startDate, endDate];
    let hours = await db.query(query, params);
    
    if (hours.length === 0) {
        console.log("Fallback to shifts");
        let shiftQuery = `
            SELECT s.id, s.store_id, s.member_id, s.member_name as employee_name, s.date, s.duration, st.name as store_name
            FROM shifts s
            JOIN stores st ON s.store_id = st.id
            WHERE s.date >= ? AND s.date <= ?
        `;
        let shiftParams = [startDate, endDate];
        const rawShifts = await db.query(shiftQuery, shiftParams);
        console.log("Raw shifts found:", rawShifts.length);
        const agg = {};
        for (let rs of rawShifts) {
            const key = `${rs.store_id}_${rs.member_id}`;
            if (!agg[key]) {
                agg[key] = {
                    store_id: rs.store_id,
                    member_id: rs.member_id,
                    employee_name: rs.employee_name,
                    store_name: rs.store_name,
                    ordinary_hours: 0,
                    saturday_hours: 0,
                    sunday_hours: 0,
                    ph_hours: 0,
                    al_hours: 0,
                    sl_hours: 0
                };
            }
            const d = new Date(rs.date + 'T00:00:00');
            const day = d.getDay();
            if (day === 0) agg[key].sunday_hours += parseFloat(rs.duration);
            else if (day === 6) agg[key].saturday_hours += parseFloat(rs.duration);
            else agg[key].ordinary_hours += parseFloat(rs.duration);
        }
        hours = Object.values(agg);
    }
    console.log("FINAL HOURS ARRAY LENGTH:", hours.length);
    console.log(hours[0]);
    process.exit(0);
}
run();
