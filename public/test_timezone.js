const d = new Date();
const melbourneDateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Melbourne', year: 'numeric', month: '2-digit', day: '2-digit' });
console.log("Raw formatter: ", melbourneDateFormatter.format(d));

const parts = new Intl.DateTimeFormat('en-AU', { 
    timeZone: 'Australia/Melbourne', 
    year: 'numeric', month: '2-digit', day: '2-digit' 
}).formatToParts(d);

const y = parts.find(p => p.type === 'year').value;
const m = parts.find(p => p.type === 'month').value;
const day = parts.find(p => p.type === 'day').value;
console.log("Extracted parts: ", `${y}-${m}-${day}`);
