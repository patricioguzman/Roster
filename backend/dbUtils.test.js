const assert = require('node:assert');
const { test } = require('node:test');
const { adaptQueryForMysql } = require('./dbUtils');

test('dbUtils - adaptQueryForMysql', async (t) => {

    await t.test('Should replace AUTOINCREMENT with AUTO_INCREMENT (case insensitive)', () => {
        const input1 = "CREATE TABLE test (id INTEGER PRIMARY KEY AUTOINCREMENT)";
        const expected1 = "CREATE TABLE test (id INTEGER PRIMARY KEY AUTO_INCREMENT)";
        assert.strictEqual(adaptQueryForMysql(input1), expected1);

        const input2 = "CREATE TABLE test (id INTEGER PRIMARY KEY autoincrement)";
        const expected2 = "CREATE TABLE test (id INTEGER PRIMARY KEY AUTO_INCREMENT)";
        assert.strictEqual(adaptQueryForMysql(input2), expected2);
    });

});

test('dbUtils - INSERT OR REPLACE INTO replacement', async (t) => {
    await t.test('Should replace INSERT OR REPLACE INTO with REPLACE INTO (case insensitive)', () => {
        const input1 = "INSERT OR REPLACE INTO settings (key, value) VALUES ('theme', 'dark')";
        const expected1 = "REPLACE INTO settings (key, value) VALUES ('theme', 'dark')";
        assert.strictEqual(adaptQueryForMysql(input1), expected1);

        const input2 = "insert or replace into users (name) values ('john')";
        const expected2 = "REPLACE INTO users (name) values ('john')";
        assert.strictEqual(adaptQueryForMysql(input2), expected2);
    });
});

test('dbUtils - INSERT OR IGNORE INTO replacement', async (t) => {
    await t.test('Should replace INSERT OR IGNORE INTO with INSERT IGNORE INTO (case insensitive)', () => {
        const input1 = "INSERT OR IGNORE INTO users (name) VALUES ('john')";
        const expected1 = "INSERT IGNORE INTO users (name) VALUES ('john')";
        assert.strictEqual(adaptQueryForMysql(input1), expected1);

        const input2 = "insert or ignore into users (name) values ('doe')";
        const expected2 = "INSERT IGNORE INTO users (name) values ('doe')";
        assert.strictEqual(adaptQueryForMysql(input2), expected2);
    });
});

test('dbUtils - preserves unaffected queries', async (t) => {
    await t.test('Should not modify queries without SQLite specific syntax', () => {
        const input1 = "SELECT * FROM users WHERE id = 1";
        assert.strictEqual(adaptQueryForMysql(input1), input1);

        const input2 = "UPDATE settings SET value = 'new' WHERE key = 'theme'";
        assert.strictEqual(adaptQueryForMysql(input2), input2);

        const input3 = "DELETE FROM users WHERE name = 'john'";
        assert.strictEqual(adaptQueryForMysql(input3), input3);
    });

    await t.test('Should handle non-string inputs gracefully', () => {
        assert.strictEqual(adaptQueryForMysql(null), null);
        assert.strictEqual(adaptQueryForMysql(undefined), undefined);
        assert.strictEqual(adaptQueryForMysql(123), 123);
    });
});
