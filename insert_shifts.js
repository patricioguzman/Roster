const mysql = require('mysql2/promise');

const dates = {
    'Thurs': '2026-03-05',
    'Fri': '2026-03-06',
    'Sat': '2026-03-07',
    'Sun': '2026-03-08',
    'Mon': '2026-03-09',
    'Tue': '2026-03-10',
    'Wed': '2026-03-11'
};

const shifts = [
    // LIZ (61, elizabeth escudero)
    { member_name: 'elizabeth escudero', member_id: 61, date: dates['Thurs'], start_time: '07:00', end_time: '15:00', duration: 8 },
    { member_name: 'elizabeth escudero', member_id: 61, date: dates['Fri'], start_time: '07:00', end_time: '15:00', duration: 8 },
    { member_name: 'elizabeth escudero', member_id: 61, date: dates['Sat'], start_time: '09:00', end_time: '13:00', duration: 4 },
    { member_name: 'elizabeth escudero', member_id: 61, date: dates['Mon'], start_time: '08:00', end_time: '16:00', duration: 8 },
    { member_name: 'elizabeth escudero', member_id: 61, date: dates['Tue'], start_time: '07:00', end_time: '15:00', duration: 8 },
    { member_name: 'elizabeth escudero', member_id: 61, date: dates['Wed'], start_time: '08:00', end_time: '16:00', duration: 8 },

    // JOANNA (70, Joanna Mendez)
    { member_name: 'Joanna Mendez', member_id: 70, date: dates['Thurs'], start_time: '09:00', end_time: '16:00', duration: 7 },
    { member_name: 'Joanna Mendez', member_id: 70, date: dates['Fri'], start_time: '09:00', end_time: '16:00', duration: 7 },
    { member_name: 'Joanna Mendez', member_id: 70, date: dates['Mon'], start_time: '09:00', end_time: '17:30', duration: 8.5 },
    { member_name: 'Joanna Mendez', member_id: 70, date: dates['Tue'], start_time: '09:00', end_time: '17:30', duration: 8.5 },
    { member_name: 'Joanna Mendez', member_id: 70, date: dates['Wed'], start_time: '09:00', end_time: '17:30', duration: 8.5 },

    // TERESA (62, Teresa Carman)
    { member_name: 'Teresa Carman', member_id: 62, date: dates['Mon'], start_time: '11:00', end_time: '17:30', duration: 6.5 },
    { member_name: 'Teresa Carman', member_id: 62, date: dates['Tue'], start_time: '11:00', end_time: '17:30', duration: 6.5 },
    { member_name: 'Teresa Carman', member_id: 62, date: dates['Wed'], start_time: '11:00', end_time: '17:30', duration: 6.5 },

    // ASHLEY (63, Ashlyn Prakash)
    { member_name: 'Ashlyn Prakash', member_id: 63, date: dates['Thurs'], start_time: '16:00', end_time: '21:00', duration: 5 },
    { member_name: 'Ashlyn Prakash', member_id: 63, date: dates['Fri'], start_time: '16:00', end_time: '21:00', duration: 5 },
    { member_name: 'Ashlyn Prakash', member_id: 63, date: dates['Sat'], start_time: '09:00', end_time: '17:00', duration: 8 },
    { member_name: 'Ashlyn Prakash', member_id: 63, date: dates['Sun'], start_time: '10:00', end_time: '17:00', duration: 7 },

    // PAT (68, Pat)
    { member_name: 'Pat', member_id: 68, date: dates['Thurs'], start_time: '07:00', end_time: '12:00', duration: 5 },
    { member_name: 'Pat', member_id: 68, date: dates['Sun'], start_time: '12:00', end_time: '17:00', duration: 5 },
    { member_name: 'Pat', member_id: 68, date: dates['Mon'], start_time: '08:00', end_time: '13:00', duration: 5 },
    { member_name: 'Pat', member_id: 68, date: dates['Tue'], start_time: '07:00', end_time: '12:00', duration: 5 },
    { member_name: 'Pat', member_id: 68, date: dates['Wed'], start_time: '08:00', end_time: '13:00', duration: 5 },

    // BRAD (67, Brad Harvey)
    { member_name: 'Brad Harvey', member_id: 67, date: dates['Fri'], start_time: '07:00', end_time: '12:00', duration: 5 },

    // STACEY (64, Stacey Mendoza)
    { member_name: 'Stacey Mendoza', member_id: 64, date: dates['Thurs'], start_time: '10:00', end_time: '15:00', duration: 5 },
    { member_name: 'Stacey Mendoza', member_id: 64, date: dates['Fri'], start_time: '10:00', end_time: '15:00', duration: 5 },

    // HARRY (71, Harry Grant)
    { member_name: 'Harry Grant', member_id: 71, date: dates['Thurs'], start_time: '16:00', end_time: '21:00', duration: 5 },
    { member_name: 'Harry Grant', member_id: 71, date: dates['Fri'], start_time: '16:00', end_time: '21:00', duration: 5 },
    { member_name: 'Harry Grant', member_id: 71, date: dates['Sat'], start_time: '11:00', end_time: '17:00', duration: 6 },
    { member_name: 'Harry Grant', member_id: 71, date: dates['Sun'], start_time: '12:00', end_time: '17:00', duration: 5 },

    // RICARDO (65, Ricardos Hanna)
    { member_name: 'Ricardos Hanna', member_id: 65, date: dates['Sat'], start_time: '13:00', end_time: '17:00', duration: 4 },
];

async function insertShifts() {
    let conn;
    try {
        console.log('Connecting to database...');
        conn = await mysql.createConnection({
            host: '178.32.171.58',
            user: 'roster',
            password: '8qlq0^Od6YsjbR?x',
            database: 'astromedia_roster',
            connectTimeout: 10000
        });

        console.log('Connected! Inserting shifts...');
        let inserted = 0;

        for (const shift of shifts) {
            const query = `
                INSERT INTO shifts (store_id, member_id, member_name, date, start_time, end_time, duration)
                VALUES (1, ?, ?, ?, ?, ?, ?)
            `;
            const params = [shift.member_id, shift.member_name, shift.date, shift.start_time, shift.end_time, shift.duration];

            await conn.query(query, params);
            inserted++;
            console.log(`Inserted shift ${inserted}/${shifts.length}: ${shift.member_name} on ${shift.date}`);

            // Adding a small delay to avoid overwhelming the server
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        console.log('All shifts inserted successfully.');
    } catch (err) {
        console.error('Error inserting shifts:', err);
    } finally {
        if (conn) {
            await conn.end();
            console.log('Connection closed.');
        }
    }
}

insertShifts();
