const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.production' });

const mysqlPool = mysql.createPool({
    host: '178.32.171.58',
    user: 'roster',
    password: process.env.DB_PASS,
    database: 'astromedia_roster',
    waitForConnections: true,
});

const staffData = [
    { fullName: "Tanisha Antaal", firstName: "Tanisha", phone: "0402705602", email: "Tanishaantaal220@gmail.com" },
    { fullName: "Harry Grant", firstName: "Harry", phone: "0411261693", email: "harrygrantjnr@gmail.com" },
    { fullName: "Teresa Carman", firstName: "Teresa", phone: "0421074714", email: "Teresacarman8@gmail.com" },
    { fullName: "Ashlyn Prakash", firstName: "Ashlyn", phone: "0451903033", email: "ashlynanisha@gmail.com" },
    { fullName: "Mia Chanel Hadchiti", firstName: "Mia", phone: "0422081092", email: "mhadchiti67@gmail.com" },
    { fullName: "Stacey Mendoza", firstName: "Stacey", phone: "0408133375", email: "smdenise_21@hotmail.com" },
    { fullName: "Aarav Jagasia", firstName: "Aarav", phone: "0493795037", email: "aaravjagasia@gmail.com" },
    { fullName: "Ricardos Hanna", firstName: "Ricardos", phone: "0489036009", email: "Hannarico67@gmail.com" },
    { fullName: "Chloe Ann Emmerton", firstName: "Chloe", phone: "0432559951", email: "chloesnowball@outlook.com" },
    { fullName: "Rehan Adeel", firstName: "Rehan", phone: "0451979053", email: "Rehan04227@gmail.com" },
    { fullName: "Syed Azeem Mohiuddin", firstName: "Syed", phone: "0411618377", email: "Syedazeem6967@gmail.com" },
    { fullName: "Will Mallon", firstName: "Will", phone: "0413315489", email: "willmallon07@gmail.com" },
    { fullName: "Joanna Mendez", firstName: "Johana", phone: "0432015060", email: "Joannapm16@gmail.com" },
    { fullName: "Brad Harvey", firstName: "Brad", phone: "0421842769", email: "Bradleyharvey87@outlook.com" }
];

async function run() {
    console.log("Starting member contacts update...");
    // Need a small timeout to let the DB pool connect if it takes time
    await new Promise(r => setTimeout(r, 1000));

    try {
        const [members] = await mysqlPool.query("SELECT id, name FROM members");
        console.log(`Found ${members.length} members in DB.`);

        for (let s of staffData) {
            // Find existing member by name or first name approximation
            // The JSON has full name and first name. The DB may just have the first name from older stuff.json
            let dbMember = members.find(m => m.name.toLowerCase() === s.fullName.toLowerCase() || m.name.toLowerCase() === s.firstName.toLowerCase());

            if (dbMember) {
                await mysqlPool.execute("UPDATE members SET phone = ?, email = ? WHERE id = ?", [s.phone, s.email, dbMember.id]);
                console.log(`Updated contact info for ${dbMember.name}`);
            } else {
                console.log(`Could not find a match for ${s.fullName} in the database. Inserting...`);
                await mysqlPool.execute("INSERT INTO members (name, phone, email, employment_type) VALUES (?, ?, ?, ?)", [s.fullName, s.phone, s.email, 'casual']);
                console.log(`Inserted ${s.fullName} with contact info`);
            }
        }
        console.log("Update Complete!");
    } catch (e) {
        console.error("Error:", e);
    }
    process.exit(0);
}

run();
