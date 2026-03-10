const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const { app } = require('./server'); // Requires server.js to export app

describe('CORS Restrictions', () => {
    test('Allows requests from default allowed origin (http://localhost:3000)', async () => {
        const res = await request(app)
            .get('/api/config/public')
            .set('Origin', 'http://localhost:3000');

        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.headers['access-control-allow-origin'], 'http://localhost:3000');
    });

    test('Allows requests with no origin', async () => {
        const res = await request(app)
            .get('/api/config/public');

        assert.strictEqual(res.statusCode, 200);
    });

    test('Rejects requests from disallowed origin (http://evil.com)', async () => {
        const res = await request(app)
            .get('/api/config/public')
            .set('Origin', 'http://evil.com');

        assert.strictEqual(res.statusCode, 500); // Express default error handler returns 500 with stack trace for thrown Error
        assert.ok(res.text.includes('The CORS policy for this site does not allow access from the specified Origin.'));
    });
});
