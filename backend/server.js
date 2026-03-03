const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config();

const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'roster-secret-key-123';

const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : ['https://roster.bypat.com.au', 'http://localhost:3000'];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(null, false);
        }
    }
}));
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
            const token = jwt.sign({ username: row.username, id: row.id }, JWT_SECRET, { expiresIn: '24h' });
            res.json({ token });
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- GET ALL DATA ---
app.get('/api/data', async (req, res) => {
    try {
        const data = { stores: [], members: [], shifts: [], settings: {}, currentStoreId: null };

        const membersQuery = `
            SELECT m.*, GROUP_CONCAT(ms.store_id) as store_ids
            FROM members m
            LEFT JOIN member_stores ms ON m.id = ms.member_id
            GROUP BY m.id
        `;

        // ⚡ Bolt: Parallelize independent DB queries to reduce latency
        const [settingsRows, stores, members, shifts] = await Promise.all([
            db.query('SELECT * FROM settings'),
            db.query('SELECT * FROM stores'),
            db.query(membersQuery),
            db.query('SELECT * FROM shifts')
        ]);

        settingsRows.forEach(row => {
            // Handle both sqlite "key" and mysql "key_name"
            const k = row.key_name || row.key;
            data.settings[k] = row.value;
        });

        data.stores = stores.map(s => ({ id: s.id, name: s.name, maxHours: s.max_hours || 0 }));
        if (stores.length > 0) data.currentStoreId = stores[0].id;

        data.members = members.map(m => ({
            id: m.id, name: m.name, phone: m.phone, email: m.email,
            storeIds: m.store_ids ? String(m.store_ids).split(',').map(id => parseInt(id)) : [],
            employmentType: m.employment_type || 'casual'
        }));

        data.shifts = shifts.map(s => ({
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
