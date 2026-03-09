const assert = require('node:assert');
const { test, mock, afterEach } = require('node:test');
const request = require('supertest');
const bcrypt = require('bcrypt');

const db = require('./db');
const { app } = require('./server');

test('POST /api/auth/login endpoint', async (t) => {

    afterEach(() => {
        mock.restoreAll();
    });

    await t.test('Successful login with valid credentials', async () => {
        const mockUser = {
            id: 1,
            username: 'admin',
            password_hash: '$2b$10$abcdefg1234567'
        };

        mock.method(db, 'get', async (sql, params) => {
            assert.strictEqual(params[0], 'admin');
            return mockUser;
        });

        mock.method(bcrypt, 'compare', async (password, hash) => {
            assert.strictEqual(password, 'password123');
            assert.strictEqual(hash, mockUser.password_hash);
            return true;
        });

        const res = await request(app)
            .post('/api/auth/login')
            .send({ username: 'admin', password: 'password123' })
            .expect(200);

        assert.ok(res.body.token);
    });

    await t.test('Returns 401 for invalid username', async () => {
        mock.method(db, 'get', async () => {
            return null;
        });

        const res = await request(app)
            .post('/api/auth/login')
            .send({ username: 'nonexistent', password: 'password123' })
            .expect(401);

        assert.strictEqual(res.body.error, 'Invalid credentials');
    });

    await t.test('Returns 401 for valid username but invalid password', async () => {
        const mockUser = {
            id: 1,
            username: 'admin',
            password_hash: '$2b$10$abcdefg1234567'
        };

        mock.method(db, 'get', async () => {
            return mockUser;
        });

        mock.method(bcrypt, 'compare', async () => {
            return false;
        });

        const res = await request(app)
            .post('/api/auth/login')
            .send({ username: 'admin', password: 'wrongpassword' })
            .expect(401);

        assert.strictEqual(res.body.error, 'Invalid credentials');
    });

    await t.test('Handles server errors gracefully and returns 500', async () => {
        mock.method(db, 'get', async () => {
            throw new Error('Database connection failed');
        });

        const res = await request(app)
            .post('/api/auth/login')
            .send({ username: 'admin', password: 'password123' })
            .expect(500);

        assert.strictEqual(res.body.error, 'Internal server error');
    });

});
