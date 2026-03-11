const https = require('https');

const loginPayload = JSON.stringify({ username: 'leon', password: 'leon123' });
console.log('Starting remote HTTPS test against the currently running server...');

const req = https.request({
  hostname: 'roster.bypat.com.au',
  port: 443, 
  path: '/api/auth/login',
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': loginPayload.length }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
        const { token } = JSON.parse(data);
        console.log('Login successful, fetching Fortnightly Report...');
        https.request({
          hostname: 'roster.bypat.com.au',
          port: 443,
          path: '/api/exports/fortnightly-report?startDate=2026-03-09&endDate=2026-03-22',
          method: 'GET',
          headers: { 'Authorization': 'Bearer ' + token }
        }, (res2) => {
          let b = 0;
          res2.on('data', c => { b += c.length; });
          res2.on('end', () => {
             console.log('Export Status:', res2.statusCode);
             console.log('Export Bytes Returned:', b);
             if (b < 200) console.log('Possible empty response.');
          });
        }).end();
    } catch(e) { console.error('Token Err. Data received:', data.substring(0, 100)); }
  });
});
req.write(loginPayload);
req.end();
