// Convert SQLite queries to MySQL syntax if needed
function adaptQuery(query, isMysql) {
    if (isMysql) {
        query = query.replace(/AUTOINCREMENT/ig, 'AUTO_INCREMENT');
        query = query.replace(/INSERT OR REPLACE INTO/ig, 'REPLACE INTO');
        query = query.replace(/INSERT OR IGNORE INTO/ig, 'INSERT IGNORE INTO');
    }
    return query;
}

module.exports = { adaptQuery };
