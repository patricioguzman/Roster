## 2024-05-18 - [Parallelized Data Fetching]
**Learning:** The `/api/data` endpoint, which is the primary data loader for the frontend, fetches settings, stores, members, and shifts sequentially. For MySQL (which the app supports via connection pooling), this creates cumulative network latency.
**Action:** Use `Promise.all` to parallelize independent read queries, taking full advantage of MySQL connection pooling or offloading concurrent tasks cleanly in SQLite.
## 2024-05-18 - [Bulk Insert N+1 Database Lookups]
**Learning:** In the `/api/shifts/week` endpoint, saving multiple shifts for the same employee triggered an N+1 query problem, repeating identical `SELECT m.id FROM members` queries for every shift object in the request array.
**Action:** Use an in-memory dictionary `memberCache` scoped to the request to memoize `(storeId, memberName)` lookups, dropping N repeated read queries down to just 1 per employee during batch processing.
