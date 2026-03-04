const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  page.setViewport({ width: 1280, height: 800 });
  page.on('console', msg => console.log('LOG:', msg.text()));
  page.on('pageerror', err => console.log('ERR:', err.toString()));
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
    document.getElementById('openSidebarBtn').click();
  });
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: 'sidebar_open.png' });
  await page.evaluate(() => {
    document.getElementById('openWorkedHoursBtn').click();
  });
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: 'clicked_modal.png' });
  
  const modalHTML = await page.evaluate(() => {
      const modal = document.getElementById('workedHoursModal');
      return modal ? modal.outerHTML : "NULL";
  });
  console.log("MODAL HTML DUMP:");
  console.log(modalHTML);
  await browser.close();
})();
