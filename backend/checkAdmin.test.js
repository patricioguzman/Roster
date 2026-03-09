const { test, mock } = require('node:test');
const assert = require('node:assert');
const bcrypt = require('bcrypt');

const db = require('./db');

test('checkAdmin', async (t) => {

    await t.test('Should do nothing if admin already exists', async () => {
        const mockDb = {
            get: mock.fn(async () => ({ id: 1, username: 'eli' })),
            run: mock.fn()
        };
        const hashMock = mock.method(bcrypt, 'hash', async () => 'hashedpwd');

        // Mock console.log
        const logMock = mock.method(console, 'log', () => {});

        await db.checkAdmin(mockDb);

        assert.strictEqual(mockDb.get.mock.calls.length, 1);
        assert.deepStrictEqual(mockDb.get.mock.calls[0].arguments, [
            'SELECT * FROM admins WHERE username = ?',
            ['eli']
        ]);
        assert.strictEqual(mockDb.run.mock.calls.length, 0);
        assert.strictEqual(hashMock.mock.calls.length, 0);

        hashMock.mock.restore();
        logMock.mock.restore();
    });

    await t.test('Should create default admin if not exists', async () => {
        const mockDb = {
            get: mock.fn(async () => null),
            run: mock.fn(async () => {})
        };
        const hashMock = mock.method(bcrypt, 'hash', async () => 'hashedpwd');

        // Mock console.log
        const logMock = mock.method(console, 'log', () => {});

        await db.checkAdmin(mockDb);

        assert.strictEqual(mockDb.get.mock.calls.length, 1);
        assert.strictEqual(hashMock.mock.calls.length, 1);
        assert.deepStrictEqual(hashMock.mock.calls[0].arguments, ['eli123', 10]);

        assert.strictEqual(mockDb.run.mock.calls.length, 1);
        assert.deepStrictEqual(mockDb.run.mock.calls[0].arguments, [
            'INSERT INTO admins (username, password_hash) VALUES (?, ?)',
            ['eli', 'hashedpwd']
        ]);

        hashMock.mock.restore();
        logMock.mock.restore();
    });
});
