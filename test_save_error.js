const jwt = require('jsonwebtoken');
const token = jwt.sign({ id: 1, username: 'eli' }, 'roster-secret-key-123', { expiresIn: '12h' });

async function run() {
    const putRes = await fetch('http://localhost:3000/api/stores/2', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name: 'Northland', maxHours: '81' })
    });
    console.log('PUT status:', putRes.status);
    console.log('PUT body:', await putRes.text());
}
run();
