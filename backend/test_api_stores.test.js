const assert = require('node:assert');
const { test, mock } = require('node:test');
const jwt = require('jsonwebtoken');
const db = require('./db');
const { app } = require('./server');

test('POST /api/stores', async (t) => {
    let server;
    let baseUrl;

    t.before(async () => {
        await new Promise((resolve) => {
            server = app.listen(0, () => {
                baseUrl = `http://localhost:${server.address().port}`;
                resolve();
            });
        });
    });

    t.after(() => {
        server.close();
    });

    t.afterEach(() => {
        mock.restoreAll();
    });

    await t.test('Missing name should return 400', async () => {
        mock.method(jwt, 'verify', (token, secret, callback) => {
            callback(null, { id: 1, username: 'admin' });
        });

        const response = await fetch(`${baseUrl}/api/stores`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer test-token'
            },
            body: JSON.stringify({ maxHours: 40 })
        });

        assert.strictEqual(response.status, 400);
        const data = await response.json();
        assert.deepStrictEqual(data, { error: 'Name is required' });
    });

    await t.test('Valid request should create store and return 200', async () => {
        mock.method(jwt, 'verify', (token, secret, callback) => {
            callback(null, { id: 1, username: 'admin' });
        });

        mock.method(db, 'run', async (query, params) => {
            assert.strictEqual(query, 'INSERT INTO stores (name, max_hours) VALUES (?, ?)');
            assert.deepStrictEqual(params, ['Test Store', 40]);
            return { insertId: 5 };
        });

        const response = await fetch(`${baseUrl}/api/stores`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer test-token'
            },
            body: JSON.stringify({ name: 'Test Store', maxHours: 40 })
        });

        assert.strictEqual(response.status, 200);
        const data = await response.json();
        assert.deepStrictEqual(data, { id: 5, name: 'Test Store', maxHours: 40 });
    });

    await t.test('Database error should return 500', async () => {
        mock.method(jwt, 'verify', (token, secret, callback) => {
            callback(null, { id: 1, username: 'admin' });
        });

        mock.method(db, 'run', async () => {
            throw new Error('DB Connection Error');
        });

        const response = await fetch(`${baseUrl}/api/stores`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer test-token'
            },
            body: JSON.stringify({ name: 'Test Store' })
        });

        assert.strictEqual(response.status, 500);
        const data = await response.json();
        assert.deepStrictEqual(data, { error: 'DB Connection Error' });
    });
});
