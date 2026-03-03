async function runTests() {
  const loginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'eli', password: 'eli123' })
  });
  const token = (await loginRes.json()).token;

  // Let's check if the period is now closed
  const workedRes = await fetch(`http://localhost:3000/api/worked-hours/1/2023-01-01`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const workedData = await workedRes.json();
  console.log("Period info after closing:", workedData.period);

  const fnReport = await fetch(`http://localhost:3000/api/reports/fortnightly/2023-01-01`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log("Fortnight report status:", fnReport.status);

  const rosterExport = await fetch(`http://localhost:3000/api/export/roster/1/2023-01-01`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log("Roster export status:", rosterExport.status);

  process.exit(0);
}
runTests();
