const assert = require('node:assert');
const { test, mock } = require('node:test');
const db = require('./db');
const { app } = require('./server');

test('GET /api/data endpoint error handling', async (t) => {
    let server;
    let baseUrl;

    // Wait for the server to start
    t.before(async () => {
        await new Promise((resolve) => {
            server = app.listen(0, () => {
                const port = server.address().port;
                baseUrl = `http://localhost:${port}`;
                resolve();
            });
        });
    });

    // Close the server when tests are finished
    t.after(() => {
        if (server) {
            server.close();
        }
    });

    await t.test('Should return 500 when database query fails', async () => {
        const simulatedErrorMsg = 'Simulated database error from test';

        // Mock db.query to throw an error, simulating a DB failure
        mock.method(db, 'query', async () => {
            throw new Error(simulatedErrorMsg);
        });

        const response = await fetch(`${baseUrl}/api/data`);
        const responseData = await response.json();

        // Check that it gracefully handles the error and returns a 500 status
        assert.strictEqual(response.status, 500);
        assert.deepStrictEqual(responseData, { error: simulatedErrorMsg });

        // Restore original method
        db.query.mock.restore();
    });
});
