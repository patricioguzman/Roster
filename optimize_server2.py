import re

with open('backend/server.js', 'r') as f:
    content = f.read()

search = """
            if (saveShifts && saveShifts.length > 0) {
                for (let s of saveShifts) {
                    if (allowedStoreIds && !allowedStoreIds.includes(s.storeId)) {
                        throw new Error("Forbidden: Attempting to edit shifts outside managed stores");
                    }
                    if (s.id && typeof s.id === 'string' && s.id.startsWith('new_')) {
                        const row = await tx.get('SELECT m.id FROM members m JOIN member_stores ms ON m.id = ms.member_id WHERE m.name = ? AND ms.store_id = ?', [s.name, s.storeId]);
                        if (row) {
                            await tx.run(`INSERT INTO shifts (store_id, member_id, member_name, date, start_time, end_time, duration) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                                [s.storeId, row.id, s.name, s.date, s.startTime, s.endTime, s.duration]);
                        }
                    } else if (s.id && typeof s.id === 'number') {
                        await tx.run(`UPDATE shifts SET start_time = ?, end_time = ?, duration = ? WHERE id = ?`,
                            [s.startTime, s.endTime, s.duration, s.id]);
                    } else {
                        const row = await tx.get('SELECT m.id FROM members m JOIN member_stores ms ON m.id = ms.member_id WHERE m.name = ? AND ms.store_id = ?', [s.name, s.storeId]);
                        if (row) {
                            await tx.run(`INSERT INTO shifts (store_id, member_id, member_name, date, start_time, end_time, duration) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                                [s.storeId, row.id, s.name, s.date, s.startTime, s.endTime, s.duration]);
                        }
                    }
                }
            }
"""

replace = """
            if (saveShifts && saveShifts.length > 0) {
                // ⚡ Bolt: Fetch member IDs using single batched query
                let insertShifts = [];
                for (let s of saveShifts) {
                    if (allowedStoreIds && !allowedStoreIds.includes(s.storeId)) {
                        throw new Error("Forbidden: Attempting to edit shifts outside managed stores");
                    }
                    if (s.id && typeof s.id === 'number') {
                        await tx.run(`UPDATE shifts SET start_time = ?, end_time = ?, duration = ? WHERE id = ?`,
                            [s.startTime, s.endTime, s.duration, s.id]);
                    } else {
                        insertShifts.push(s);
                    }
                }

                if (insertShifts.length > 0) {
                    // Create set to find unique names and stores
                    const uniqueCombos = [...new Set(insertShifts.map(s => JSON.stringify({ name: s.name, storeId: s.storeId })))].map(s => JSON.parse(s));

                    if (uniqueCombos.length > 0) {
                        // Construct IN clause dynamically
                        const conditions = uniqueCombos.map(c => `(m.name = ? AND ms.store_id = ?)`).join(' OR ');
                        const args = uniqueCombos.flatMap(c => [c.name, c.storeId]);

                        const rows = await tx.query(`SELECT m.id, m.name, ms.store_id FROM members m JOIN member_stores ms ON m.id = ms.member_id WHERE ${conditions}`, args);

                        let memberIdMap = new Map();
                        rows.forEach(r => memberIdMap.set(`${r.name}_${r.store_id}`, r.id));

                        let inserts = [];
                        let insertArgs = [];

                        for (let s of insertShifts) {
                            const memberId = memberIdMap.get(`${s.name}_${s.storeId}`);
                            if (memberId) {
                                inserts.push(`(?, ?, ?, ?, ?, ?, ?)`);
                                insertArgs.push(s.storeId, memberId, s.name, s.date, s.startTime, s.endTime, s.duration);
                            }
                        }

                        if (inserts.length > 0) {
                            await tx.run(`INSERT INTO shifts (store_id, member_id, member_name, date, start_time, end_time, duration) VALUES ${inserts.join(',')}`, insertArgs);
                        }
                    }
                }
            }
"""

if search in content:
    content = content.replace(search, replace)
    with open('backend/server.js', 'w') as f:
        f.write(content)
    print("Success")
else:
    print("Search string not found")
