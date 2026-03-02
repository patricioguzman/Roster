const fs = require('fs');

const path = './public/index.html';
let content = fs.readFileSync(path, 'utf8');

// Remove data-translate="..."
content = content.replace(/\s*data-translate="[^"]*"/g, '');

// Remove data-translate-placeholder="..."
content = content.replace(/\s*data-translate-placeholder="[^"]*"/g, '');

fs.writeFileSync(path, content, 'utf8');
console.log('Removed data-translate tags');
