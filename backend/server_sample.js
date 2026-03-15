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
