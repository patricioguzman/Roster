const db = require('./db');

setTimeout(async () => {
    try {
        const adminCols = await db.query("PRAGMA table_info(admins)");
        console.log("Admins table columns:", adminCols.map(c => c.name));

        const whCols = await db.query("PRAGMA table_info(worked_hours)");
        console.log("Worked hours columns:", whCols.map(c => c.name));

        const rpCols = await db.query("PRAGMA table_info(reporting_periods)");
        console.log("Reporting periods columns:", rpCols.map(c => c.name));

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}, 1000);
