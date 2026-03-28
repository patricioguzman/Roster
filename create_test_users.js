const db = require('./backend/db');
const bcrypt = require('bcrypt');

async function createUsers() {
    console.log("Creating Test Users...");
    
    // Ensure admin user exists in admins table
    const adminPass = await bcrypt.hash('password', 10);
    const existingAdmin = await db.get("SELECT id FROM admins WHERE username = 'admin'");
    if (!existingAdmin) {
        await db.run("INSERT INTO admins (username, password_hash) VALUES (?, ?)", ['admin', adminPass]);
        console.log("✅ Admin created (admin / password)");
    } else {
        await db.run("UPDATE admins SET password_hash = ? WHERE username = 'admin'", [adminPass]);
        console.log("✅ Admin password reset to 'password'");
    }

    // Ensure store exists
    let store = await db.get("SELECT id FROM stores LIMIT 1");
    if (!store) {
        let res = await db.run("INSERT INTO stores (name, max_hours) VALUES (?, ?)", ['Test Store', 100]);
        store = { id: res.insertId };
        console.log("✅ Store created");
    }

    const memberPass = await bcrypt.hash('password', 10);

    // Ensure Manager exists in members table
    const existingManager = await db.get("SELECT id FROM members WHERE email = 'manager@example.com'");
    let managerId;
    if (!existingManager) {
        let res = await db.run("INSERT INTO members (name, email, role, employment_type, password_hash) VALUES (?, ?, ?, ?, ?)", 
        ['Test Manager', 'manager@example.com', 'manager', 'manager', memberPass]);
        managerId = res.insertId;
        console.log("✅ Manager created (manager@example.com / password)");
    } else {
        await db.run("UPDATE members SET password_hash = ?, role = 'manager' WHERE id = ?", [memberPass, existingManager.id]);
        managerId = existingManager.id;
        console.log("✅ Manager password reset to 'password'");
    }

    // Link manager to store
    await db.run("INSERT OR IGNORE INTO member_stores (member_id, store_id) VALUES (?, ?)", [managerId, store.id]);
    await db.run("INSERT OR IGNORE INTO manager_stores (member_id, store_id) VALUES (?, ?)", [managerId, store.id]);

    // Ensure Employee exists in members table
    const existingEmp = await db.get("SELECT id FROM members WHERE email = 'employee@example.com'");
    let empId;
    if (!existingEmp) {
        let res = await db.run("INSERT INTO members (name, email, role, employment_type, password_hash) VALUES (?, ?, ?, ?, ?)", 
        ['Test Employee', 'employee@example.com', 'employee', 'casual', memberPass]);
        empId = res.insertId;
        console.log("✅ Employee created (employee@example.com / password)");
    } else {
        await db.run("UPDATE members SET password_hash = ?, role = 'employee' WHERE id = ?", [memberPass, existingEmp.id]);
        empId = existingEmp.id;
        console.log("✅ Employee password reset to 'password'");
    }
    
    // Link employee to store
    await db.run("INSERT OR IGNORE INTO member_stores (member_id, store_id) VALUES (?, ?)", [empId, store.id]);

    console.log("Done!");
    process.exit(0);
}

createUsers().catch(console.error);
