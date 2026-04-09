const test = require('node:test');
const assert = require('node:assert');
const serverExports = require('./server');
const app = serverExports.app || serverExports;

test('/api/data endpoint fetches data concurrently correctly', async (t) => {
    let server;
    let url;

    t.before(() => {
        return new Promise((resolve, reject) => {
            // Use port 0 to get an ephemeral port dynamically
            server = app.listen(0, (err) => {
                if (err) return reject(err);
                const port = server.address().port;
                url = `http://localhost:${port}/api/data`;
                resolve();
            });
        });
    });

    t.after(() => {
        if (server) {
            server.close();
        }
    });

    await t.test('returns expected structure', async () => {
        const response = await fetch(url);
        assert.strictEqual(response.status, 200);
        const data = await response.json();

        assert.ok(data.stores !== undefined, 'stores should exist');
        assert.ok(Array.isArray(data.stores), 'stores should be an array');
        assert.ok(data.members !== undefined, 'members should exist');
        assert.ok(Array.isArray(data.members), 'members should be an array');
        assert.ok(data.shifts !== undefined, 'shifts should exist');
        assert.ok(Array.isArray(data.shifts), 'shifts should be an array');
        assert.ok(data.settings !== undefined, 'settings should exist');
        assert.ok(typeof data.settings === 'object', 'settings should be an object');
    });
});
