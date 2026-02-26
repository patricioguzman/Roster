const mysql = require('mysql2/promise');

async function checkDb() {
    try {
        const mysqlPool = mysql.createPool({
            host: '178.32.171.58',
            user: 'roster',
            password: '8qlq0^Od6YsjbR?x',
            database: 'astromedia_roster',
        });

        const [stores] = await mysqlPool.query("SELECT * FROM stores");
        console.log("Stores:", stores.length);
        console.log(stores.slice(0, 2));

        const [shifts] = await mysqlPool.query("SELECT * FROM shifts");
        console.log("Shifts:", shifts.length);

        const [members] = await mysqlPool.query("SELECT * FROM members");
        console.log("Members:", members.length);

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
checkDb();
