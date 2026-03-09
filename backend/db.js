const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

const isMysql = process.env.DB_TYPE === 'mysql';

let mysqlPool, sqliteDb;

if (isMysql) {
    mysqlPool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });
    console.log('Connected to MariaDB via Connection Pool.');
    initMysql();
} else {
    const dbPath = path.join(__dirname, '..', 'roster.sqlite');
    sqliteDb = new sqlite3.Database(dbPath, (err) => {
        if (err) console.error('Error opening local SQLite database', err.message);
        else {
            console.log('Connected to the local SQLite database.');
            initSqlite();
        }
    });
}

// Convert SQLite queries to MySQL syntax if needed
function adaptQuery(query, isMysqlFlag = isMysql) {
    if (isMysqlFlag) {
        query = query.replace(/AUTOINCREMENT/ig, 'AUTO_INCREMENT');
        query = query.replace(/INSERT OR REPLACE INTO/ig, 'REPLACE INTO');
        query = query.replace(/INSERT OR IGNORE INTO/ig, 'INSERT IGNORE INTO');
    }
    return query;
}

async function initMysql() {
    const queries = [
        `CREATE TABLE IF NOT EXISTS stores (id INTEGER PRIMARY KEY AUTO_INCREMENT, name VARCHAR(255) NOT NULL UNIQUE, max_hours DECIMAL(10,2) DEFAULT 0)`,
        `CREATE TABLE IF NOT EXISTS members (id INTEGER PRIMARY KEY AUTO_INCREMENT, name VARCHAR(255) NOT NULL, phone VARCHAR(100), email VARCHAR(255), base_rate DECIMAL(10,2) DEFAULT 33.19, employment_type VARCHAR(50) DEFAULT 'casual')`,
        `CREATE TABLE IF NOT EXISTS member_stores (member_id INTEGER NOT NULL, store_id INTEGER NOT NULL, PRIMARY KEY (member_id, store_id), FOREIGN KEY (member_id) REFERENCES members (id) ON DELETE CASCADE, FOREIGN KEY (store_id) REFERENCES stores (id) ON DELETE CASCADE)`,
        `CREATE TABLE IF NOT EXISTS settings (key_name VARCHAR(100) PRIMARY KEY, value VARCHAR(255))`,
        `CREATE TABLE IF NOT EXISTS shifts (id INTEGER PRIMARY KEY AUTO_INCREMENT, store_id INTEGER NOT NULL, member_id INTEGER NOT NULL, member_name VARCHAR(255), date VARCHAR(20) NOT NULL, start_time VARCHAR(20) NOT NULL, end_time VARCHAR(20) NOT NULL, duration DECIMAL(10,2) NOT NULL)`,
        `CREATE TABLE IF NOT EXISTS admins (id INTEGER PRIMARY KEY AUTO_INCREMENT, username VARCHAR(100) NOT NULL UNIQUE, password_hash VARCHAR(255) NOT NULL)`
    ];
    for (let q of queries) await mysqlPool.query(q);
    await checkAdmin(dbAPI);
}

