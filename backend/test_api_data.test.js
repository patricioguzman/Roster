const assert = require('node:assert');
const { test, mock, before, after } = require('node:test');
const db = require('./db');
const { app } = require('./server');

let server;
let baseUrl;

before(async () => {
    return new Promise((resolve) => {
        server = app.listen(0, () => {
            const port = server.address().port;
            baseUrl = `http://localhost:${port}`;
            resolve();
        });
    });
});

after(() => {
    if (server) {
        server.close();
    }
});

test('GET /api/data endpoint', async (t) => {

    await t.test('Successfully fetches and formats all data', async () => {
        // Mock db.query
        const dbMock = mock.method(db, 'query', async (queryStr) => {
            if (queryStr.includes('SELECT * FROM settings')) {
                return [
                    { key_name: 'test_setting', value: '123' },
                    { key: 'sqlite_setting', value: '456' }
                ];
            } else if (queryStr.includes('SELECT * FROM stores')) {
                return [
                    { id: 1, name: 'Store A', max_hours: 40 },
                    { id: 2, name: 'Store B', max_hours: null }
                ];
            } else if (queryStr.includes('GROUP_CONCAT(ms.store_id)')) {
                return [
                    { id: 1, name: 'John Doe', phone: '123', email: 'john@example.com', employment_type: 'full-time', store_ids: '1,2' },
                    { id: 2, name: 'Jane Doe', phone: '456', email: 'jane@example.com', employment_type: null, store_ids: null }
                ];
            } else if (queryStr.includes('SELECT * FROM shifts')) {
                return [
                    { id: 10, store_id: 1, member_id: 1, member_name: 'John Doe', date: '2023-10-01', start_time: '09:00', end_time: '17:00', duration: 8 }
                ];
            }
            return [];
        });

        const response = await fetch(`${baseUrl}/api/data`);
        assert.strictEqual(response.status, 200);

        const data = await response.json();

        // Check settings
        assert.deepStrictEqual(data.settings, {
            test_setting: '123',
            sqlite_setting: '456'
        });

        // Check stores
        assert.deepStrictEqual(data.stores, [
            { id: 1, name: 'Store A', maxHours: 40 },
            { id: 2, name: 'Store B', maxHours: 0 }
        ]);
        assert.strictEqual(data.currentStoreId, 1);

        // Check members
        assert.deepStrictEqual(data.members, [
            { id: 1, name: 'John Doe', phone: '123', email: 'john@example.com', storeIds: [1, 2], employmentType: 'full-time' },
            { id: 2, name: 'Jane Doe', phone: '456', email: 'jane@example.com', storeIds: [], employmentType: 'casual' }
        ]);

        // Check shifts
        assert.deepStrictEqual(data.shifts, [
            { id: 10, storeId: 1, memberId: 1, name: 'John Doe', date: '2023-10-01', startTime: '09:00', endTime: '17:00', duration: 8 }
        ]);

        dbMock.mock.restore();
    });

    await t.test('Handles database errors gracefully', async () => {
        const dbMock = mock.method(db, 'query', async () => {
            throw new Error('Database connection failed');
        });

        const response = await fetch(`${baseUrl}/api/data`);
        assert.strictEqual(response.status, 500);

        const data = await response.json();
        assert.deepStrictEqual(data, { error: 'Database connection failed' });

        dbMock.mock.restore();
    });

});
