// Utility function to convert SQLite queries to MySQL syntax
function adaptQueryForMysql(query) {
    if (typeof query !== 'string') return query;
    let adapted = query.replace(/AUTOINCREMENT/ig, 'AUTO_INCREMENT');
    adapted = adapted.replace(/INSERT OR REPLACE INTO/ig, 'REPLACE INTO');
    adapted = adapted.replace(/INSERT OR IGNORE INTO/ig, 'INSERT IGNORE INTO');
    return adapted;
}

module.exports = {
    adaptQueryForMysql
};
