async function runTests() {
  const loginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'eli', password: 'eli123' })
  });
  const token = (await loginRes.json()).token;

  console.log("Logged in:", !!token);

  // Check data
  const dataRes = await fetch('http://localhost:3000/api/data', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await dataRes.json();
  console.log("Data success:", !!data.stores);

  // Check endpoint works
  const rosterExport = await fetch(`http://localhost:3000/api/export/roster/1/2023-01-01`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log("Export status:", rosterExport.status);
  process.exit(0);
}
runTests();
