const assert = require('node:assert');
const { test, mock, afterEach } = require('node:test');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

const dbAPI = require('./db');

test('checkAdmin bootstrapping logic', async (t) => {
    // Save original env vars
    const originalEnv = { ...process.env };

    // Save original console.log
    const originalConsoleLog = console.log;

    afterEach(() => {
        // Restore env vars
        process.env = { ...originalEnv };
        // Restore console.log
        console.log = originalConsoleLog;
    });

    await t.test('Should skip creating admin if an admin already exists', async () => {
        const mockDbInterface = {
            get: mock.fn(async () => ({ count: 1 })),
            run: mock.fn()
        };

        await dbAPI.checkAdmin(mockDbInterface);

        assert.strictEqual(mockDbInterface.get.mock.calls.length, 1);
        assert.strictEqual(mockDbInterface.run.mock.calls.length, 0, 'Should not insert anything if count > 0');
    });

    await t.test('Should create admin using random password if no env variables set', async () => {
        // Ensure env variables are unset
        delete process.env.INITIAL_ADMIN_USERNAME;
        delete process.env.INITIAL_ADMIN_PASSWORD;

        let printedPassword = null;
        console.log = (msg) => {
            if (msg.startsWith('Created default admin: admin / ')) {
                printedPassword = msg.split(' / ')[1];
            }
        };

        const mockDbInterface = {
            get: mock.fn(async () => ({ count: 0 })),
            run: mock.fn()
        };

        // Mock bcrypt to avoid slow tests, just verify it's called
        mock.method(bcrypt, 'hash', async (pw, salt) => `hashed_${pw}`);

        await dbAPI.checkAdmin(mockDbInterface);

        assert.strictEqual(mockDbInterface.run.mock.calls.length, 1);

        const runArgs = mockDbInterface.run.mock.calls[0].arguments;
        assert.strictEqual(runArgs[0], 'INSERT INTO admins (username, password_hash) VALUES (?, ?)');
        assert.strictEqual(runArgs[1][0], 'admin', 'Default username should be "admin"');
        assert.ok(runArgs[1][1].startsWith('hashed_'), 'Password should be hashed');

        // Assert password matches the one printed and is 16 chars long (8 bytes hex)
        const passwordUsed = runArgs[1][1].replace('hashed_', '');
        assert.strictEqual(passwordUsed, printedPassword, 'Logged password should match inserted password');
        assert.strictEqual(passwordUsed.length, 16, 'Random password should be 16 characters long');

        bcrypt.hash.mock.restore();
    });

    await t.test('Should create admin using INITIAL_ADMIN_USERNAME and INITIAL_ADMIN_PASSWORD env variables', async () => {
        process.env.INITIAL_ADMIN_USERNAME = 'superadmin';
        process.env.INITIAL_ADMIN_PASSWORD = 'supersecurepassword';

        let printedMsg = null;
        console.log = (msg) => {
            if (msg.startsWith('Created default admin: superadmin')) {
                printedMsg = msg;
            }
        };

        const mockDbInterface = {
            get: mock.fn(async () => ({ count: 0 })),
            run: mock.fn()
        };

        mock.method(bcrypt, 'hash', async (pw, salt) => `hashed_${pw}`);

        await dbAPI.checkAdmin(mockDbInterface);

        assert.strictEqual(mockDbInterface.run.mock.calls.length, 1);

        const runArgs = mockDbInterface.run.mock.calls[0].arguments;
        assert.strictEqual(runArgs[1][0], 'superadmin', 'Username should use env variable');
        assert.strictEqual(runArgs[1][1], 'hashed_supersecurepassword', 'Password should be hashed env variable');

        assert.ok(printedMsg.includes('(password from INITIAL_ADMIN_PASSWORD environment variable)'), 'Should not log the plain password when using env variable');

        bcrypt.hash.mock.restore();
    });
});
