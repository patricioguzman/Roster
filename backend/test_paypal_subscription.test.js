const assert = require('node:assert');
const { test, mock } = require('node:test');
const request = require('supertest');
const { app } = require('./server');
const jwt = require('jsonwebtoken');

test('POST /api/paypal/subscription/create error handling', async (t) => {
    await t.test('Should return 500 when PayPal auth fails with 401', async () => {
        const jwtMock = mock.method(jwt, 'verify', (token, secret, callback) => {
            callback(null, { id: 1, username: 'admin' });
        });

        const fetchMock = mock.method(global, 'fetch', async (url, options) => {
            if (url.includes('/v1/oauth2/token')) {
                return {
                    ok: false,
                    json: async () => ({
                        error_description: 'Invalid client credentials'
                    })
                };
            }
            return { ok: true, json: async () => ({}) };
        });

        const response = await request(app)
            .post('/api/paypal/subscription/create')
            .set('Authorization', 'Bearer test_token')
            .send({ planId: 'P-1234' });

        assert.strictEqual(response.status, 500);
        assert.ok(response.body.error.includes('PayPal Auth Error: Invalid client credentials'));

        jwtMock.mock.restore();
        fetchMock.mock.restore();
    });
});
