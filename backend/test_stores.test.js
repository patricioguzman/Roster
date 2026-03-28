const assert = require('node:assert');
const { test, mock, before, after } = require('node:test');
const jwt = require('jsonwebtoken');

const { app } = require('./server');
const db = require('./db');

let server;
const PORT = 3001; // use a different port for testing to avoid conflicts

before(async () => {
    await new Promise((resolve) => {
        server = app.listen(PORT, resolve);
    });
});

after(() => {
    server.close();
});

test('POST /api/stores', async (t) => {

    t.beforeEach(() => {
        // Mock jwt.verify to bypass auth
        mock.method(jwt, 'verify', (token, secret, callback) => {
            callback(null, { id: 1, username: 'admin' });
        });
    });

    t.afterEach(() => {
        jwt.verify.mock.restore();
        if (db.run.mock) {
            db.run.mock.restore();
        }
    });

    await t.test('Should return 400 if name is missing', async () => {
        const res = await fetch(`http://localhost:${PORT}/api/stores`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer testtoken'
            },
            body: JSON.stringify({ maxHours: 40 })
        });

        assert.strictEqual(res.status, 400);
        const data = await res.json();
        assert.deepStrictEqual(data, { error: 'Name is required' });
    });

    await t.test('Should create store and return 200 with inserted data', async () => {
        mock.method(db, 'run', async (query, params) => {
            assert.strictEqual(query, 'INSERT INTO stores (name, max_hours) VALUES (?, ?)');
            assert.deepStrictEqual(params, ['Main Store', 40]);
            return { insertId: 5 };
        });

        const res = await fetch(`http://localhost:${PORT}/api/stores`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer testtoken'
            },
            body: JSON.stringify({ name: 'Main Store', maxHours: 40 })
        });

        assert.strictEqual(res.status, 200);
        const data = await res.json();
        assert.deepStrictEqual(data, { id: 5, name: 'Main Store', maxHours: 40 });
        assert.strictEqual(db.run.mock.calls.length, 1);
    });

    await t.test('Should handle default maxHours as 0 when not provided', async () => {
        mock.method(db, 'run', async (query, params) => {
            assert.strictEqual(query, 'INSERT INTO stores (name, max_hours) VALUES (?, ?)');
            assert.deepStrictEqual(params, ['Backup Store', 0]);
            return { insertId: 6 };
        });

        const res = await fetch(`http://localhost:${PORT}/api/stores`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer testtoken'
            },
            body: JSON.stringify({ name: 'Backup Store' })
        });

        assert.strictEqual(res.status, 200);
        const data = await res.json();
        assert.deepStrictEqual(data, { id: 6, name: 'Backup Store', maxHours: 0 });
        assert.strictEqual(db.run.mock.calls.length, 1);
    });

    await t.test('Should return 500 when database throws an error', async () => {
        mock.method(db, 'run', async (query, params) => {
            throw new Error('Database insertion failed');
        });

        const res = await fetch(`http://localhost:${PORT}/api/stores`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer testtoken'
            },
            body: JSON.stringify({ name: 'Faulty Store', maxHours: 20 })
        });

        assert.strictEqual(res.status, 500);
        const data = await res.json();
        assert.deepStrictEqual(data, { error: 'Database insertion failed' });
        assert.strictEqual(db.run.mock.calls.length, 1);
    });
});
