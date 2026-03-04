const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
  await page.evaluate(async () => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'eli', password: 'eli123' })
    });
    const data = await res.json();
    localStorage.setItem('token', data.token);
    localStorage.setItem('userRole', data.role);
  });
  await page.reload({ waitUntil: 'networkidle0' });
  await page.evaluate(() => {
    document.getElementById('openWorkedHoursBtn').click();
  });
  await new Promise(r => setTimeout(r, 1000));
  await browser.close();
})();
