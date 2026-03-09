const dbAPI = require('./db');

describe('db.js adaptQuery', () => {
    it('should convert AUTOINCREMENT to AUTO_INCREMENT when isMysqlFlag is true', () => {
        const query = 'CREATE TABLE test (id INTEGER PRIMARY KEY AUTOINCREMENT)';
        const result = dbAPI.adaptQuery(query, true);
        expect(result).toBe('CREATE TABLE test (id INTEGER PRIMARY KEY AUTO_INCREMENT)');
    });

    it('should handle case insensitivity for AUTOINCREMENT when isMysqlFlag is true', () => {
        const query = 'CREATE TABLE test (id INTEGER PRIMARY KEY autoincrement)';
        const result = dbAPI.adaptQuery(query, true);
        expect(result).toBe('CREATE TABLE test (id INTEGER PRIMARY KEY AUTO_INCREMENT)');
    });

    it('should convert INSERT OR REPLACE INTO to REPLACE INTO when isMysqlFlag is true', () => {
        const query = 'INSERT OR REPLACE INTO test (id, name) VALUES (1, "a")';
        const result = dbAPI.adaptQuery(query, true);
        expect(result).toBe('REPLACE INTO test (id, name) VALUES (1, "a")');
    });

    it('should handle case insensitivity for INSERT OR REPLACE INTO when isMysqlFlag is true', () => {
        const query = 'insert or replace into test (id, name) VALUES (1, "a")';
        const result = dbAPI.adaptQuery(query, true);
        expect(result).toBe('REPLACE INTO test (id, name) VALUES (1, "a")');
    });

    it('should convert INSERT OR IGNORE INTO to INSERT IGNORE INTO when isMysqlFlag is true', () => {
        const query = 'INSERT OR IGNORE INTO test (id, name) VALUES (1, "a")';
        const result = dbAPI.adaptQuery(query, true);
        expect(result).toBe('INSERT IGNORE INTO test (id, name) VALUES (1, "a")');
    });

    it('should handle case insensitivity for INSERT OR IGNORE INTO when isMysqlFlag is true', () => {
        const query = 'insert or ignore into test (id, name) VALUES (1, "a")';
        const result = dbAPI.adaptQuery(query, true);
        expect(result).toBe('INSERT IGNORE INTO test (id, name) VALUES (1, "a")');
    });

    it('should not modify query when isMysqlFlag is false', () => {
        const query1 = 'CREATE TABLE test (id INTEGER PRIMARY KEY AUTOINCREMENT)';
        const query2 = 'INSERT OR REPLACE INTO test (id, name) VALUES (1, "a")';
        const query3 = 'INSERT OR IGNORE INTO test (id, name) VALUES (1, "a")';

        expect(dbAPI.adaptQuery(query1, false)).toBe(query1);
        expect(dbAPI.adaptQuery(query2, false)).toBe(query2);
        expect(dbAPI.adaptQuery(query3, false)).toBe(query3);
    });
});
