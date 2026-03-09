const assert = require('node:assert');
const { test, mock } = require('node:test');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const db = require('./db');
const { app } = require('./server');

test('PUT /api/settings endpoints', async (t) => {

    await t.test('Missing token should return 401', async () => {
        const res = await request(app)
            .put('/api/settings')
            .send({ theme: 'dark' });

        assert.strictEqual(res.statusCode, 401);
    });

    await t.test('Invalid token should return 403', async () => {
        mock.method(jwt, 'verify', (token, secret, cb) => {
            cb(new Error('invalid token'), null);
        });

        const res = await request(app)
            .put('/api/settings')
            .set('Authorization', 'Bearer invalid_token')
            .send({ theme: 'dark' });

        assert.strictEqual(res.statusCode, 403);
        jwt.verify.mock.restore();
    });

    await t.test('Valid token should successfully update settings', async () => {
        mock.method(jwt, 'verify', (token, secret, cb) => {
            cb(null, { id: 1, username: 'admin' });
        });

        const mockRun = mock.fn();
        mock.method(db, 'transaction', async (cb) => {
            const tx = { run: mockRun };
            await cb(tx);
        });

        const res = await request(app)
            .put('/api/settings')
            .set('Authorization', 'Bearer valid_token')
            .send({
                theme: 'dark',
                notifications: 'on'
            });

        assert.strictEqual(res.statusCode, 200);
        assert.deepStrictEqual(res.body, { success: true });

        assert.strictEqual(mockRun.mock.calls.length, 2);
        assert.deepStrictEqual(mockRun.mock.calls[0].arguments, [
            'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
            ['theme', 'dark']
        ]);
        assert.deepStrictEqual(mockRun.mock.calls[1].arguments, [
            'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
            ['notifications', 'on']
        ]);

        jwt.verify.mock.restore();
        db.transaction.mock.restore();
    });

    await t.test('Database error should return 500', async () => {
        mock.method(jwt, 'verify', (token, secret, cb) => {
            cb(null, { id: 1, username: 'admin' });
        });

        mock.method(db, 'transaction', async () => {
            throw new Error('Database connection failed');
        });

        const res = await request(app)
            .put('/api/settings')
            .set('Authorization', 'Bearer valid_token')
            .send({ theme: 'dark' });

        assert.strictEqual(res.statusCode, 500);
        assert.deepStrictEqual(res.body, { error: 'Database connection failed' });

        jwt.verify.mock.restore();
        db.transaction.mock.restore();
    });
});
