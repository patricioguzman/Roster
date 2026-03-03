const http = require('http');

async function runTests() {
  const loginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'eli', password: 'eli123' })
  });
  const loginData = await loginRes.json();
  const token = loginData.token;
  console.log("Login success:", !!token);

  const workedRes = await fetch(`http://localhost:3000/api/worked-hours/1/2023-01-01`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const workedData = await workedRes.json();
  console.log("Worked Hours GET res:", workedData);

  const postWorked = await fetch(`http://localhost:3000/api/worked-hours`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
        storeId: 1,
        startDate: '2023-01-01',
        entries: [{ employeeId: 1, ordinary: 8, saturday: 4 }]
    })
  });
  const postWorkedData = await postWorked.json();
  console.log("Worked Hours POST res:", postWorkedData);

  const weeklyReport = await fetch(`http://localhost:3000/api/reports/weekly/1/2023-01-01`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log("Weekly report status:", weeklyReport.status);

  const closeFortnight = await fetch(`http://localhost:3000/api/reports/close-fortnight`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ startDate: '2023-01-01', endDate: '2023-01-14' })
  });
  const closeFortnightData = await closeFortnight.json();
  console.log("Close Fortnight POST res:", closeFortnightData);

  process.exit(0);
}

runTests();
