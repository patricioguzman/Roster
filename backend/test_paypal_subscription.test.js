const assert = require('node:assert');
const { test, mock } = require('node:test');
const { createPayPalSubscription } = require('./server');

test('createPayPalSubscription handler', async (t) => {

    // Store original env vars
    const originalEnv = { ...process.env };

    t.afterEach(() => {
        // Restore fetch and env after each test
        if (global.fetch.mock) {
            global.fetch.mock.restore();
        }
        process.env = { ...originalEnv };
    });

    await t.test('Missing planId should return 400', async () => {
        const req = { body: {} };
        let statusCode = null;
        let jsonResponse = null;

        const res = {
            status: (code) => {
                statusCode = code;
                return res;
            },
            json: (data) => {
                jsonResponse = data;
            }
        };

        await createPayPalSubscription(req, res);

        assert.strictEqual(statusCode, 400);
        assert.deepStrictEqual(jsonResponse, { error: 'planId is required' });
    });

    await t.test('Successful subscription creation', async () => {
        const req = { body: { planId: 'P-12345' } };
        let jsonResponse = null;

        const res = {
            status: () => res,
            json: (data) => {
                jsonResponse = data;
            }
        };

        process.env.PAYPAL_CLIENT_ID = 'test_client_id';
        process.env.PAYPAL_CLIENT_SECRET = 'test_client_secret';
        process.env.PAYPAL_ENV = 'sandbox';

        let fetchCallCount = 0;
        mock.method(global, 'fetch', async (url, options) => {
            fetchCallCount++;
            if (url.includes('/v1/oauth2/token')) {
                return {
                    ok: true,
                    json: async () => ({ access_token: 'mock_access_token' })
                };
            } else if (url.includes('/v1/billing/subscriptions')) {
                return {
                    ok: true,
                    json: async () => ({
                        id: 'I-67890',
                        links: [{ rel: 'approve', href: 'https://sandbox.paypal.com/approve/I-67890' }]
                    })
                };
            }
            throw new Error(`Unexpected fetch call to ${url}`);
        });

        await createPayPalSubscription(req, res);

        assert.strictEqual(fetchCallCount, 2);
        assert.deepStrictEqual(jsonResponse, {
            approvalUrl: 'https://sandbox.paypal.com/approve/I-67890',
            subscriptionId: 'I-67890'
        });
    });

    await t.test('PayPal Auth Error should return 500', async () => {
        const req = { body: { planId: 'P-12345' } };
        let statusCode = null;
        let jsonResponse = null;

        const res = {
            status: (code) => {
                statusCode = code;
                return res;
            },
            json: (data) => {
                jsonResponse = data;
            }
        };

        process.env.PAYPAL_CLIENT_ID = 'test_client_id';
        process.env.PAYPAL_CLIENT_SECRET = 'test_client_secret';

        // Suppress console.error for this test to avoid noisy test output
        const originalConsoleError = console.error;
        console.error = () => {};

        mock.method(global, 'fetch', async (url, options) => {
            if (url.includes('/v1/oauth2/token')) {
                return {
                    ok: false,
                    json: async () => ({ error_description: 'Invalid client credentials' })
                };
            }
            return { ok: true };
        });

        await createPayPalSubscription(req, res);

        console.error = originalConsoleError;

        assert.strictEqual(statusCode, 500);
        assert.ok(jsonResponse.error.includes('PayPal Auth Error'));
        assert.ok(jsonResponse.error.includes('Invalid client credentials'));
    });

    await t.test('PayPal Subscription Error should return 500', async () => {
        const req = { body: { planId: 'P-12345' } };
        let statusCode = null;
        let jsonResponse = null;

        const res = {
            status: (code) => {
                statusCode = code;
                return res;
            },
            json: (data) => {
                jsonResponse = data;
            }
        };

        process.env.PAYPAL_CLIENT_ID = 'test_client_id';
        process.env.PAYPAL_CLIENT_SECRET = 'test_client_secret';

        // Suppress console.error for this test
        const originalConsoleError = console.error;
        console.error = () => {};

        mock.method(global, 'fetch', async (url, options) => {
            if (url.includes('/v1/oauth2/token')) {
                return {
                    ok: true,
                    json: async () => ({ access_token: 'mock_access_token' })
                };
            } else if (url.includes('/v1/billing/subscriptions')) {
                return {
                    ok: false,
                    json: async () => ({ message: 'Invalid plan id' })
                };
            }
            return { ok: true };
        });

        await createPayPalSubscription(req, res);

        console.error = originalConsoleError;

        assert.strictEqual(statusCode, 500);
        assert.ok(jsonResponse.error.includes('PayPal Subscription Error'));
        assert.ok(jsonResponse.error.includes('Invalid plan id'));
    });

    await t.test('Missing approve link should return 500', async () => {
        const req = { body: { planId: 'P-12345' } };
        let statusCode = null;
        let jsonResponse = null;

        const res = {
            status: (code) => {
                statusCode = code;
                return res;
            },
            json: (data) => {
                jsonResponse = data;
            }
        };

        process.env.PAYPAL_CLIENT_ID = 'test_client_id';
        process.env.PAYPAL_CLIENT_SECRET = 'test_client_secret';

        // Suppress console.error for this test
        const originalConsoleError = console.error;
        console.error = () => {};

        mock.method(global, 'fetch', async (url, options) => {
            if (url.includes('/v1/oauth2/token')) {
                return {
                    ok: true,
                    json: async () => ({ access_token: 'mock_access_token' })
                };
            } else if (url.includes('/v1/billing/subscriptions')) {
                return {
                    ok: true,
                    json: async () => ({
                        id: 'I-67890',
                        links: [{ rel: 'self', href: 'https://sandbox.paypal.com/self' }] // No approve link
                    })
                };
            }
            return { ok: true };
        });

        await createPayPalSubscription(req, res);

        console.error = originalConsoleError;

        assert.strictEqual(statusCode, 500);
        assert.strictEqual(jsonResponse.error, 'No approve link found in PayPal response');
    });

});
