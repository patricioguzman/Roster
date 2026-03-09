const assert = require('node:assert');
const { test, mock } = require('node:test');

test('db.transaction rollback path', async (t) => {
    // Save previous DB_TYPE to restore later
    const originalDbType = process.env.DB_TYPE;

    // Set DB_TYPE to mysql before requiring the module
    process.env.DB_TYPE = 'mysql';

    const mysql = require('mysql2/promise');

    // We need to mock the createPool method to return our fake pool
    const fakeConnection = {
        beginTransaction: mock.fn(),
        commit: mock.fn(),
        rollback: mock.fn(),
        release: mock.fn(),
        query: mock.fn(async () => [[], []])
    };

    const fakePool = {
        getConnection: mock.fn(async () => fakeConnection),
        query: mock.fn(async () => [[], []])
    };

    // Create the mock *before* requiring db.js
    mock.method(mysql, 'createPool', () => fakePool);

    const db = require('./db');

    await t.test('transaction rolls back on error', async () => {
        // Clear previous calls (from initMysql)
        fakeConnection.beginTransaction.mock.resetCalls();
        fakeConnection.commit.mock.resetCalls();
        fakeConnection.rollback.mock.resetCalls();
        fakeConnection.release.mock.resetCalls();

        const testError = new Error('Test transaction error');

        try {
            await db.transaction(async (tx) => {
                throw testError;
            });
            assert.fail('Should have thrown an error');
        } catch (err) {
            assert.strictEqual(err, testError, 'Should throw the original error');
            assert.strictEqual(fakeConnection.beginTransaction.mock.calls.length, 1, 'Should call beginTransaction');
            assert.strictEqual(fakeConnection.rollback.mock.calls.length, 1, 'Should call rollback');
            assert.strictEqual(fakeConnection.commit.mock.calls.length, 0, 'Should not call commit');
            assert.strictEqual(fakeConnection.release.mock.calls.length, 1, 'Should call release');
        }
    });

    // Cleanup mock and restore environment
    mysql.createPool.mock.restore();
    if (originalDbType === undefined) {
        delete process.env.DB_TYPE;
    } else {
        process.env.DB_TYPE = originalDbType;
    }
});
