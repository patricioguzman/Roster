const fs = require('fs');
let code = fs.readFileSync('backend/server.js', 'utf8');

const target = `
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

        const membersQuery = \`
            SELECT m.id, m.name, m.phone, m.email, m.base_rate, m.employment_type, m.role,
            GROUP_CONCAT(ms.store_id) as store_ids
            FROM members m
            LEFT JOIN member_stores ms ON m.id = ms.member_id
            GROUP BY m.id
        \`;
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

        if (user) {
            data.user = user;
            data.currentUserRole = user.role;
            if (user.role === 'manager') {
                const ms = await db.query('SELECT store_id FROM manager_stores WHERE member_id = ?', [user.id]);
                data.currentUserManagedStoreIds = ms.map(r => r.store_id);
            }
        }

        res.json(data);
`;

const replacement = `
        const data = { stores: [], members: [], shifts: [], settings: {}, currentStoreId: null };

        const membersQuery = \`
            SELECT m.id, m.name, m.phone, m.email, m.base_rate, m.employment_type, m.role,
            GROUP_CONCAT(ms.store_id) as store_ids
            FROM members m
            LEFT JOIN member_stores ms ON m.id = ms.member_id
            GROUP BY m.id
        \`;

        // ⚡ Bolt Performance Optimization:
        // 1. Parallelize all independent database queries using Promise.all
        // 2. Push store filtering directly into SQL WHERE IN clauses to prevent over-fetching
        const [
            settingsRows,
            storesRaw,
            members,
            mgrStores,
            shiftsRaw,
            currentUserManagedStoreIdsRaw
        ] = await Promise.all([
            db.query('SELECT * FROM settings'),
            (async () => {
                if (allowedStoreIds !== null && allowedStoreIds.length === 0) return [];
                if (allowedStoreIds === null) return await db.query('SELECT * FROM stores');
                const placeholders = allowedStoreIds.map(() => '?').join(',');
                return await db.query(\`SELECT * FROM stores WHERE id IN (\${placeholders})\`, allowedStoreIds);
            })(),
            db.query(membersQuery),
            (async () => { try { return await db.query('SELECT member_id, store_id FROM manager_stores'); } catch (e) { return []; } })(),
            (async () => {
                if (allowedStoreIds !== null && allowedStoreIds.length === 0) return [];
                if (allowedStoreIds === null) return await db.query('SELECT * FROM shifts');
                const placeholders = allowedStoreIds.map(() => '?').join(',');
                return await db.query(\`SELECT * FROM shifts WHERE store_id IN (\${placeholders})\`, allowedStoreIds);
            })(),
            (async () => {
                if (user && user.role === 'manager') {
                    return await db.query('SELECT store_id FROM manager_stores WHERE member_id = ?', [user.id]);
                }
                return [];
            })()
        ]);

        settingsRows.forEach(row => {
            const k = row.key_name || row.key;
            data.settings[k] = row.value;
        });

        data.stores = storesRaw.map(s => ({ id: s.id, name: s.name, maxHours: s.max_hours || 0 }));
        if (data.stores.length > 0) data.currentStoreId = data.stores[0].id;

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

        data.shifts = shiftsRaw.map(s => ({
            id: s.id, storeId: s.store_id, memberId: s.member_id, name: s.member_name,
            date: s.date, startTime: s.start_time, endTime: s.end_time, duration: s.duration
        }));

        if (user) {
            data.user = user;
            data.currentUserRole = user.role;
            if (user.role === 'manager') {
                data.currentUserManagedStoreIds = currentUserManagedStoreIdsRaw.map(r => r.store_id);
            }
        }

        res.json(data);
`;

if (!code.includes(target.trim().split('\n')[0])) {
    console.log("Could not find target string.");
} else {
    code = code.replace(target, replacement);
    fs.writeFileSync('backend/server.js', code);
    console.log("Success");
}
