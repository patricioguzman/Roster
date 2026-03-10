const { test, mock } = require('node:test');
const assert = require('node:assert');
const mysql = require('mysql2/promise');
const sqlite3 = require('sqlite3').verbose();

test('db.js module tests', async (t) => {
    // Save original env vars
    const originalEnv = { ...process.env };

    await t.test('MySQL Adapter', async (t) => {
        process.env.DB_TYPE = 'mysql';

        const mockQuery = mock.fn(async (sql) => {
            if (sql.match(/^SELECT/i) || sql.match(/SHOW/i) || sql.match(/CREATE/i)) {
                return [[{ id: 1, key_name: 'test', value: 'value' }]];
            }
            return [{ insertId: 5, affectedRows: 2 }];
        });

        // Use a persistent connection object so we can assert on its methods
        const connectionObj = {
            beginTransaction: mock.fn(),
            commit: mock.fn(),
            rollback: mock.fn(),
            release: mock.fn(),
            query: mockQuery
        };
        const mockGetConnection = mock.fn(async () => connectionObj);

        mock.method(mysql, 'createPool', () => ({
            query: mockQuery,
            getConnection: mockGetConnection
        }));

        delete require.cache[require.resolve('./db.js')];
        const db = require('./db.js');

        await t.test('query() should execute select and return rows', async () => {
            const res = await db.query('SELECT * FROM test');
            assert.deepStrictEqual(res, [{ id: 1, key_name: 'test', value: 'value' }]);
        });

        await t.test('get() should return the first row', async () => {
            const res = await db.get('SELECT * FROM test LIMIT 1');
            assert.deepStrictEqual(res, { id: 1, key_name: 'test', value: 'value' });
        });

        await t.test('run() should execute insert/update and return insertId and changes', async () => {
            const res = await db.run('INSERT INTO test (name) VALUES (?)', ['John']);
            assert.deepStrictEqual(res, { insertId: 5, changes: 2 });
        });

        await t.test('run() should fix settings table key syntax', async () => {
            const res = await db.run('INSERT INTO settings (key, value) VALUES (?, ?)', ['test', 'value']);
            assert.deepStrictEqual(res, { insertId: 5, changes: 2 });
            const lastCallSql = mockQuery.mock.calls[mockQuery.mock.calls.length - 1].arguments[0];
            assert.match(lastCallSql, /settings \(key_name, value\)/);
        });

        await t.test('transaction() success path', async () => {
            connectionObj.commit.mock.resetCalls();
            connectionObj.release.mock.resetCalls();

            await db.transaction(async (tx) => {
                const res = await tx.query('SELECT * FROM test');
                assert.deepStrictEqual(res, [{ id: 1, key_name: 'test', value: 'value' }]);

                const getRes = await tx.get('SELECT * FROM test');
                assert.deepStrictEqual(getRes, { id: 1, key_name: 'test', value: 'value' });

                const runRes = await tx.run('INSERT INTO settings (key, value) VALUES (?, ?)', ['test', 'value']);
                assert.deepStrictEqual(runRes, { insertId: 5, changes: 2 });
            });
            assert.strictEqual(connectionObj.commit.mock.callCount(), 1);
            assert.strictEqual(connectionObj.release.mock.callCount(), 1);
        });

        await t.test('transaction() failure path should rollback', async () => {
            connectionObj.rollback.mock.resetCalls();
            connectionObj.release.mock.resetCalls();

            try {
                await db.transaction(async (tx) => {
                    throw new Error('Transaction failed');
                });
                assert.fail('Should have thrown error');
            } catch (err) {
                assert.strictEqual(err.message, 'Transaction failed');
            }
            assert.strictEqual(connectionObj.rollback.mock.callCount(), 1);
            assert.strictEqual(connectionObj.release.mock.callCount(), 1);
        });

        mysql.createPool.mock.restore();
    });

    await t.test('SQLite Adapter', async (t) => {
        delete process.env.DB_TYPE;

        const mockAll = mock.fn((sql, params, cb) => {
            if (typeof params === 'function') cb = params;
            else cb(null, [{ id: 1 }]);
        });
        const mockGet = mock.fn((sql, params, cb) => {
            if (typeof params === 'function') cb = params;
            else cb(null, { id: 1 });
        });
        const mockRun = mock.fn(function(sql, params, cb) {
            if (typeof params === 'function') cb = params;
            const ctx = { lastID: 10, changes: 1 };
            if (cb) cb.call(ctx, null);
        });
        const mockSerialize = mock.fn((cb) => cb());

        function MockDatabase(dbPath, cb) {
            if (cb) setImmediate(() => cb(null));
            this.all = mockAll;
            this.get = mockGet;
            this.run = mockRun;
            this.serialize = mockSerialize;
        }

        mock.method(sqlite3, 'Database', MockDatabase);

        delete require.cache[require.resolve('./db.js')];
        const db = require('./db.js');

        await new Promise(r => setImmediate(r));
        await new Promise(r => setImmediate(r));

        await t.test('query() should return rows', async () => {
            const res = await db.query('SELECT * FROM test');
            assert.deepStrictEqual(res, [{ id: 1 }]);
        });

        await t.test('get() should return first row', async () => {
            const res = await db.get('SELECT * FROM test LIMIT 1');
            assert.deepStrictEqual(res, { id: 1 });
        });

        await t.test('run() should execute and return insertId and changes', async () => {
            const res = await db.run('INSERT INTO test (name) VALUES (?)', ['John']);
            assert.deepStrictEqual(res, { insertId: 10, changes: 1 });
        });

        await t.test('transaction() success path', async () => {
            mockRun.mock.resetCalls();
            await db.transaction(async (tx) => {
                const res = await tx.query('SELECT * FROM test');
                assert.deepStrictEqual(res, [{ id: 1 }]);
            });
            const runCalls = mockRun.mock.calls.map(call => call.arguments[0]);
            assert.ok(runCalls.includes('BEGIN TRANSACTION'));
            assert.ok(runCalls.includes('COMMIT'));
        });

        await t.test('transaction() failure path should rollback', async () => {
            mockRun.mock.resetCalls();
            try {
                await db.transaction(async (tx) => {
                    throw new Error('Transaction failed');
                });
                assert.fail('Should have thrown error');
            } catch (err) {
                assert.strictEqual(err.message, 'Transaction failed');
            }
            const runCalls = mockRun.mock.calls.map(call => call.arguments[0]);
            assert.ok(runCalls.includes('BEGIN TRANSACTION'));
            assert.ok(runCalls.includes('ROLLBACK'));
        });

        sqlite3.Database.mock.restore();
    });

    process.env = originalEnv;
});
