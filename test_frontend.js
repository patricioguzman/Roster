const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  try {
    console.log("Navigating to http://localhost:3000");
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

    console.log("Logging in as admin");
    await page.click('#loginBtn');
    await page.fill('#username', 'admin');
    await page.fill('#password', '65c4155ce33573fd'); // Update with generated password
    await page.click('button:has-text("Sign In")');
    await page.waitForTimeout(1000); // Wait for login and data load

    console.log("Opening Stores Modal to add a store");
    await page.click('#openSidebarBtn');
    await page.waitForTimeout(500);
    await page.click('#openStoresBtn');
    await page.waitForTimeout(500);

    console.log("Adding Store 'Test Store'");
    await page.fill('#storeName', 'Test Store');
    await page.fill('#storeMaxHours', '100');
    await page.click('#storeSubmitBtn');
    await page.waitForTimeout(1000); // wait for save

    // Close stores modal
    console.log("Closing Stores Modal");
    await page.click('#closeStoresModalBtn');
    await page.waitForTimeout(500);

    // Select the new store in the dropdown to close the "Select Store" overlay
    console.log("Selecting store from dropdown");
    await page.selectOption('#storeSelector', { label: 'Test Store' });
    await page.waitForTimeout(500);

    console.log("Opening Members Modal to add a member");
    await page.click('#openSidebarBtn');
    await page.waitForTimeout(500);
    await page.click('#openMembersBtn');
    await page.waitForTimeout(500);

    console.log("Adding Member 'Alice'");
    await page.fill('#memberName', 'Alice');

    // Check the box for Test Store
    const checkboxes = await page.$$('#memberStoresCheckboxes input[type="checkbox"]');
    if(checkboxes.length > 0) {
        await checkboxes[0].check();
    }
    await page.click('#memberSubmitBtn');
    await page.waitForTimeout(1000); // wait for save

    // Close the members modal to view the schedule grid
    await page.click('#closeMembersModalBtn');
    await page.waitForTimeout(500);


    console.log("Selecting Alice from the Staff Dropdown");
    await page.selectOption('#staffNameSelect', { label: 'Alice' });
    await page.waitForTimeout(500);

    console.log("Checking the first checkbox in the weekly editor");
    const editorCheckboxes = await page.$$('#weekly-editor-container input[type="checkbox"]');
    if (editorCheckboxes.length > 0) {
        await editorCheckboxes[0].check();
    }

    // Wait for the auto-save to trigger
    console.log("Waiting for shift auto-save");
    await page.waitForTimeout(2000);

    console.log("Taking screenshot of the calendar grid");
    await page.screenshot({ path: 'frontend_test_screenshot.png' });
    console.log("Screenshot saved as frontend_test_screenshot.png. Check the image to verify the shift appears on the grid.");

    console.log("Test completed successfully.");

  } catch (err) {
    console.error("Test failed:", err);
  } finally {
    await browser.close();
  }
})();
