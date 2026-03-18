const assert = require('node:assert');
const { test } = require('node:test');
const { app } = require('./server');

test('GET /api/data Endpoint', async (t) => {
    // Start the server dynamically on an available port
    let server;
    let baseUrl;

    t.before(async () => {
        return new Promise((resolve) => {
            server = app.listen(0, () => {
                const port = server.address().port;
                baseUrl = `http://localhost:${port}`;
                resolve();
            });
        });
    });

    t.after(async () => {
        return new Promise((resolve) => {
            if (server) {
                server.close(resolve);
            } else {
                resolve();
            }
        });
    });

    await t.test('Should fetch data successfully with correct structure', async () => {
        const response = await fetch(`${baseUrl}/api/data`);
        assert.strictEqual(response.status, 200);

        const data = await response.json();

        // Verify the expected properties exist
        assert.ok('stores' in data);
        assert.ok('members' in data);
        assert.ok('shifts' in data);
        assert.ok('settings' in data);

        // Verify they are the correct types
        assert.ok(Array.isArray(data.stores));
        assert.ok(Array.isArray(data.members));
        assert.ok(Array.isArray(data.shifts));
        assert.strictEqual(typeof data.settings, 'object');
    });
});
