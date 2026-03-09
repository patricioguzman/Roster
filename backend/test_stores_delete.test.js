const assert = require('node:assert');
const { test, mock, afterEach } = require('node:test');
const request = require('supertest');

// Setup mock for db and authenticateToken
const db = require('./db');
const jwt = require('jsonwebtoken');

const { app } = require('./server');

test('DELETE /api/stores/:id endpoint', async (t) => {

    // Mock authentication middleware
    mock.method(jwt, 'verify', (token, secret, callback) => {
        callback(null, { id: 1, username: 'admin' });
    });

    await t.test('Successfully deletes store and related data', async () => {
        // Mock the db.transaction call
        const mockTxRun = mock.fn(async () => {});
        mock.method(db, 'transaction', async (callback) => {
            await callback({ run: mockTxRun });
        });

        const response = await request(app)
            .delete('/api/stores/5')
            .set('Authorization', 'Bearer valid_token');

        assert.strictEqual(response.status, 200);
        assert.deepStrictEqual(response.body, { success: true });

        // Assert transaction was called
        assert.strictEqual(db.transaction.mock.calls.length, 1);

        // Assert tx.run was called three times with correct queries
        assert.strictEqual(mockTxRun.mock.calls.length, 3);

        const deleteStoresCall = mockTxRun.mock.calls[0].arguments;
        assert.strictEqual(deleteStoresCall[0], 'DELETE FROM stores WHERE id = ?');
        assert.deepStrictEqual(deleteStoresCall[1], ['5']);

        const deleteMemberStoresCall = mockTxRun.mock.calls[1].arguments;
        assert.strictEqual(deleteMemberStoresCall[0], 'DELETE FROM member_stores WHERE store_id = ?');
        assert.deepStrictEqual(deleteMemberStoresCall[1], ['5']);

        const deleteShiftsCall = mockTxRun.mock.calls[2].arguments;
        assert.strictEqual(deleteShiftsCall[0], 'DELETE FROM shifts WHERE store_id = ?');
        assert.deepStrictEqual(deleteShiftsCall[1], ['5']);

        db.transaction.mock.restore();
    });

    await t.test('Handles database errors gracefully', async () => {
        mock.method(db, 'transaction', async () => {
            throw new Error('Database connection failed');
        });

        const response = await request(app)
            .delete('/api/stores/5')
            .set('Authorization', 'Bearer valid_token');

        assert.strictEqual(response.status, 500);
        assert.deepStrictEqual(response.body, { error: 'Database connection failed' });

        db.transaction.mock.restore();
    });

});
