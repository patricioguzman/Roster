const assert = require('node:assert');
const { test, mock } = require('node:test');
const jwt = require('jsonwebtoken');

// Load the server module which now exports the authenticateToken middleware
// Set a dummy JWT_SECRET for the test environment
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const { authenticateToken } = require('./server');

test('authenticateToken middleware', async (t) => {

    await t.test('Missing token should return 401', (t) => {
        const req = {
            headers: {}
        };

        let statusCode = null;
        const res = {
            sendStatus: (code) => {
                statusCode = code;
            }
        };

        const next = mock.fn();

        authenticateToken(req, res, next);

        assert.strictEqual(statusCode, 401);
        assert.strictEqual(next.mock.calls.length, 0);
    });

    await t.test('Valid token should call next() and set req.user', (t) => {
        const req = {
            headers: {
                authorization: 'Bearer valid.jwt.token'
            }
        };

        const res = {
            sendStatus: mock.fn()
        };

        const next = mock.fn();
        const userPayload = { id: 1, username: 'admin' };

        // Mock jwt.verify to call the callback with no error and our userPayload
        mock.method(jwt, 'verify', (token, secret, callback) => {
            callback(null, userPayload);
        });

        authenticateToken(req, res, next);

        assert.strictEqual(res.sendStatus.mock.calls.length, 0);
        assert.strictEqual(next.mock.calls.length, 1);
        assert.deepStrictEqual(req.user, userPayload);

        // Restore jwt.verify
        jwt.verify.mock.restore();
    });

    await t.test('Invalid token should return 403', (t) => {
        const req = {
            headers: {
                authorization: 'Bearer invalid.jwt.token'
            }
        };

        let statusCode = null;
        const res = {
            sendStatus: (code) => {
                statusCode = code;
            }
        };

        const next = mock.fn();

        // Mock jwt.verify to call the callback with an error
        mock.method(jwt, 'verify', (token, secret, callback) => {
            callback(new Error('invalid token'), null);
        });

        authenticateToken(req, res, next);

        assert.strictEqual(statusCode, 403);
        assert.strictEqual(next.mock.calls.length, 0);
        assert.strictEqual(req.user, undefined);

        // Restore jwt.verify
        jwt.verify.mock.restore();
    });

});
