const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');
const xlsx = require('xlsx');
const ExcelJS = require('exceljs');
require('dotenv').config();

const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'roster-secret-key-123';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Middleware to verify Admin
const requireAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden. Admin access required.' });
    }
    next();
};

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
        // 1. Try members table first
        const member = await db.get('SELECT * FROM members WHERE LOWER(email) = ? OR LOWER(name) = ?', [username, username]);
        if (member && member.password_hash) {
            const match = await bcrypt.compare(password, member.password_hash);
            if (match) {
                const token = jwt.sign({ username: member.email || member.name, id: member.id, role: member.role || 'employee' }, JWT_SECRET, { expiresIn: '24h' });
                return res.json({ token, role: member.role || 'employee' });
            }
        }

        // 2. Fallback to admins table
        const row = await db.get('SELECT * FROM admins WHERE LOWER(username) = ?', [username]);
        if (row) {
            const matchAdmin = await bcrypt.compare(password, row.password_hash);
            if (matchAdmin) {
                const token = jwt.sign({ username: row.username, id: row.id, role: 'admin' }, JWT_SECRET, { expiresIn: '24h' });
                return res.json({ token, role: 'admin' });
            }
        }
        res.status(401).json({ error: 'Invalid credentials' });
    } catch (err) {
        console.error("Login error", err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- GET ALL DATA ---
app.get('/api/data', async (req, res) => {
    try {
        let user = null;
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        if (token) {
            try { user = jwt.verify(token, JWT_SECRET); } catch (e) { }
        }

        let allowedStoreIds = null; // null means all stores (public or admin)
        if (user && user.role === 'employee') {
            const ms = await db.query('SELECT store_id FROM member_stores WHERE member_id = ?', [user.id]);
            allowedStoreIds = ms.map(r => r.store_id);
        } else if (user && user.role === 'manager') {
            const ms1 = await db.query('SELECT store_id FROM member_stores WHERE member_id = ?', [user.id]);
            const ms2 = await db.query('SELECT store_id FROM manager_stores WHERE member_id = ?', [user.id]);
            allowedStoreIds = [...new Set([...ms1.map(r => r.store_id), ...ms2.map(r => r.store_id)])];
        }

        const data = { stores: [], members: [], shifts: [], settings: {}, currentStoreId: null };

        const membersQuery = `
            SELECT m.id, m.name, m.phone, m.email, m.base_rate, m.employment_type, m.role,
            GROUP_CONCAT(ms.store_id) as store_ids 
            FROM members m
            LEFT JOIN member_stores ms ON m.id = ms.member_id
            GROUP BY m.id
        `;
        let storesQuery = 'SELECT * FROM stores';
        let shiftsQuery = 'SELECT * FROM shifts';
        let queryArgs = [];

        if (allowedStoreIds !== null) {
            if (allowedStoreIds.length === 0) {
                storesQuery += ' WHERE 1=0';
                shiftsQuery += ' WHERE 1=0';
            } else {
                const placeholders = allowedStoreIds.map(() => '?').join(',');
                storesQuery += ` WHERE id IN (${placeholders})`;
                shiftsQuery += ` WHERE store_id IN (${placeholders})`;
                queryArgs = allowedStoreIds;
            }
        }

        // ⚡ Bolt Optimization: Parallelize independent DB queries and push filters into SQL
        const [settingsRows, stores, members, shifts] = await Promise.all([
            db.query('SELECT * FROM settings'),
            db.query(storesQuery, queryArgs),
            db.query(membersQuery),
            db.query(shiftsQuery, queryArgs)
        ]);

        let mgrStores = [];
        try { mgrStores = await db.query('SELECT member_id, store_id FROM manager_stores'); } catch (e) { }

        settingsRows.forEach(row => {
            const k = row.key_name || row.key;
            data.settings[k] = row.value;
        });

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
    } catch (err) {
        console.error("Data fetch error", err);
        res.status(500).json({ error: err.message });
    }
});

// --- SETTINGS ---
app.put('/api/settings', authenticateToken, requireAdmin, async (req, res) => {
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
app.post('/api/stores', authenticateToken, requireAdmin, async (req, res) => {
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

app.put('/api/stores/:id', authenticateToken, requireAdmin, async (req, res) => {
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

app.delete('/api/stores/:id', authenticateToken, requireAdmin, async (req, res) => {
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
    if (req.user.role !== 'admin' && req.user.role !== 'manager') return res.status(403).json({ error: 'Requires admin or manager privileges' });
    const { storeIds, name, phone, email, employmentType } = req.body;

    try {
        if (req.user.role === 'manager') {
            const allowedStores = await getManagerStores(req.user);
            if (storeIds && storeIds.some(id => !allowedStores.includes(parseInt(id)))) {
                return res.status(403).json({ error: 'You can only assign members to stores you manage' });
            }
        }

        const empType = employmentType || 'casual';
        const newRole = empType === 'manager' ? 'manager' : 'employee';
        const defaultHash = await bcrypt.hash('password', 10);
        let memberId;

        await db.transaction(async (tx) => {
            const result = await tx.run('INSERT INTO members (name, phone, email, employment_type, role, password_hash) VALUES (?, ?, ?, ?, ?, ?)', [name, phone || '', email || '', empType, newRole, defaultHash]);
            memberId = result.insertId;
            if (storeIds && Array.isArray(storeIds)) {
                for (let storeId of storeIds) {
                    await tx.run('INSERT INTO member_stores (member_id, store_id) VALUES (?, ?)', [memberId, storeId]);
                    if (newRole === 'manager') {
                        await tx.run('INSERT INTO manager_stores (member_id, store_id) VALUES (?, ?)', [memberId, storeId]);
                    }
                }
            }
        });
        res.json({ id: memberId, storeIds: storeIds || [], name, phone, email, employmentType: empType, role: newRole });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/members/:id', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin' && req.user.role !== 'manager') return res.status(403).json({ error: 'Requires admin or manager privileges' });
    const { storeIds, name, phone, email, employmentType } = req.body;
    const memberId = req.params.id;

    try {
        let finalStoreIds = storeIds || [];
        let allowedStores = [];
        if (req.user.role === 'manager') {
            allowedStores = await getManagerStores(req.user);
            const currentStoresReq = await db.query('SELECT store_id FROM member_stores WHERE member_id = ?', [memberId]);
            const currentStores = currentStoresReq.map(s => s.store_id);

            const isManagedMember = currentStores.some(id => allowedStores.includes(id)) || currentStores.length === 0;
            if (!isManagedMember && currentStores.length > 0) {
                return res.status(403).json({ error: 'You do not have permission to edit this member' });
            }

            if (storeIds) {
                if (storeIds.some(id => !allowedStores.includes(parseInt(id)))) {
                    return res.status(403).json({ error: 'You can only assign members to stores you manage' });
                }
                const unmanagedStores = currentStores.filter(id => !allowedStores.includes(id));
                finalStoreIds = [...new Set([...unmanagedStores, ...storeIds.map(id => parseInt(id))])];
            }
        }

        const currentMember = await db.get('SELECT * FROM members WHERE id = ?', [memberId]);
        const finalEmpType = employmentType !== undefined ? employmentType : currentMember.employment_type;
        const finalRole = finalEmpType === 'manager' ? 'manager' : 'employee';

        await db.transaction(async (tx) => {
            let query = 'UPDATE members SET ';
            const params = [];
            if (name !== undefined) { query += 'name = ?, '; params.push(name); }
            if (phone !== undefined) { query += 'phone = ?, '; params.push(phone); }
            if (email !== undefined) { query += 'email = ?, '; params.push(email); }
            if (employmentType !== undefined) {
                query += 'employment_type = ?, role = ?, ';
                params.push(employmentType, finalRole);
            }
            if (params.length > 0) {
                query = query.slice(0, -2) + ' WHERE id = ?';
                params.push(memberId);
                await tx.run(query, params);
            }
            if (!currentMember.password_hash) {
                const defaultHash = await bcrypt.hash('password', 10);
                await tx.run('UPDATE members SET password_hash = ? WHERE id = ?', [defaultHash, memberId]);
            }

            const currentStrs = await tx.query('SELECT store_id FROM member_stores WHERE member_id = ?', [memberId]);
            const storesToProcess = storeIds ? finalStoreIds : currentStrs.map(s => s.store_id);

            if (storeIds) {
                await tx.run('DELETE FROM member_stores WHERE member_id = ?', [memberId]);
                for (let storeId of finalStoreIds) {
                    await tx.run('INSERT INTO member_stores (member_id, store_id) VALUES (?, ?)', [memberId, storeId]);
                }
            }

            // Sync manager_stores
            if (req.user.role === 'admin' || (req.user.role === 'manager' && !storeIds)) {
                await tx.run('DELETE FROM manager_stores WHERE member_id = ?', [memberId]);
            } else if (req.user.role === 'manager' && storeIds) {
                for (let storeId of allowedStores) {
                    await tx.run('DELETE FROM manager_stores WHERE member_id = ? AND store_id = ?', [memberId, storeId]);
                }
            }

            if (finalRole === 'manager') {
                for (let storeId of storesToProcess) {
                    await tx.run('INSERT OR IGNORE INTO manager_stores (member_id, store_id) VALUES (?, ?)', [memberId, storeId]);
                }
            }
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/members/:id', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin' && req.user.role !== 'manager') return res.status(403).json({ error: 'Requires admin or manager privileges' });
    try {
        if (req.user.role === 'manager') {
            const allowedStores = await getManagerStores(req.user);
            const currentStoresReq = await db.query('SELECT store_id FROM member_stores WHERE member_id = ?', [req.params.id]);
            const currentStores = currentStoresReq.map(s => s.store_id);

            const canDelete = currentStores.length > 0 && currentStores.every(id => allowedStores.includes(id));
            if (!canDelete) {
                return res.status(403).json({ error: 'You cannot delete this member as they are assigned to stores you do not manage. Try removing them from your store via edit instead.' });
            }
        }

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
        if (!req.user || req.user.role === 'employee') {
            return res.status(403).json({ error: 'Manager access required' });
        }
        let allowedStoreIds = null;
        if (req.user.role === 'manager') {
            const ms = await db.query('SELECT store_id FROM manager_stores WHERE member_id = ?', [req.user.id]);
            allowedStoreIds = ms.map(r => r.store_id);
        }

        await db.transaction(async (tx) => {
            if (deleteShifts && deleteShifts.length > 0) {
                if (allowedStoreIds) {
                    const placeholders = deleteShifts.map(() => '?').join(',');
                    const existing = await tx.query(`SELECT store_id FROM shifts WHERE id IN (${placeholders})`, deleteShifts);
                    const invalid = existing.some(row => !allowedStoreIds.includes(row.store_id));
                    if (invalid) throw new Error("Forbidden: Attempting to edit shifts outside managed stores");
                }
                const placeholders = deleteShifts.map(() => '?').join(',');
                await tx.run(`DELETE FROM shifts WHERE id IN (${placeholders})`, deleteShifts);
            }
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
        });
        res.json({ success: true });
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

// --- WORKED HOURS & REPORTS ---

// Helper to check manager access to a store
async function checkManagerStoreAccess(user, storeId) {
    if (user.role === 'admin') return true;
    if (user.role !== 'manager') return false;
    const ms = await db.query('SELECT store_id FROM manager_stores WHERE member_id = ? AND store_id = ?', [user.id, storeId]);
    return ms.length > 0;
}

// Check manager access to an array of stores
async function getManagerStores(user) {
    if (user.role === 'admin') {
        const stores = await db.query('SELECT id FROM stores');
        return stores.map(s => s.id);
    }
    if (user.role === 'manager') {
        const ms = await db.query('SELECT store_id FROM manager_stores WHERE member_id = ?', [user.id]);
        return ms.map(r => r.store_id);
    }
    return [];
}

// GET Worked Hours
app.get('/api/worked-hours', authenticateToken, async (req, res) => {
    const { startDate, endDate, storeId } = req.query;
    if (!startDate || !endDate) return res.status(400).json({ error: 'Start and End dates are required' });

    try {
        const allowedStores = await getManagerStores(req.user);
        if (allowedStores.length === 0) return res.status(403).json({ error: 'Manager access required' });

        let query = 'SELECT * FROM worked_hours WHERE date >= ? AND date <= ?';
        let params = [startDate, endDate];

        if (storeId) {
            if (!allowedStores.includes(parseInt(storeId))) return res.status(403).json({ error: 'Forbidden store' });
            query += ' AND store_id = ?';
            params.push(storeId);
        } else {
            const placeholders = allowedStores.map(() => '?').join(',');
            query += ` AND store_id IN (${placeholders})`;
            params.push(...allowedStores);
        }

        const hours = await db.query(query, params);
        res.json(hours);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST Worked Hours (weekly upload)
app.post('/api/worked-hours', authenticateToken, async (req, res) => {
    const { storeId, date, hoursData } = req.body; // hoursData: array of { memberId, ordinary, sat, sun, ph, al, sl, notes }
    if (!storeId || !date || !hoursData) return res.status(400).json({ error: 'Missing parameters' });

    try {
        const hasAccess = await checkManagerStoreAccess(req.user, parseInt(storeId));
        if (!hasAccess) return res.status(403).json({ error: 'Forbidden: You do not manage this store' });

        // Check if period is closed
        const closed = await db.get('SELECT * FROM reporting_periods WHERE ? >= start_date AND ? <= end_date AND status = "closed"', [date, date]);
        if (closed && req.user.role !== 'admin') {
            return res.status(400).json({ error: 'This reporting period is closed and cannot be modified.' });
        }

        await db.transaction(async (tx) => {
            // Delete existing hours for this store/date to replace them
            await tx.run('DELETE FROM worked_hours WHERE store_id = ? AND date = ?', [storeId, date]);

            for (let h of hoursData) {
                // Only insert if there's actual data
                if (h.ordinary || h.sat || h.sun || h.ph || h.al || h.sl || h.notes) {
                    await tx.run(
                        `INSERT INTO worked_hours (store_id, member_id, date, ordinary_hours, saturday_hours, sunday_hours, ph_hours, al_hours, sl_hours, notes, uploaded_by, uploaded_at) 
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [storeId, h.memberId, date, h.ordinary || 0, h.sat || 0, h.sun || 0, h.ph || 0, h.al || 0, h.sl || 0, h.notes || '', req.user.id, new Date().toISOString()]
                    );
                }
            }
        });

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// CLOSE PERIOD
app.post('/api/reports/close-period', authenticateToken, requireAdmin, async (req, res) => {
    const { startDate, endDate, type } = req.body;
    try {
        await db.run(
            'INSERT INTO reporting_periods (start_date, end_date, type, status, closed_at, closed_by) VALUES (?, ?, ?, ?, ?, ?)',
            [startDate, endDate, type || 'fortnightly', 'closed', new Date().toISOString(), req.user.id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET EXPORT WEEKLY REPORT (per store or all stores)
app.get('/api/exports/weekly-report', authenticateToken, async (req, res) => {
    const { storeId, startDate, endDate } = req.query;
    try {
        if (storeId !== 'all') {
            const hasAccess = await checkManagerStoreAccess(req.user, parseInt(storeId));
            if (!hasAccess) return res.status(403).json({ error: 'Forbidden' });
        } else if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Only admins can export all stores' });
        }

        let query = `
            SELECT w.*, m.name as employee_name, s.name as store_name 
            FROM worked_hours w 
            JOIN members m ON w.member_id = m.id 
            JOIN stores s ON w.store_id = s.id 
            WHERE w.date >= ? AND w.date <= ?
        `;
        let params = [startDate, endDate];

        if (storeId !== 'all') {
            query += ` AND w.store_id = ?`;
            params.push(storeId);
        }

        const hours = await db.query(query, params);

        // Aggregate by employee
        const employeeTotals = {};
        const storeTotal = { ordinary: 0, sat: 0, sun: 0, ph: 0, al: 0, sl: 0, total: 0 };

        for (let h of hours) {
            if (!employeeTotals[h.member_id]) {
                employeeTotals[h.member_id] = { Employee: h.employee_name, Ordinary: 0, Saturday: 0, Sunday: 0, PH: 0, AL: 0, SL: 0, Total: 0 };
            }
            const emp = employeeTotals[h.member_id];
            emp.Ordinary += h.ordinary_hours || 0;
            emp.Saturday += h.saturday_hours || 0;
            emp.Sunday += h.sunday_hours || 0;
            emp.PH += h.ph_hours || 0;
            emp.AL += h.al_hours || 0;
            emp.SL += h.sl_hours || 0;
            emp.Total += (h.ordinary_hours || 0) + (h.saturday_hours || 0) + (h.sunday_hours || 0) + (h.ph_hours || 0) + (h.al_hours || 0) + (h.sl_hours || 0);

            storeTotal.ordinary += h.ordinary_hours || 0;
            storeTotal.sat += h.saturday_hours || 0;
            storeTotal.sun += h.sunday_hours || 0;
            storeTotal.ph += h.ph_hours || 0;
            storeTotal.al += h.al_hours || 0;
            storeTotal.sl += h.sl_hours || 0;
            storeTotal.total += (h.ordinary_hours || 0) + (h.saturday_hours || 0) + (h.sunday_hours || 0) + (h.ph_hours || 0) + (h.al_hours || 0) + (h.sl_hours || 0);
        }

        // Prepare Excel
        const wb = xlsx.utils.book_new();

        // Sheet 1: Employees
        const wsEmployees = xlsx.utils.json_to_sheet(Object.values(employeeTotals));
        xlsx.utils.book_append_sheet(wb, wsEmployees, 'Employee Hours');

        // Sheet 2: Store Summary
        const storeName = storeId === 'all' ? 'All_Stores' : (hours.length > 0 ? hours[0].store_name : 'Store');
        const summaryData = [{
            Store: storeName,
            Ordinary: storeTotal.ordinary,
            Saturday: storeTotal.sat,
            Sunday: storeTotal.sun,
            PH: storeTotal.ph,
            AL: storeTotal.al,
            SL: storeTotal.sl,
            'Total Hours': storeTotal.total
        }];
        const wsStore = xlsx.utils.json_to_sheet(summaryData);
        xlsx.utils.book_append_sheet(wb, wsStore, 'Store Summary');

        // Send file
        const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Disposition', `attachment; filename="Weekly_${storeName}_${startDate}.xlsx"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET EXPORT FORTNIGHTLY REPORT (Consolidated)
app.get('/api/exports/fortnightly-report', authenticateToken, requireAdmin, async (req, res) => {
    const { startDate, endDate } = req.query;
    try {
        const hours = await db.query(`
            SELECT w.*, m.name as employee_name, s.name as store_name 
            FROM worked_hours w 
            JOIN members m ON w.member_id = m.id 
            JOIN stores s ON w.store_id = s.id 
            WHERE w.date >= ? AND w.date <= ?
        `, [startDate, endDate]);

        // Aggregate by individual (across all stores)
        const employeeTotals = {};
        const storeTotals = {};

        for (let h of hours) {
            // Employee Aggregate
            if (!employeeTotals[h.member_id]) {
                employeeTotals[h.member_id] = { Employee: h.employee_name, Ordinary: 0, Saturday: 0, Sunday: 0, PH: 0, AL: 0, SL: 0, Total: 0 };
            }
            const emp = employeeTotals[h.member_id];
            emp.Ordinary += h.ordinary_hours || 0;
            emp.Saturday += h.saturday_hours || 0;
            emp.Sunday += h.sunday_hours || 0;
            emp.PH += h.ph_hours || 0;
            emp.AL += h.al_hours || 0;
            emp.SL += h.sl_hours || 0;
            emp.Total += (h.ordinary_hours || 0) + (h.saturday_hours || 0) + (h.sunday_hours || 0) + (h.ph_hours || 0) + (h.al_hours || 0) + (h.sl_hours || 0);

            // Store Aggregate
            if (!storeTotals[h.store_id]) {
                storeTotals[h.store_id] = { Store: h.store_name, Ordinary: 0, Saturday: 0, Sunday: 0, PH: 0, AL: 0, SL: 0, 'Total Hours': 0 };
            }
            const st = storeTotals[h.store_id];
            st.Ordinary += h.ordinary_hours || 0;
            st.Saturday += h.saturday_hours || 0;
            st.Sunday += h.sunday_hours || 0;
            st.PH += h.ph_hours || 0;
            st.AL += h.al_hours || 0;
            st.SL += h.sl_hours || 0;
            st['Total Hours'] += (h.ordinary_hours || 0) + (h.saturday_hours || 0) + (h.sunday_hours || 0) + (h.ph_hours || 0) + (h.al_hours || 0) + (h.sl_hours || 0);
        }

        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet('Fortnightly Report');

        // Styles
        const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00B0F0' } }; // Light Blue
        const headerFont = { bold: true };
        const greenFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6EFCE' } }; // Light Green
        const borderAll = {
            top: { style: 'thin' }, left: { style: 'thin' },
            bottom: { style: 'thin' }, right: { style: 'thin' }
        };
        const centerAlign = { vertical: 'middle', horizontal: 'center' };

        // Set Headers Employee Table
        const empHeaders = ['Employee', 'Ordinary', 'Saturday', 'Sunday', 'PH', 'AL', 'SL'];
        empHeaders.forEach((h, i) => {
            const cell = ws.getCell(3, 3 + i); // Column C is 3
            cell.value = h;
            cell.fill = headerFill;
            cell.font = headerFont;
            cell.border = borderAll;
            cell.alignment = centerAlign;
        });

        // Set Headers Store Table
        const storeHeaders = ['Store', 'Ordinary', 'Saturday', 'Sunday', 'PH', 'AL', 'SL', 'Total Hours'];
        storeHeaders.forEach((h, i) => {
            const cell = ws.getCell(3, 12 + i); // Column L is 12
            cell.value = h;
            cell.fill = headerFill;
            cell.font = headerFont;
            cell.border = borderAll;
            cell.alignment = centerAlign;
        });

        // Employee Data
        let rowIdx = 4;
        const employees = Object.values(employeeTotals).sort((a,b) => a.Employee.localeCompare(b.Employee));
        for (const emp of employees) {
            const rowVals = [emp.Employee, emp.Ordinary, emp.Saturday, emp.Sunday, emp.PH, emp.AL, emp.SL];
            rowVals.forEach((val, i) => {
                const cell = ws.getCell(rowIdx, 3 + i);
                cell.value = val !== 0 ? val : '';
                cell.border = borderAll;
                cell.alignment = centerAlign;
                if (i === 0) {
                    cell.fill = greenFill; // First col is green
                }
            });
            rowIdx++;
        }

        // Output minimum empty rows to match template feeling (e.g. at least 30 rows of formatting)
        let maxEmpRow = Math.max(rowIdx - 1, 33);
        for(let r = rowIdx; r <= maxEmpRow; r++) {
            for(let c = 3; c <= 9; c++) {
                const cell = ws.getCell(r, c);
                cell.border = borderAll;
                if (c === 3) cell.fill = greenFill;
            }
        }

        // Store Data
        let storeRowIdx = 4;
        const stores = Object.values(storeTotals).sort((a,b) => a.Store.localeCompare(b.Store));
        for (const st of stores) {
            const rowVals = [st.Store, st.Ordinary, st.Saturday, st.Sunday, st.PH, st.AL, st.SL, st['Total Hours']];
            rowVals.forEach((val, i) => {
                const cell = ws.getCell(storeRowIdx, 12 + i);
                cell.value = val !== 0 ? val : '';
                cell.border = borderAll;
                cell.alignment = centerAlign;
                if (i === 0) {
                    cell.fill = greenFill;
                }
            });
            storeRowIdx++;
        }
        
        // Output minimum empty rows for stores (e.g. at least 10 rows)
        let maxStoreRow = Math.max(storeRowIdx - 1, 10);
        for(let r = storeRowIdx; r <= maxStoreRow; r++) {
            for(let c = 12; c <= 19; c++) {
                const cell = ws.getCell(r, c);
                cell.border = borderAll;
                if (c === 12) cell.fill = greenFill;
            }
        }

        // Adjust column widths
        ws.getColumn(3).width = 25; // Employee
        for(let c = 4; c <= 9; c++) ws.getColumn(c).width = 12; // Employee hours
        
        ws.getColumn(12).width = 25; // Store
        for(let c = 13; c <= 19; c++) ws.getColumn(c).width = 12; // Store hours

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="Fortnightly_Report_${startDate}.xlsx"`);
        
        await wb.xlsx.write(res);
        res.end();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET EXPORT ROSTER
app.get('/api/exports/roster', authenticateToken, async (req, res) => {
    const { storeId, startDate, endDate } = req.query;
    try {
        if (storeId !== 'all') {
            const hasAccess = await checkManagerStoreAccess(req.user, parseInt(storeId));
            if (!hasAccess) return res.status(403).json({ error: 'Forbidden' });
        } else if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Only admins can export all stores' });
        }

        let query = `
            SELECT st.name as Store, s.date as Date, s.member_name as Employee, s.start_time as Start, s.end_time as End, s.duration as Hours
            FROM shifts s 
            JOIN stores st ON s.store_id = st.id
            WHERE s.date >= ? AND s.date <= ?
        `;
        let params = [startDate, endDate];

        if (storeId !== 'all') {
            query += ` AND s.store_id = ?`;
            params.push(storeId);
        }
        query += ` ORDER BY s.date, s.start_time`;

        const shifts = await db.query(query, params);

        const wb = xlsx.utils.book_new();
        const ws = xlsx.utils.json_to_sheet(shifts);

        // Auto-size columns loosely based on header names for aesthetics
        const colWidths = [
            { wch: 20 }, // Store
            { wch: 12 }, // Date
            { wch: 25 }, // Employee
            { wch: 10 }, // Start
            { wch: 10 }, // End
            { wch: 8 }  // Hours
        ];
        ws['!cols'] = colWidths;

        xlsx.utils.book_append_sheet(wb, ws, 'Roster');

        const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Disposition', `attachment; filename="Roster_${startDate}_to_${endDate}.xlsx"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

if (require.main === module) {
    app.listen(PORT, () => { console.log(`Roster Server running on http://localhost:${PORT}`); });
}

module.exports = { app, authenticateToken, requireAdmin };
