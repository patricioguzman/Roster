const mysql = require('mysql2/promise');

async function testConnection() {
    try {
        const connection = await mysql.createConnection({
            host: '178.32.171.58',
            user: 'roster', // Trying the new user provided
            password: '8qlq0^Od6YsjbR?x',
            database: 'astromedia_roster',
            port: 3306
        });
        console.log('Successfully connected to astromedia_roster as user roster!');
        const [rows] = await connection.execute('SHOW TABLES');
        console.log('Tables:', rows);
        await connection.end();
    } catch (err) {
        console.error('Failed to connect:', err.message);

        // Let's also try bypat_roster just in case cPanel prefixed it automatically
        console.log('Retrying with bypat_roster user...');
        try {
            const connection2 = await mysql.createConnection({
                host: '178.32.171.58',
                user: 'bypat_roster',
                password: '8qlq0^Od6YsjbR?x',
                database: 'astromedia_roster',
                port: 3306
            });
            console.log('Successfully connected to astromedia_roster as user bypat_roster!');
            await connection2.end();
        } catch (err2) {
            console.error('Also failed with bypat_roster:', err2.message);
        }
    }
}

testConnection();
