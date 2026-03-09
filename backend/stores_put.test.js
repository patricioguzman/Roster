const assert = require('node:assert');
const { test, mock } = require('node:test');
const request = require('supertest');
const jwt = require('jsonwebtoken');

// Mock db module
const db = require('./db');
mock.method(db, 'run', async () => ({ changes: 1 }));

// Load the server module
const { app } = require('./server');

test('PUT /api/stores/:id endpoint', async (t) => {
    // Mock jwt.verify to bypass authentication
    mock.method(jwt, 'verify', (token, secret, callback) => {
        callback(null, { id: 1, username: 'admin' });
    });

    const validToken = 'valid.jwt.token';

    await t.test('Should return 400 when no params are provided', async () => {
        const res = await request(app)
            .put('/api/stores/1')
            .set('Authorization', `Bearer ${validToken}`)
            .send({});

        assert.strictEqual(res.statusCode, 400);
        assert.deepStrictEqual(res.body, { error: 'Nothing to update' });
    });

    await t.test('Should correctly update maxHours when maxHours is provided', async () => {
        db.run.mock.resetCalls();

        const res = await request(app)
            .put('/api/stores/1')
            .set('Authorization', `Bearer ${validToken}`)
            .send({ maxHours: '40' });

        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(db.run.mock.calls.length, 1);

        const callArgs = db.run.mock.calls[0].arguments;
        assert.strictEqual(callArgs[0], 'UPDATE stores SET max_hours = ? WHERE id = ?');
        assert.deepStrictEqual(callArgs[1], [40, '1']);
    });

    await t.test('Should set maxHours to 0 when maxHours is an empty string', async () => {
        db.run.mock.resetCalls();

        const res = await request(app)
            .put('/api/stores/1')
            .set('Authorization', `Bearer ${validToken}`)
            .send({ maxHours: '' });

        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(db.run.mock.calls.length, 1);

        const callArgs = db.run.mock.calls[0].arguments;
        assert.strictEqual(callArgs[0], 'UPDATE stores SET max_hours = ? WHERE id = ?');
        assert.deepStrictEqual(callArgs[1], [0, '1']);
    });

    await t.test('Should correctly update name when name is provided', async () => {
        db.run.mock.resetCalls();

        const res = await request(app)
            .put('/api/stores/2')
            .set('Authorization', `Bearer ${validToken}`)
            .send({ name: 'New Store Name' });

        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(db.run.mock.calls.length, 1);

        const callArgs = db.run.mock.calls[0].arguments;
        assert.strictEqual(callArgs[0], 'UPDATE stores SET name = ? WHERE id = ?');
        assert.deepStrictEqual(callArgs[1], ['New Store Name', '2']);
    });

    await t.test('Should correctly update both name and maxHours', async () => {
        db.run.mock.resetCalls();

        const res = await request(app)
            .put('/api/stores/3')
            .set('Authorization', `Bearer ${validToken}`)
            .send({ name: 'Another Store', maxHours: '55.5' });

        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(db.run.mock.calls.length, 1);

        const callArgs = db.run.mock.calls[0].arguments;
        assert.strictEqual(callArgs[0], 'UPDATE stores SET name = ?, max_hours = ? WHERE id = ?');
        assert.deepStrictEqual(callArgs[1], ['Another Store', 55.5, '3']);
    });

    // Restore original methods
    jwt.verify.mock.restore();
});
