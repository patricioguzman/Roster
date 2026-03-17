const assert = require('node:assert');
const { test, mock, afterEach } = require('node:test');
const { app } = require('./server');
const db = require('./db');
const jwt = require('jsonwebtoken');

test('PUT /api/members/:id endpoint', async (t) => {
    // Generate a valid token
    const token = jwt.sign({ username: 'admin', id: 1 }, process.env.JWT_SECRET || 'roster-secret-key-123', { expiresIn: '1h' });

    let server;
    let baseUrl;

    await new Promise((resolve, reject) => {
        server = app.listen(0, '127.0.0.1', () => {
            const port = server.address().port;
            baseUrl = `http://127.0.0.1:${port}`;
            resolve();
        });
        server.on('error', reject);
    });

    afterEach(() => {
        mock.restoreAll();
    });

    // Cleanup the server after all tests
    t.after(() => {
        server.close();
    });

    await t.test('Successfully update member details without storeIds', async () => {
        mock.method(db, 'transaction', async (callback) => {
            const tx = {
                run: mock.fn(async () => { return { changes: 1 }; })
            };
            await callback(tx);

            assert.strictEqual(tx.run.mock.calls.length, 1);
            assert.strictEqual(tx.run.mock.calls[0].arguments[0], 'UPDATE members SET name = ?, phone = ?, email = ?, employment_type = ? WHERE id = ?');
            assert.deepStrictEqual(tx.run.mock.calls[0].arguments[1], ['John Doe', '1234567890', 'john@example.com', 'full-time', '1']);
        });

        const response = await fetch(`${baseUrl}/api/members/1`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: 'John Doe',
                phone: '1234567890',
                email: 'john@example.com',
                employmentType: 'full-time'
            })
        });

        const data = await response.json();

        assert.strictEqual(response.status, 200);
        assert.deepStrictEqual(data, { success: true });
        assert.strictEqual(db.transaction.mock.calls.length, 1);
    });

    await t.test('Successfully update member details with storeIds', async () => {
        mock.method(db, 'transaction', async (callback) => {
            const tx = {
                run: mock.fn(async () => { return { changes: 1 }; })
            };
            await callback(tx);

            assert.strictEqual(tx.run.mock.calls.length, 4);

            assert.strictEqual(tx.run.mock.calls[0].arguments[0], 'UPDATE members SET name = ? WHERE id = ?');
            assert.deepStrictEqual(tx.run.mock.calls[0].arguments[1], ['Jane Doe', '2']);

            assert.strictEqual(tx.run.mock.calls[1].arguments[0], 'DELETE FROM member_stores WHERE member_id = ?');
            assert.deepStrictEqual(tx.run.mock.calls[1].arguments[1], ['2']);

            assert.strictEqual(tx.run.mock.calls[2].arguments[0], 'INSERT INTO member_stores (member_id, store_id) VALUES (?, ?)');
            assert.deepStrictEqual(tx.run.mock.calls[2].arguments[1], ['2', 1]);

            assert.strictEqual(tx.run.mock.calls[3].arguments[0], 'INSERT INTO member_stores (member_id, store_id) VALUES (?, ?)');
            assert.deepStrictEqual(tx.run.mock.calls[3].arguments[1], ['2', 2]);
        });

        const response = await fetch(`${baseUrl}/api/members/2`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: 'Jane Doe',
                storeIds: [1, 2]
            })
        });

        const data = await response.json();

        assert.strictEqual(response.status, 200);
        assert.deepStrictEqual(data, { success: true });
    });

    await t.test('Handle database transaction error', async () => {
        mock.method(db, 'transaction', async () => {
            throw new Error('Database connection failed');
        });

        const response = await fetch(`${baseUrl}/api/members/3`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: 'Error Case'
            })
        });

        const data = await response.json();

        assert.strictEqual(response.status, 500);
        assert.deepStrictEqual(data, { error: 'Database connection failed' });
    });

    await t.test('No properties provided should skip UPDATE statement and succeed', async () => {
        mock.method(db, 'transaction', async (callback) => {
            const tx = {
                run: mock.fn(async () => { return { changes: 1 }; })
            };
            await callback(tx);

            assert.strictEqual(tx.run.mock.calls.length, 0);
        });

        const response = await fetch(`${baseUrl}/api/members/4`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({})
        });

        const data = await response.json();

        assert.strictEqual(response.status, 200);
        assert.deepStrictEqual(data, { success: true });
    });
});
