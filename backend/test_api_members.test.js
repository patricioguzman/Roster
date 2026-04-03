const assert = require('node:assert');
const { test, mock, before, after } = require('node:test');
const jwt = require('jsonwebtoken');

// Load the server module which exports app
const { app } = require('./server');
const db = require('./db');

let server;
let port;
let baseUrl;

// Test variables to inspect db calls
let txRunCalls = [];
let transactionCalled = false;
let throwInTransaction = false;
let txMock;

before(async () => {
    await new Promise((resolve) => {
        server = app.listen(0, () => {
            port = server.address().port;
            baseUrl = `http://localhost:${port}`;
            resolve();
        });
    });

    // Mock db.transaction
    mock.method(db, 'transaction', async (cb) => {
        transactionCalled = true;
        if (throwInTransaction) {
            throw new Error('Transaction error simulated');
        }

        // We create a mock transaction object `tx`
        txMock = {
            run: async (sql, params) => {
                txRunCalls.push({ sql, params });
                // Return a fake insertId
                return { insertId: 42, changes: 1 };
            }
        };

        await cb(txMock);
    });

    // Mock jwt.verify to bypass authentication
    mock.method(jwt, 'verify', (token, secret, callback) => {
        if (token === 'valid.jwt.token') {
            callback(null, { id: 1, username: 'admin' });
        } else {
            callback(new Error('invalid token'), null);
        }
    });
});

after(async () => {
    jwt.verify.mock.restore();
    db.transaction.mock.restore();
    await new Promise((resolve) => {
        server.close(resolve);
    });
});

test('POST /api/members endpoint', async (t) => {
    await t.test('Happy path: Valid request with storeIds', async () => {
        txRunCalls = [];
        transactionCalled = false;
        throwInTransaction = false;

        const payload = {
            name: 'John Doe',
            phone: '1234567890',
            email: 'john@example.com',
            employmentType: 'full-time',
            storeIds: [1, 2]
        };

        const res = await fetch(`${baseUrl}/api/members`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer valid.jwt.token'
            },
            body: JSON.stringify(payload)
        });

        assert.strictEqual(res.status, 200);
        const data = await res.json();

        assert.strictEqual(data.id, 42);
        assert.deepStrictEqual(data.storeIds, [1, 2]);
        assert.strictEqual(data.name, 'John Doe');
        assert.strictEqual(data.employmentType, 'full-time');

        assert.strictEqual(transactionCalled, true);
        assert.strictEqual(txRunCalls.length, 3);

        // Verify the insert member query
        assert.strictEqual(txRunCalls[0].sql, 'INSERT INTO members (name, phone, email, employment_type) VALUES (?, ?, ?, ?)');
        assert.deepStrictEqual(txRunCalls[0].params, ['John Doe', '1234567890', 'john@example.com', 'full-time']);

        // Verify the insert member_stores queries (loop)
        assert.strictEqual(txRunCalls[1].sql, 'INSERT INTO member_stores (member_id, store_id) VALUES (?, ?)');
        assert.deepStrictEqual(txRunCalls[1].params, [42, 1]);

        assert.strictEqual(txRunCalls[2].sql, 'INSERT INTO member_stores (member_id, store_id) VALUES (?, ?)');
        assert.deepStrictEqual(txRunCalls[2].params, [42, 2]);
    });

    await t.test('Happy path: Valid request without employmentType and without storeIds', async () => {
        txRunCalls = [];
        transactionCalled = false;
        throwInTransaction = false;

        const payload = {
            name: 'Jane Smith'
            // no phone, no email, no employmentType, no storeIds
        };

        const res = await fetch(`${baseUrl}/api/members`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer valid.jwt.token'
            },
            body: JSON.stringify(payload)
        });

        assert.strictEqual(res.status, 200);
        const data = await res.json();

        assert.strictEqual(data.id, 42);
        assert.deepStrictEqual(data.storeIds, []);
        assert.strictEqual(data.name, 'Jane Smith');
        assert.strictEqual(data.phone, undefined);
        assert.strictEqual(data.email, undefined);
        assert.strictEqual(data.employmentType, 'casual'); // default

        assert.strictEqual(transactionCalled, true);
        assert.strictEqual(txRunCalls.length, 1);

        // Verify the insert member query
        assert.strictEqual(txRunCalls[0].sql, 'INSERT INTO members (name, phone, email, employment_type) VALUES (?, ?, ?, ?)');
        assert.deepStrictEqual(txRunCalls[0].params, ['Jane Smith', '', '', 'casual']);
    });

    await t.test('Error path: Database transaction throws an error', async () => {
        txRunCalls = [];
        transactionCalled = false;
        throwInTransaction = true; // Simulating error in db.transaction

        const payload = {
            name: 'Error Member'
        };

        const res = await fetch(`${baseUrl}/api/members`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer valid.jwt.token'
            },
            body: JSON.stringify(payload)
        });

        assert.strictEqual(res.status, 500);
        const data = await res.json();

        assert.strictEqual(data.error, 'Transaction error simulated');
    });

    await t.test('Unauthorized: Missing token', async () => {
        const payload = {
            name: 'Hacker'
        };

        const res = await fetch(`${baseUrl}/api/members`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        assert.strictEqual(res.status, 401);
    });
});
