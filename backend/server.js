const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');
const ExcelJS = require('exceljs');
require('dotenv').config();

const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'roster-secret-key-123';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Middleware to verify JWT
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// --- AUTH ---
app.post('/api/auth/login', async (req, res) => {
    let { username, password } = req.body;
    if (username) username = username.toLowerCase().trim();
    if (password) password = password.trim();

    try {
        const row = await db.get('SELECT * FROM admins WHERE LOWER(username) = ?', [username]);
        if (!row) return res.status(401).json({ error: 'Invalid credentials' });

        const match = await bcrypt.compare(password, row.password_hash);
        if (match) {
            let assignedStoreIds = [];
            let managedStoreIds = [];
            try { if (row.assigned_store_ids) assignedStoreIds = JSON.parse(row.assigned_store_ids); } catch(e){}
            try { if (row.managed_store_ids) managedStoreIds = JSON.parse(row.managed_store_ids); } catch(e){}

            // Apply special admin flag if enabled
            let role = row.role || 'admin';
            if (row.username === 'leon' || row.username === 'eli') role = 'admin'; // Leon always full admin, Eli is the default setup admin

            const userPayload = {
                username: row.username,
                id: row.id,
                role,
                assignedStoreIds,
                managedStoreIds
            };
            const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '24h' });
            res.json({ token, role, assignedStoreIds, managedStoreIds });
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Helper for data permission checks
function canAccessStore(user, storeId) {
    if (!user) return true; // Unauthenticated endpoints or legacy logic
    if (user.role === 'admin') return true;
    if (user.role === 'manager' && user.managedStoreIds && user.managedStoreIds.includes(storeId)) return true;
    if (user.role === 'employee' && user.assignedStoreIds && user.assignedStoreIds.includes(storeId)) return true;
    // Also let managers see assigned stores as employees
    if (user.role === 'manager' && user.assignedStoreIds && user.assignedStoreIds.includes(storeId)) return true;
    return false;
}

// --- GET ALL DATA ---
app.get('/api/data', authenticateToken, async (req, res) => {
    try {
        const user = req.user;
        const data = { stores: [], members: [], shifts: [], settings: {}, currentStoreId: null, role: user.role };

        const membersQuery = `
            SELECT m.*, GROUP_CONCAT(ms.store_id) as store_ids
            FROM members m
            LEFT JOIN member_stores ms ON m.id = ms.member_id
            GROUP BY m.id
        `;

        // ⚡ Bolt: Parallelize independent DB queries to reduce latency
        const [settingsRows, allStores, allMembers, allShifts] = await Promise.all([
            db.query('SELECT * FROM settings'),
            db.query('SELECT * FROM stores'),
            db.query(membersQuery),
            db.query('SELECT * FROM shifts')
        ]);

        const stores = allStores.filter(s => canAccessStore(user, s.id));

        settingsRows.forEach(row => {
            // Handle both sqlite "key" and mysql "key_name"
            const k = row.key_name || row.key;
            data.settings[k] = row.value;
        });

        data.stores = stores.map(s => ({ id: s.id, name: s.name, maxHours: s.max_hours || 0 }));
        if (stores.length > 0) data.currentStoreId = stores[0].id;

        const accessibleStoreIds = stores.map(s => s.id);

        data.members = allMembers.filter(m => {
            const mStoreIds = m.store_ids ? String(m.store_ids).split(',').map(id => parseInt(id)) : [];
            return mStoreIds.some(id => accessibleStoreIds.includes(id));
        }).map(m => ({
            id: m.id, name: m.name, phone: m.phone, email: m.email,
            storeIds: m.store_ids ? String(m.store_ids).split(',').map(id => parseInt(id)) : [],
            employmentType: m.employment_type || 'casual'
        }));

        data.shifts = allShifts.filter(s => accessibleStoreIds.includes(s.store_id)).map(s => ({
            id: s.id, storeId: s.store_id, memberId: s.member_id, name: s.member_name,
            date: s.date, startTime: s.start_time, endTime: s.end_time, duration: s.duration
        }));

        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- SETTINGS ---
app.put('/api/settings', authenticateToken, async (req, res) => {
    const settings = req.body;
    try {
        await db.transaction(async (tx) => {
            for (const [key, value] of Object.entries(settings)) {
                await tx.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
            }
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- STORES ---
app.post('/api/stores', authenticateToken, async (req, res) => {
    const { name, maxHours } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const hours = maxHours ? parseFloat(maxHours) : 0;
    try {
        const result = await db.run('INSERT INTO stores (name, max_hours) VALUES (?, ?)', [name, hours]);
        res.json({ id: result.insertId, name, maxHours: hours });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/stores/:id', authenticateToken, async (req, res) => {
    const { name, maxHours } = req.body;
    let hours = null;
    if (maxHours !== undefined && maxHours !== null && maxHours !== '') {
        hours = parseFloat(maxHours);
        if (isNaN(hours)) hours = 0;
    } else if (maxHours === '') {
        hours = 0;
    }
    let query = 'UPDATE stores SET ';
    const params = [];
    if (name !== undefined) { query += 'name = ?, '; params.push(name); }
    if (hours !== null) { query += 'max_hours = ?, '; params.push(hours); }
    if (params.length === 0) return res.status(400).json({ error: 'Nothing to update' });

    query = query.slice(0, -2) + ' WHERE id = ?';
    params.push(req.params.id);

    try {
        const result = await db.run(query, params);
        res.json({ success: true, updated: result.changes });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/stores/:id', authenticateToken, async (req, res) => {
    try {
        await db.transaction(async (tx) => {
            await tx.run('DELETE FROM stores WHERE id = ?', [req.params.id]);
            await tx.run('DELETE FROM member_stores WHERE store_id = ?', [req.params.id]);
            await tx.run('DELETE FROM shifts WHERE store_id = ?', [req.params.id]);
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- MEMBERS ---
app.post('/api/members', authenticateToken, async (req, res) => {
    const { storeIds, name, phone, email, employmentType } = req.body;
    const empType = employmentType || 'casual';
    try {
        let memberId;
        await db.transaction(async (tx) => {
            const result = await tx.run('INSERT INTO members (name, phone, email, employment_type) VALUES (?, ?, ?, ?)', [name, phone || '', email || '', empType]);
            memberId = result.insertId;
            if (storeIds && Array.isArray(storeIds)) {
                for (let storeId of storeIds) {
                    await tx.run('INSERT INTO member_stores (member_id, store_id) VALUES (?, ?)', [memberId, storeId]);
                }
            }
        });
        res.json({ id: memberId, storeIds: storeIds || [], name, phone, email, employmentType: empType });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/members/:id', authenticateToken, async (req, res) => {
    const { storeIds, name, phone, email, employmentType } = req.body;
    const memberId = req.params.id;
    try {
        await db.transaction(async (tx) => {
            let query = 'UPDATE members SET ';
            const params = [];
            if (name !== undefined) { query += 'name = ?, '; params.push(name); }
            if (phone !== undefined) { query += 'phone = ?, '; params.push(phone); }
            if (email !== undefined) { query += 'email = ?, '; params.push(email); }
            if (employmentType !== undefined) { query += 'employment_type = ?, '; params.push(employmentType); }
            if (params.length > 0) {
                query = query.slice(0, -2) + ' WHERE id = ?';
                params.push(memberId);
                await tx.run(query, params);
            }
            if (storeIds && Array.isArray(storeIds)) {
                await tx.run('DELETE FROM member_stores WHERE member_id = ?', [memberId]);
                for (let storeId of storeIds) {
                    await tx.run('INSERT INTO member_stores (member_id, store_id) VALUES (?, ?)', [memberId, storeId]);
                }
            }
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/members/:id', authenticateToken, async (req, res) => {
    try {
        const result = await db.run('DELETE FROM members WHERE id = ?', [req.params.id]);
        res.json({ success: true, deleted: result.changes });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- SHIFTS ---
app.post('/api/shifts/week', authenticateToken, async (req, res) => {
    const { saveShifts, deleteShifts } = req.body;
    try {
        await db.transaction(async (tx) => {
            if (deleteShifts && deleteShifts.length > 0) {
                const placeholders = deleteShifts.map(() => '?').join(',');
                await tx.run(`DELETE FROM shifts WHERE id IN (${placeholders})`, deleteShifts);
            }
            if (saveShifts && saveShifts.length > 0) {
                for (let s of saveShifts) {
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
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- WORKED HOURS & REPORTING ---

app.get('/api/worked-hours/:storeId/:startDate', authenticateToken, async (req, res) => {
    try {
        const { storeId, startDate } = req.params;
        const user = req.user;
        if (!canAccessStore(user, parseInt(storeId))) return res.status(403).json({ error: 'Access denied' });

        const rows = await db.query('SELECT * FROM worked_hours WHERE store_id = ? AND date = ?', [storeId, startDate]);

        // Also check if period is closed
        const d = new Date(startDate);
        const fortnightStart = new Date(d);
        fortnightStart.setDate(d.getDate() - (d.getDate() % 14)); // simple approximation, assuming they close specific fortnight dates. A real system would use a set fortnight epoch.
        // Actually, let's just query reporting periods covering this date
        const period = await db.get(`SELECT * FROM reporting_periods WHERE start_date <= ? AND end_date >= ?`, [startDate, startDate]);

        res.json({ hours: rows, period: period || null });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/worked-hours', authenticateToken, async (req, res) => {
    try {
        const { storeId, startDate, entries } = req.body;
        const user = req.user;
        if (!canAccessStore(user, parseInt(storeId))) return res.status(403).json({ error: 'Access denied' });

        // Check if period is closed
        const period = await db.get(`SELECT * FROM reporting_periods WHERE start_date <= ? AND end_date >= ?`, [startDate, startDate]);
        if (period && period.status === 'closed' && user.role !== 'admin') {
            return res.status(400).json({ error: 'Reporting period is closed' });
        }

        await db.transaction(async (tx) => {
            // Delete existing entries for this store and week
            await tx.run('DELETE FROM worked_hours WHERE store_id = ? AND date = ?', [storeId, startDate]);

            // Insert new entries
            if (entries && entries.length > 0) {
                for (let e of entries) {
                    await tx.run(
                        `INSERT INTO worked_hours (store_id, employee_id, date, ordinary_hours, saturday_hours, sunday_hours, ph_hours, al_hours, sl_hours, notes, uploaded_by_user_id, uploaded_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [storeId, e.employeeId, startDate, e.ordinary || 0, e.saturday || 0, e.sunday || 0, e.ph || 0, e.al || 0, e.sl || 0, e.notes || '', user.id, new Date().toISOString()]
                    );
                }
            }
        });

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/reports/close-fortnight', authenticateToken, async (req, res) => {
    try {
        const { startDate, endDate } = req.body;
        const user = req.user;
        if (user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });

        await db.run(
            `INSERT INTO reporting_periods (start_date, end_date, type, status, closed_at, closed_by) VALUES (?, ?, 'fortnightly', 'closed', ?, ?)`,
            [startDate, endDate, new Date().toISOString(), user.id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/reports/weekly/:storeId/:startDate', authenticateToken, async (req, res) => {
    try {
        const { storeId, startDate } = req.params;
        const user = req.user;
        if (!canAccessStore(user, parseInt(storeId))) return res.status(403).json({ error: 'Access denied' });

        const [store, members, hours] = await Promise.all([
            db.get('SELECT * FROM stores WHERE id = ?', [storeId]),
            db.query(`SELECT m.* FROM members m JOIN member_stores ms ON m.id = ms.member_id WHERE ms.store_id = ?`, [storeId]),
            db.query('SELECT * FROM worked_hours WHERE store_id = ? AND date = ?', [storeId, startDate])
        ]);

        if (!store) return res.status(404).json({ error: 'Store not found' });

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Weekly Report');

        sheet.columns = [
            { header: 'Employee', key: 'employee', width: 20 },
            { header: 'Ordinary', key: 'ord', width: 10 },
            { header: 'Saturday', key: 'sat', width: 10 },
            { header: 'Sunday', key: 'sun', width: 10 },
            { header: 'PH', key: 'ph', width: 10 },
            { header: 'AL', key: 'al', width: 10 },
            { header: 'SL', key: 'sl', width: 10 },
            { header: 'Total Hours', key: 'total', width: 15 }
        ];

        let storeTotals = { ord: 0, sat: 0, sun: 0, ph: 0, al: 0, sl: 0, total: 0 };

        members.forEach(m => {
            const h = hours.find(x => x.employee_id === m.id) || {};
            const ord = parseFloat(h.ordinary_hours) || 0;
            const sat = parseFloat(h.saturday_hours) || 0;
            const sun = parseFloat(h.sunday_hours) || 0;
            const ph = parseFloat(h.ph_hours) || 0;
            const al = parseFloat(h.al_hours) || 0;
            const sl = parseFloat(h.sl_hours) || 0;
            const total = ord + sat + sun + ph + al + sl;

            storeTotals.ord += ord; storeTotals.sat += sat; storeTotals.sun += sun;
            storeTotals.ph += ph; storeTotals.al += al; storeTotals.sl += sl; storeTotals.total += total;

            sheet.addRow({ employee: m.name, ord, sat, sun, ph, al, sl, total });
        });

        sheet.addRow({}); // Empty row
        sheet.addRow({
            employee: `Store Total (${store.name})`,
            ord: storeTotals.ord, sat: storeTotals.sat, sun: storeTotals.sun,
            ph: storeTotals.ph, al: storeTotals.al, sl: storeTotals.sl, total: storeTotals.total
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="Weekly_Report_${store.name}_${startDate}.xlsx"`);

        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/export/roster/:storeId/:startDate', authenticateToken, async (req, res) => {
    try {
        const { storeId, startDate } = req.params;
        const user = req.user;
        if (!canAccessStore(user, parseInt(storeId))) return res.status(403).json({ error: 'Access denied' });

        const [store, members, shifts] = await Promise.all([
            db.get('SELECT * FROM stores WHERE id = ?', [storeId]),
            db.query(`SELECT m.* FROM members m JOIN member_stores ms ON m.id = ms.member_id WHERE ms.store_id = ?`, [storeId]),
            db.query('SELECT * FROM shifts WHERE store_id = ?', [storeId])
        ]);

        if (!store) return res.status(404).json({ error: 'Store not found' });

        const sDate = new Date(startDate + 'T00:00:00');
        const endDate = new Date(sDate);
        endDate.setDate(endDate.getDate() + 6);
        const endStr = endDate.toISOString().split('T')[0];

        // Filter shifts by the week
        const weekShifts = shifts.filter(s => s.date >= startDate && s.date <= endStr);

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Roster');

        let headRow = ['Employee'];
        for (let i = 0; i < 7; i++) {
            const d = new Date(sDate); d.setDate(sDate.getDate() + i);
            headRow.push(d.toLocaleDateString('en-AU', { weekday: 'short', month: 'short', day: 'numeric' }));
        }
        sheet.addRow(headRow);

        members.forEach(m => {
            const row = [m.name];
            for (let i = 0; i < 7; i++) {
                const d = new Date(sDate); d.setDate(sDate.getDate() + i);
                const ds = d.toISOString().split('T')[0];
                const s = weekShifts.find(sh => sh.member_id === m.id && sh.date === ds);
                row.push(s ? `${s.start_time}-${s.end_time}` : '');
            }
            sheet.addRow(row);
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="Roster_${store.name}_${startDate}.xlsx"`);

        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/reports/fortnightly/:startDate', authenticateToken, async (req, res) => {
    try {
        const { startDate } = req.params;
        const user = req.user;
        if (user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });

        // A fortnight involves 2 consecutive weeks. We calculate second week start.
        const d = new Date(startDate);
        const secondWeekDate = new Date(d.setDate(d.getDate() + 7)).toISOString().split('T')[0];

        const [stores, members, allHours] = await Promise.all([
            db.query('SELECT * FROM stores'),
            db.query('SELECT * FROM members'),
            db.query('SELECT * FROM worked_hours WHERE date = ? OR date = ?', [startDate, secondWeekDate])
        ]);

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Fortnightly Report');

        sheet.columns = [
            { header: 'Employee / Store', key: 'name', width: 25 },
            { header: 'Ordinary', key: 'ord', width: 10 },
            { header: 'Saturday', key: 'sat', width: 10 },
            { header: 'Sunday', key: 'sun', width: 10 },
            { header: 'PH', key: 'ph', width: 10 },
            { header: 'AL', key: 'al', width: 10 },
            { header: 'SL', key: 'sl', width: 10 },
            { header: 'Total Hours', key: 'total', width: 15 }
        ];

        let globalTotals = { ord: 0, sat: 0, sun: 0, ph: 0, al: 0, sl: 0, total: 0 };

        // 1. Employee totals (across all their stores)
        members.forEach(m => {
            const hRows = allHours.filter(x => x.employee_id === m.id);
            if (hRows.length === 0) return; // Skip if no hours

            let empTotals = { ord: 0, sat: 0, sun: 0, ph: 0, al: 0, sl: 0, total: 0 };
            hRows.forEach(h => {
                empTotals.ord += parseFloat(h.ordinary_hours) || 0;
                empTotals.sat += parseFloat(h.saturday_hours) || 0;
                empTotals.sun += parseFloat(h.sunday_hours) || 0;
                empTotals.ph += parseFloat(h.ph_hours) || 0;
                empTotals.al += parseFloat(h.al_hours) || 0;
                empTotals.sl += parseFloat(h.sl_hours) || 0;
            });
            empTotals.total = empTotals.ord + empTotals.sat + empTotals.sun + empTotals.ph + empTotals.al + empTotals.sl;

            sheet.addRow({
                name: m.name,
                ord: empTotals.ord, sat: empTotals.sat, sun: empTotals.sun,
                ph: empTotals.ph, al: empTotals.al, sl: empTotals.sl, total: empTotals.total
            });
        });

        sheet.addRow({}); // spacer
        sheet.addRow(['STORE TOTALS']);

        // 2. Store totals
        stores.forEach(s => {
            const hRows = allHours.filter(x => x.store_id === s.id);
            if (hRows.length === 0) return;

            let stTotals = { ord: 0, sat: 0, sun: 0, ph: 0, al: 0, sl: 0, total: 0 };
            hRows.forEach(h => {
                stTotals.ord += parseFloat(h.ordinary_hours) || 0;
                stTotals.sat += parseFloat(h.saturday_hours) || 0;
                stTotals.sun += parseFloat(h.sunday_hours) || 0;
                stTotals.ph += parseFloat(h.ph_hours) || 0;
                stTotals.al += parseFloat(h.al_hours) || 0;
                stTotals.sl += parseFloat(h.sl_hours) || 0;
            });
            stTotals.total = stTotals.ord + stTotals.sat + stTotals.sun + stTotals.ph + stTotals.al + stTotals.sl;

            globalTotals.ord += stTotals.ord; globalTotals.sat += stTotals.sat; globalTotals.sun += stTotals.sun;
            globalTotals.ph += stTotals.ph; globalTotals.al += stTotals.al; globalTotals.sl += stTotals.sl; globalTotals.total += stTotals.total;

            sheet.addRow({
                name: s.name,
                ord: stTotals.ord, sat: stTotals.sat, sun: stTotals.sun,
                ph: stTotals.ph, al: stTotals.al, sl: stTotals.sl, total: stTotals.total
            });
        });

        sheet.addRow({});
        sheet.addRow({
            name: 'GRAND TOTAL',
            ord: globalTotals.ord, sat: globalTotals.sat, sun: globalTotals.sun,
            ph: globalTotals.ph, al: globalTotals.al, sl: globalTotals.sl, total: globalTotals.total
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="Fortnightly_Report_${startDate}.xlsx"`);

        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- PAYPAL MONETIZATION ---

// Public config for frontend
app.get('/api/config/public', (req, res) => {
    res.json({
        paypalBusinessEmail: process.env.PAYPAL_BUSINESS_EMAIL,
        supportCurrency: process.env.SUPPORT_CURRENCY || 'AUD',
        supportBrand: process.env.SUPPORT_BRAND || 'ByPat Roster Manager'
    });
});

// Create PayPal Subscription
app.post('/api/paypal/subscription/create', authenticateToken, async (req, res) => {
    try {
        const { planId } = req.body;
        if (!planId) return res.status(400).json({ error: 'planId is required' });

        const clientId = process.env.PAYPAL_CLIENT_ID;
        const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
        const isLive = process.env.PAYPAL_ENV !== 'sandbox';
        const baseUrl = isLive ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';

        // 1. Get OAuth Token
        const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
        const tokenReq = await fetch(`${baseUrl}/v1/oauth2/token`, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: 'grant_type=client_credentials'
        });
        const tokenData = await tokenReq.json();

        if (!tokenReq.ok) throw new Error(`PayPal Auth Error: ${tokenData.error_description || 'Failed to authenticate'}`);

        const accessToken = tokenData.access_token;

        // 2. Create Subscription
        const subReq = await fetch(`${baseUrl}/v1/billing/subscriptions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                plan_id: planId,
                application_context: {
                    brand_name: process.env.SUPPORT_BRAND || 'ByPat Roster Manager',
                    user_action: 'SUBSCRIBE_NOW',
                    return_url: 'https://roster.bypat.com.au/admin?paypal=success',
                    cancel_url: 'https://roster.bypat.com.au/admin?paypal=cancel'
                }
            })
        });
        const subData = await subReq.json();

        if (!subReq.ok) throw new Error(`PayPal Subscription Error: ${subData.message || 'Failed to create subscription'}`);

        const approveLink = subData.links.find(link => link.rel === 'approve');
        if (!approveLink) throw new Error('No approve link found in PayPal response');

        res.json({ approvalUrl: approveLink.href, subscriptionId: subData.id });
    } catch (err) {
        console.error('PayPal Subscription Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// PayPal Webhook Placeholder
app.post('/api/paypal/webhook', (req, res) => {
    // Placholder. Verify signature logic would go here if PAYPAL_WEBHOOK_ID is set
    console.log('Received PayPal Webhook:', req.body?.event_type);
    res.status(200).send('OK');
});

app.listen(PORT, () => { console.log(`Roster Server running on http://localhost:${PORT}`); });
