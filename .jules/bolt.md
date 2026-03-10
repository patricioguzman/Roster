## 2024-05-18 - [Parallelized Data Fetching]
**Learning:** The `/api/data` endpoint, which is the primary data loader for the frontend, fetches settings, stores, members, and shifts sequentially. For MySQL (which the app supports via connection pooling), this creates cumulative network latency.
**Action:** Use `Promise.all` to parallelize independent read queries, taking full advantage of MySQL connection pooling or offloading concurrent tasks cleanly in SQLite.
## 2025-02-17 - Resolving N+1 Database Writes with Bulk Inserts
**Learning:** In scenarios where multiple rows need to be inserted in a loop (e.g., updating a member's store associations), executing a separate `INSERT` query for each row introduces significant N+1 query overhead and latency, especially over network connections.
**Action:** Always prefer chunked bulk `INSERT` queries using mapped placeholders (e.g., `VALUES (?, ?), (?, ?)`) and flat arrays of arguments over individual loop executions. Ensure `Array.length > 0` validation to prevent syntax errors when no rows are provided.
