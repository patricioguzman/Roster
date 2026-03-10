const assert = require('node:assert');
const { test, mock, after } = require('node:test');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const { app } = require('./server');
const db = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'roster-secret-key-123';
const token = jwt.sign({ username: 'testadmin', id: 1 }, JWT_SECRET);

test('POST /api/stores endpoint', async (t) => {

    // Store original function
    const originalDbRun = db.run;

    after(() => {
        db.run = originalDbRun;
    });

    await t.test('Creates a store with valid data', async () => {
        mock.method(db, 'run', async (query, params) => {
            assert.strictEqual(query, 'INSERT INTO stores (name, max_hours) VALUES (?, ?)');
            assert.deepStrictEqual(params, ['New Store', 40]);
            return { insertId: 123 };
        });

        const res = await request(app)
            .post('/api/stores')
            .set('Authorization', `Bearer ${token}`)
            .send({ name: 'New Store', maxHours: 40 });

        assert.strictEqual(res.status, 200);
        assert.deepStrictEqual(res.body, { id: 123, name: 'New Store', maxHours: 40 });

        db.run.mock.restore();
    });

    await t.test('Creates a store with no maxHours (defaults to 0)', async () => {
        mock.method(db, 'run', async (query, params) => {
            assert.strictEqual(query, 'INSERT INTO stores (name, max_hours) VALUES (?, ?)');
            assert.deepStrictEqual(params, ['Store No Hours', 0]);
            return { insertId: 124 };
        });

        const res = await request(app)
            .post('/api/stores')
            .set('Authorization', `Bearer ${token}`)
            .send({ name: 'Store No Hours' });

        assert.strictEqual(res.status, 200);
        assert.deepStrictEqual(res.body, { id: 124, name: 'Store No Hours', maxHours: 0 });

        db.run.mock.restore();
    });

    await t.test('Returns 400 when name is missing', async () => {
        const dbRunMock = mock.method(db, 'run', async () => {
            throw new Error('Should not be called');
        });

        const res = await request(app)
            .post('/api/stores')
            .set('Authorization', `Bearer ${token}`)
            .send({ maxHours: 40 });

        assert.strictEqual(res.status, 400);
        assert.deepStrictEqual(res.body, { error: 'Name is required' });
        assert.strictEqual(dbRunMock.mock.calls.length, 0);

        db.run.mock.restore();
    });

    await t.test('Returns 500 when database throws an error', async () => {
        mock.method(db, 'run', async (query, params) => {
            throw new Error('Database insertion failed');
        });

        const res = await request(app)
            .post('/api/stores')
            .set('Authorization', `Bearer ${token}`)
            .send({ name: 'Error Store', maxHours: 20 });

        assert.strictEqual(res.status, 500);
        assert.deepStrictEqual(res.body, { error: 'Database insertion failed' });

        db.run.mock.restore();
    });

    await t.test('Returns 401 when unauthenticated', async () => {
        const res = await request(app)
            .post('/api/stores')
            .send({ name: 'Unauthorized Store' });

        assert.strictEqual(res.status, 401);
    });
});
