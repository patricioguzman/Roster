const request = require('supertest');
const { app } = require('./server');

// Mock db to avoid open handles
jest.mock('./db', () => ({
    all: jest.fn(),
    get: jest.fn(),
    run: jest.fn(),
    transaction: jest.fn(),
}));

describe('PayPal Webhook Verification', () => {
    let originalEnv;

    beforeAll(() => {
        originalEnv = process.env;
    });

    beforeEach(() => {
        jest.resetModules();
        process.env = { ...originalEnv };

        // Mock global fetch
        global.fetch = jest.fn();
        jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterAll(() => {
        process.env = originalEnv;
        jest.restoreAllMocks();
    });

    it('should return 500 if webhook configuration is missing', async () => {
        // Clear env vars
        delete process.env.PAYPAL_WEBHOOK_ID;
        delete process.env.PAYPAL_CLIENT_ID;
        delete process.env.PAYPAL_CLIENT_SECRET;

        const res = await request(app)
            .post('/api/paypal/webhook')
            .send({ event_type: 'PAYMENT.SALE.COMPLETED' });

        expect(res.statusCode).toBe(500);
        expect(res.body).toEqual({ error: 'Webhook configuration missing' });
    });

    it('should return 400 if signature verification fails', async () => {
        process.env.PAYPAL_WEBHOOK_ID = 'test-webhook-id';
        process.env.PAYPAL_CLIENT_ID = 'test-client-id';
        process.env.PAYPAL_CLIENT_SECRET = 'test-client-secret';

        // Mock fetch for OAuth Token (success)
        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ access_token: 'mock-access-token' })
        });

        // Mock fetch for Signature Verification (failure)
        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ verification_status: 'FAILURE' })
        });

        const res = await request(app)
            .post('/api/paypal/webhook')
            .set('paypal-auth-algo', 'SHA256withRSA')
            .send({ event_type: 'PAYMENT.SALE.COMPLETED' });

        expect(res.statusCode).toBe(400);
        expect(res.body).toEqual({ error: 'Webhook verification failed' });
    });

    it('should return 200 if signature verification succeeds', async () => {
        process.env.PAYPAL_WEBHOOK_ID = 'test-webhook-id';
        process.env.PAYPAL_CLIENT_ID = 'test-client-id';
        process.env.PAYPAL_CLIENT_SECRET = 'test-client-secret';

        // Mock fetch for OAuth Token (success)
        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ access_token: 'mock-access-token' })
        });

        // Mock fetch for Signature Verification (success)
        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ verification_status: 'SUCCESS' })
        });

        const res = await request(app)
            .post('/api/paypal/webhook')
            .set('paypal-auth-algo', 'SHA256withRSA')
            .send({ event_type: 'PAYMENT.SALE.COMPLETED' });

        expect(res.statusCode).toBe(200);
        expect(res.text).toBe('OK');
    });

    it('should handle OAuth failure gracefully', async () => {
        process.env.PAYPAL_WEBHOOK_ID = 'test-webhook-id';
        process.env.PAYPAL_CLIENT_ID = 'test-client-id';
        process.env.PAYPAL_CLIENT_SECRET = 'test-client-secret';

        // Mock fetch for OAuth Token (failure)
        global.fetch.mockResolvedValueOnce({
            ok: false,
            json: async () => ({ error_description: 'Invalid client' })
        });

        const res = await request(app)
            .post('/api/paypal/webhook')
            .set('paypal-auth-algo', 'SHA256withRSA')
            .send({ event_type: 'PAYMENT.SALE.COMPLETED' });

        expect(res.statusCode).toBe(500);
        expect(res.body).toEqual({ error: 'Internal Server Error processing webhook' });
    });
});
