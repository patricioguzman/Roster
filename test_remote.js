const http = require('http');

http.get('http://roster.bypat.com.au/api/data', (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    const json = JSON.parse(data);
    console.log("Stores:", json.stores);
    console.log("Members:", json.members.map(m => ({name: m.name, storeIds: m.storeIds})));
  });
}).on("error", (err) => {
  console.log("Error: " + err.message);
});