function initSqlite() {
    sqliteDb.serialize(() => {
        sqliteDb.run(`CREATE TABLE IF NOT EXISTS stores (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, max_hours REAL DEFAULT 0)`);
        sqliteDb.run(`CREATE TABLE IF NOT EXISTS members (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, phone TEXT, email TEXT, base_rate REAL DEFAULT 33.19, employment_type TEXT DEFAULT 'casual')`);
        sqliteDb.run(`CREATE TABLE IF NOT EXISTS member_stores (member_id INTEGER NOT NULL, store_id INTEGER NOT NULL, PRIMARY KEY (member_id, store_id), FOREIGN KEY (member_id) REFERENCES members (id) ON DELETE CASCADE, FOREIGN KEY (store_id) REFERENCES stores (id) ON DELETE CASCADE)`);
        sqliteDb.run(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)`);
        sqliteDb.run(`CREATE TABLE IF NOT EXISTS shifts (id INTEGER PRIMARY KEY AUTOINCREMENT, store_id INTEGER NOT NULL, member_id INTEGER NOT NULL, member_name TEXT, date TEXT NOT NULL, start_time TEXT NOT NULL, end_time TEXT NOT NULL, duration REAL NOT NULL)`);
        sqliteDb.run(`CREATE TABLE IF NOT EXISTS admins (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL)`, () => {
            checkAdmin(dbAPI).catch(console.error);
        });
    });
}

async function checkAdmin(dbInterface) {
    const row = await dbInterface.get('SELECT * FROM admins WHERE username = ?', ['eli']);
    if (!row) {
        const hash = await bcrypt.hash('eli123', 10);
        await dbInterface.run('INSERT INTO admins (username, password_hash) VALUES (?, ?)', ['eli', hash]);
        console.log('Created default admin: eli / eli123');
    }
}

const dbAPI = {
    // Execute a query and return all rows
    query: async (sql, params = []) => {
        if (isMysql) {
            const [rows] = await mysqlPool.query(adaptQuery(sql), params);
            return rows;
        } else {
            return new Promise((resolve, reject) => {
                sqliteDb.all(adaptQuery(sql), params, (err, rows) => err ? reject(err) : resolve(rows));
            });
        }
    },
    // Execute a query and return the first row
    get: async (sql, params = []) => {
        if (isMysql) {
            const [rows] = await mysqlPool.query(adaptQuery(sql), params);
            return rows[0] || null;
        } else {
            return new Promise((resolve, reject) => {
                sqliteDb.get(adaptQuery(sql), params, (err, row) => err ? reject(err) : resolve(row || null));
            });
        }
    },
    // Execute an INSERT/UPDATE/DELETE and return { insertId, changes }
    run: async (sql, params = []) => {
        if (isMysql) {
            // Need to fix syntax issues for 'settings' table, 'key' is a reserved word in MySQL
            if (sql.includes('settings (key, value)') || sql.includes('UPDATE settings SET value = ? WHERE key = ?')) {
                sql = sql.replace('settings (key, value)', 'settings (key_name, value)');
                sql = sql.replace('WHERE key = ?', 'WHERE key_name = ?');
            }

            const [result] = await mysqlPool.query(adaptQuery(sql), params);
            return { insertId: result.insertId, changes: result.affectedRows };
        } else {
            return new Promise((resolve, reject) => {
                sqliteDb.run(adaptQuery(sql), params, function (err) {
                    if (err) reject(err);
                    else resolve({ insertId: this.lastID, changes: this.changes });
                });
            });
        }
    },
    // Execute multiple queries inside a transaction
    transaction: async (queriesCallback) => {
        if (isMysql) {
            const connection = await mysqlPool.getConnection();
            await connection.beginTransaction();
            try {
                // Return a special interface that binds queries to this specific connection
                const txAPI = {
                    query: async (s, p = []) => { const [rows] = await connection.query(adaptQuery(s), p); return rows; },
                    get: async (s, p = []) => { const [rows] = await connection.query(adaptQuery(s), p); return rows[0] || null; },
                    run: async (s, p = []) => {
                        if (s.includes('settings (key, value)')) s = s.replace('settings (key, value)', 'settings (key_name, value)');
                        const [res] = await connection.query(adaptQuery(s), p);
                        return { insertId: res.insertId, changes: res.affectedRows };
                    }
                };
                await queriesCallback(txAPI);
                await connection.commit();
            } catch (err) {
                await connection.rollback();
                throw err;
            } finally {
                connection.release();
            }
        } else {
            return new Promise(async (resolve, reject) => {
                sqliteDb.serialize(async () => {
                    try {
                        await dbAPI.run('BEGIN TRANSACTION');
                        await queriesCallback(dbAPI);
                        await dbAPI.run('COMMIT');
                        resolve();
                    } catch (err) {
                        await dbAPI.run('ROLLBACK').catch(() => { });
                        reject(err);
                    }
                });
            });
        }
    }
};

dbAPI.adaptQuery = adaptQuery;

module.exports = dbAPI;
