import re

with open('backend/server.js', 'r') as f:
    content = f.read()

search = """
        const data = { stores: [], members: [], shifts: [], settings: {}, currentStoreId: null };

        const settingsRows = await db.query('SELECT * FROM settings');
        settingsRows.forEach(row => {
            const k = row.key_name || row.key;
            data.settings[k] = row.value;
        });

        let stores = await db.query('SELECT * FROM stores');
        if (allowedStoreIds !== null) {
            stores = stores.filter(s => allowedStoreIds.includes(s.id));
        }
        data.stores = stores.map(s => ({ id: s.id, name: s.name, maxHours: s.max_hours || 0 }));
        if (stores.length > 0) data.currentStoreId = stores[0].id;

        const membersQuery = `
            SELECT m.id, m.name, m.phone, m.email, m.base_rate, m.employment_type, m.role,
            GROUP_CONCAT(ms.store_id) as store_ids
            FROM members m
            LEFT JOIN member_stores ms ON m.id = ms.member_id
            GROUP BY m.id
        `;
        const members = await db.query(membersQuery);
        let mgrStores = [];
        try { mgrStores = await db.query('SELECT member_id, store_id FROM manager_stores'); } catch (e) { }

        data.members = members.map(m => {
            const memberStoreIds = m.store_ids ? String(m.store_ids).split(',').map(id => parseInt(id)) : [];
            const managedStoreIds = mgrStores.filter(row => row.member_id === m.id).map(row => row.store_id);
            return {
                id: m.id, name: m.name, phone: m.phone, email: m.email,
                storeIds: memberStoreIds,
                managedStoreIds: managedStoreIds,
                employmentType: m.employment_type || 'casual',
                role: m.role || 'employee'
            };
        });

        let shifts = await db.query('SELECT * FROM shifts');
        if (allowedStoreIds !== null) {
            shifts = shifts.filter(s => allowedStoreIds.includes(s.store_id));
        }
        data.shifts = shifts.map(s => ({
            id: s.id, storeId: s.store_id, memberId: s.member_id, name: s.member_name,
            date: s.date, startTime: s.start_time, endTime: s.end_time, duration: s.duration
        }));
"""

replace = """
        const data = { stores: [], members: [], shifts: [], settings: {}, currentStoreId: null };

        const membersQuery = `
            SELECT m.id, m.name, m.phone, m.email, m.base_rate, m.employment_type, m.role,
            GROUP_CONCAT(ms.store_id) as store_ids
            FROM members m
            LEFT JOIN member_stores ms ON m.id = ms.member_id
            GROUP BY m.id
        `;

        // ⚡ Bolt: Parallelize independent database queries to reduce network latency
        const [settingsRows, rawStores, members, rawShifts, mgrStores] = await Promise.all([
            db.query('SELECT * FROM settings'),
            db.query('SELECT * FROM stores'),
            db.query(membersQuery),
            db.query('SELECT * FROM shifts'),
            db.query('SELECT member_id, store_id FROM manager_stores').catch(() => [])
        ]);

        settingsRows.forEach(row => {
            const k = row.key_name || row.key;
            data.settings[k] = row.value;
        });

        let stores = rawStores;
        if (allowedStoreIds !== null) {
            stores = stores.filter(s => allowedStoreIds.includes(s.id));
        }
        data.stores = stores.map(s => ({ id: s.id, name: s.name, maxHours: s.max_hours || 0 }));
        if (stores.length > 0) data.currentStoreId = stores[0].id;

        data.members = members.map(m => {
            const memberStoreIds = m.store_ids ? String(m.store_ids).split(',').map(id => parseInt(id)) : [];
            const managedStoreIds = mgrStores.filter(row => row.member_id === m.id).map(row => row.store_id);
            return {
                id: m.id, name: m.name, phone: m.phone, email: m.email,
                storeIds: memberStoreIds,
                managedStoreIds: managedStoreIds,
                employmentType: m.employment_type || 'casual',
                role: m.role || 'employee'
            };
        });

        let shifts = rawShifts;
        if (allowedStoreIds !== null) {
            shifts = shifts.filter(s => allowedStoreIds.includes(s.store_id));
        }
        data.shifts = shifts.map(s => ({
            id: s.id, storeId: s.store_id, memberId: s.member_id, name: s.member_name,
            date: s.date, startTime: s.start_time, endTime: s.end_time, duration: s.duration
        }));
"""

if search in content:
    content = content.replace(search, replace)
    with open('backend/server.js', 'w') as f:
        f.write(content)
    print("Success")
else:
    print("Search string not found")
