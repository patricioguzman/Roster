const assert = require('node:assert');
const { test, mock, afterEach } = require('node:test');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

const dbAPI = require('./db');

test('checkAdmin bootstrapping logic', async (t) => {
    // Clear potentially interfering env vars
    delete process.env.INITIAL_ADMIN_USERNAME;
    delete process.env.INITIAL_ADMIN_PASSWORD;

    afterEach(() => {
        mock.restoreAll();
        delete process.env.INITIAL_ADMIN_USERNAME;
        delete process.env.INITIAL_ADMIN_PASSWORD;
    });

    await t.test('Should skip creating admin if an admin already exists', async (t) => {
        // Mock dbAPI.get to simulate existing admin
        mock.method(dbAPI, 'get', async () => ({ count: 1 }));

        // Mock dbAPI.run to ensure it's not called
        const runMock = mock.method(dbAPI, 'run', async () => {});

        await dbAPI.checkAdmin(dbAPI);

        assert.strictEqual(runMock.mock.calls.length, 0);
    });

    await t.test('Should create admin using random password if no env variables set', async (t) => {
        // Mock dbAPI.get to simulate no admins
        mock.method(dbAPI, 'get', async () => ({ count: 0 }));

        const runMock = mock.method(dbAPI, 'run', async () => {});

        // Mock crypto.randomBytes to return a predictable value
        mock.method(crypto, 'randomBytes', () => ({ toString: () => 'random_pass_123' }));

        // Mock bcrypt.hash to return a predictable hash
        mock.method(bcrypt, 'hash', async () => 'hashed_random_pass');

        // Mock console.log to avoid cluttering test output and to assert on it
        const logMock = mock.method(console, 'log', () => {});

        await dbAPI.checkAdmin(dbAPI);

        assert.strictEqual(runMock.mock.calls.length, 1);

        const [query, params] = runMock.mock.calls[0].arguments;
        assert.strictEqual(query, 'INSERT INTO admins (username, password_hash) VALUES (?, ?)');
        assert.deepStrictEqual(params, ['admin', 'hashed_random_pass']);

        // Check console output
        assert.strictEqual(logMock.mock.calls.length, 2);
        assert.match(logMock.mock.calls[0].arguments[0], /Created default admin: admin \/ random_pass_123/);
    });

    await t.test('Should create admin using INITIAL_ADMIN_USERNAME and INITIAL_ADMIN_PASSWORD env variables', async (t) => {
        process.env.INITIAL_ADMIN_USERNAME = 'superadmin';
        process.env.INITIAL_ADMIN_PASSWORD = 'superpassword';

        // Mock dbAPI.get to simulate no admins
        mock.method(dbAPI, 'get', async () => ({ count: 0 }));

        const runMock = mock.method(dbAPI, 'run', async () => {});

        // Mock bcrypt.hash to return a predictable hash
        mock.method(bcrypt, 'hash', async () => 'hashed_superpassword');

        // Mock console.log
        const logMock = mock.method(console, 'log', () => {});

        await dbAPI.checkAdmin(dbAPI);

        assert.strictEqual(runMock.mock.calls.length, 1);

        const [query, params] = runMock.mock.calls[0].arguments;
        assert.strictEqual(query, 'INSERT INTO admins (username, password_hash) VALUES (?, ?)');
        assert.deepStrictEqual(params, ['superadmin', 'hashed_superpassword']);

        // Check console output
        assert.strictEqual(logMock.mock.calls.length, 1);
        assert.match(logMock.mock.calls[0].arguments[0], /Created default admin: superadmin \/ \(password from INITIAL_ADMIN_PASSWORD environment variable\)/);
    });
});
