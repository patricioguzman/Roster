const assert = require('node:assert');
const { test, mock, before, after } = require('node:test');

const db = require('./db');
const { app } = require('./server');

test('GET /api/data', async (t) => {
    let server;
    let url;

    before(async () => {
        // Setup an instance of the express app just for testing
        await new Promise((resolve) => {
            server = app.listen(0, () => {
                const port = server.address().port;
                url = `http://localhost:${port}`;
                resolve();
            });
        });
    });

    after(() => {
        if (server) {
            server.close();
        }
        // Restore all mocks after all tests in this suite
        mock.restoreAll();
    });

    await t.test('Happy Path: should fetch and format data correctly', async () => {
        // Mock `db.query` to simulate DB responses
        mock.method(db, 'query', async (queryStr) => {
            if (queryStr.includes('SELECT * FROM settings')) {
                // Return mixed key_name and key formats to cover settings map
                return [
                    { key_name: 'theme', value: 'dark' },
                    { key: 'timezone', value: 'UTC' }
                ];
            }
            if (queryStr.includes('SELECT * FROM stores')) {
                // Mix of max_hours valid vs null
                return [
                    { id: 1, name: 'Store A', max_hours: 40 },
                    { id: 2, name: 'Store B', max_hours: null }
                ];
            }
            if (queryStr.includes('SELECT m.*, GROUP_CONCAT(ms.store_id) as store_ids')) {
                // Mix of valid store_ids and null store_ids, employment_type valid vs null
                return [
                    { id: 10, name: 'Alice', phone: '123', email: 'alice@example.com', store_ids: '1,2', employment_type: 'full-time' },
                    { id: 11, name: 'Bob', phone: '', email: '', store_ids: null, employment_type: null }
                ];
            }
            if (queryStr.includes('SELECT * FROM shifts')) {
                return [
                    { id: 100, store_id: 1, member_id: 10, member_name: 'Alice', date: '2023-10-01', start_time: '09:00', end_time: '17:00', duration: 8 }
                ];
            }
            return [];
        });

        const response = await fetch(`${url}/api/data`);
        assert.strictEqual(response.status, 200);

        const data = await response.json();

        assert.deepStrictEqual(data.settings, {
            theme: 'dark',
            timezone: 'UTC'
        });

        assert.deepStrictEqual(data.stores, [
            { id: 1, name: 'Store A', maxHours: 40 },
            { id: 2, name: 'Store B', maxHours: 0 }
        ]);

        assert.strictEqual(data.currentStoreId, 1);

        assert.deepStrictEqual(data.members, [
            { id: 10, name: 'Alice', phone: '123', email: 'alice@example.com', storeIds: [1, 2], employmentType: 'full-time' },
            { id: 11, name: 'Bob', phone: '', email: '', storeIds: [], employmentType: 'casual' }
        ]);

        assert.deepStrictEqual(data.shifts, [
            { id: 100, storeId: 1, memberId: 10, name: 'Alice', date: '2023-10-01', startTime: '09:00', endTime: '17:00', duration: 8 }
        ]);

        // Restore mock to prepare for next test
        db.query.mock.restore();
    });

    await t.test('Error Handling: should handle database errors gracefully', async () => {
        // Mock `db.query` to simulate DB failure
        mock.method(db, 'query', async () => {
            throw new Error('Database connection failed');
        });

        const response = await fetch(`${url}/api/data`);
        assert.strictEqual(response.status, 500);

        const data = await response.json();
        assert.strictEqual(data.error, 'Database connection failed');

        // Restore mock to prepare for next test
        db.query.mock.restore();
    });

});
