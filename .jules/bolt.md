## 2024-05-18 - [Parallelized Data Fetching]
**Learning:** The `/api/data` endpoint, which is the primary data loader for the frontend, fetches settings, stores, members, and shifts sequentially. For MySQL (which the app supports via connection pooling), this creates cumulative network latency.
**Action:** Use `Promise.all` to parallelize independent read queries, taking full advantage of MySQL connection pooling or offloading concurrent tasks cleanly in SQLite.

## 2024-05-24 - Bulk DB Inserts vs Sequential execution
**Learning:** Sequential `await tx.run()` inside a loop incurs significant database roundtrip latency, especially for trivial data such as settings updates. For a payload of 100 settings, it sequentially hit the SQLite database 100 times, taking ~32-37ms. Optimizing this to use a single bulk parameterized query (`INSERT ... VALUES (?, ?), (?, ?)`) reduced the execution time to ~5-7ms, making the DB operation ~5-7x faster.
**Action:** Next time there is an iteration of updates or inserts, group the data into array matrices and utilize parameterized bulk queries. Ensure edge cases like empty arrays are appropriately handled to prevent SQL syntax errors.

## 2026-04-10 - Optimize Independent Database Queries and Memory Overhead via SQL Filtering
**Learning:** Found a significant backend performance bottleneck in `/api/data` where multiple independent database tables (settings, stores, members, manager_stores, shifts) were being queried sequentially using await, causing cumulative network latency. In addition, rows were being filtered in JS memory rather than at the database level which could lead to excessive memory consumption for large datasets.
**Action:** Applied `Promise.all` to group independent query promises, reducing response time. Shifted JS array `filter` operations to SQL `WHERE IN (...)` clauses for `stores` and `shifts` based on `allowedStoreIds` to minimize data transfer and memory overhead. Always verify if multiple `await db.query()` calls in the same block are independent and safely parallelizable.
