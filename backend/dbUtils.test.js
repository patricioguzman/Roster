const assert = require('node:assert');
const { test, describe } = require('node:test');
const { adaptQuery } = require('./dbUtils');

describe('adaptQuery()', () => {
    test('returns original query when isMysql is false', () => {
        const query = 'CREATE TABLE test (id INTEGER PRIMARY KEY AUTOINCREMENT)';
        const result = adaptQuery(query, false);
        assert.strictEqual(result, query);
    });

    test('replaces AUTOINCREMENT with AUTO_INCREMENT when isMysql is true', () => {
        const query = 'CREATE TABLE test (id INTEGER PRIMARY KEY AUTOINCREMENT)';
        const expected = 'CREATE TABLE test (id INTEGER PRIMARY KEY AUTO_INCREMENT)';
        const result = adaptQuery(query, true);
        assert.strictEqual(result, expected);
    });

    test('replaces AUTOINCREMENT case-insensitively when isMysql is true', () => {
        const query = 'CREATE TABLE test (id INTEGER PRIMARY KEY autoincrement)';
        const expected = 'CREATE TABLE test (id INTEGER PRIMARY KEY AUTO_INCREMENT)';
        const result = adaptQuery(query, true);
        assert.strictEqual(result, expected);
    });

    test('replaces INSERT OR REPLACE INTO with REPLACE INTO when isMysql is true', () => {
        const query = 'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)';
        const expected = 'REPLACE INTO settings (key, value) VALUES (?, ?)';
        const result = adaptQuery(query, true);
        assert.strictEqual(result, expected);
    });

    test('replaces INSERT OR IGNORE INTO with INSERT IGNORE INTO when isMysql is true', () => {
        const query = 'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)';
        const expected = 'INSERT IGNORE INTO settings (key, value) VALUES (?, ?)';
        const result = adaptQuery(query, true);
        assert.strictEqual(result, expected);
    });

    test('makes no replacements if keywords are missing', () => {
        const query = 'SELECT * FROM members';
        const expected = 'SELECT * FROM members';
        const result = adaptQuery(query, true);
        assert.strictEqual(result, expected);
    });

    test('replaces multiple occurrences correctly', () => {
        const query = 'INSERT OR REPLACE INTO t1 (id) VALUES (1); INSERT OR REPLACE INTO t2 (id) VALUES (2);';
        const expected = 'REPLACE INTO t1 (id) VALUES (1); REPLACE INTO t2 (id) VALUES (2);';
        const result = adaptQuery(query, true);
        assert.strictEqual(result, expected);
    });
});
