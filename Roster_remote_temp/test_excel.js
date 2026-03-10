const ExcelJS = require('exceljs');
async function run() {
    const hours = [{ store_id: 1, member_id: 61, employee_name: 'elizabeth escudero', store_name: 'Northland', ordinary_hours: 48, saturday_hours: 0, sunday_hours: 0, ph_hours: 0, al_hours: 0, sl_hours: 0 }];

    const employeeTotals = {};
    const storeTotals = {};

    for (let h of hours) {
        // Employee Aggregate
        if (!employeeTotals[h.member_id]) {
            employeeTotals[h.member_id] = { Employee: h.employee_name, Ordinary: 0, Saturday: 0, Sunday: 0, PH: 0, AL: 0, SL: 0, Total: 0 };
        }
        const emp = employeeTotals[h.member_id];
        emp.Ordinary += h.ordinary_hours || 0;
        emp.Saturday += h.saturday_hours || 0;
        emp.Sunday += h.sunday_hours || 0;
        emp.PH += h.ph_hours || 0;
        emp.AL += h.al_hours || 0;
        emp.SL += h.sl_hours || 0;
        emp.Total += (h.ordinary_hours || 0) + (h.saturday_hours || 0) + (h.sunday_hours || 0) + (h.ph_hours || 0) + (h.al_hours || 0) + (h.sl_hours || 0);

        // Store Aggregate
        if (!storeTotals[h.store_id]) {
            storeTotals[h.store_id] = { Store: h.store_name, Ordinary: 0, Saturday: 0, Sunday: 0, PH: 0, AL: 0, SL: 0, 'Total Hours': 0 };
        }
        const st = storeTotals[h.store_id];
        st.Ordinary += h.ordinary_hours || 0;
        st.Saturday += h.saturday_hours || 0;
        st.Sunday += h.sunday_hours || 0;
        st.PH += h.ph_hours || 0;
        st.AL += h.al_hours || 0;
        st.SL += h.sl_hours || 0;
        st['Total Hours'] += (h.ordinary_hours || 0) + (h.saturday_hours || 0) + (h.sunday_hours || 0) + (h.ph_hours || 0) + (h.al_hours || 0) + (h.sl_hours || 0);
    }

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Fortnightly Report');
    const empHeaders = ['Employee', 'Ordinary', 'Saturday', 'Sunday', 'PH', 'AL', 'SL'];
    empHeaders.forEach((h, i) => { ws.getCell(3, 3 + i).value = h; });

    let r = 4;
    Object.values(employeeTotals).forEach(emp => {
        ws.getCell(r, 3).value = emp.Employee;
        ws.getCell(r, 4).value = emp.Ordinary;
        console.log(`Row ${r}: ${emp.Employee} - ${emp.Ordinary}`);
        r++;
    });

    await wb.xlsx.writeFile('test.xlsx');
    console.log("File test.xlsx saved");
}
run();
