const mysql = require('mysql2/promise');

async function test() {
  const pool = mysql.createPool({
    host: '178.32.171.58',
    user: 'roster',
    password: '8qlq0^Od6YsjbR?x',
    database: 'astromedia_roster'
  });

  const [stores] = await pool.query('SELECT * FROM stores');
  console.log('Stores:', stores);

  const [members] = await pool.query(`
    SELECT m.*, GROUP_CONCAT(ms.store_id) as store_ids 
    FROM members m
    LEFT JOIN member_stores ms ON m.id = ms.member_id
    GROUP BY m.id
  `);
  console.log('Members:', members.map(m => ({name: m.name, store_ids: m.store_ids})));
  pool.end();
}
test().catch(console.error);
