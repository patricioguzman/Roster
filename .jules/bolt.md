## 2024-05-18 - [Parallelized Data Fetching]
**Learning:** The `/api/data` endpoint, which is the primary data loader for the frontend, fetches settings, stores, members, and shifts sequentially. For MySQL (which the app supports via connection pooling), this creates cumulative network latency.
**Action:** Use `Promise.all` to parallelize independent read queries, taking full advantage of MySQL connection pooling or offloading concurrent tasks cleanly in SQLite.
## 2024-05-24 - Bulk Insert vs N+1 DB Queries
**Learning:** Performing multiple individual `INSERT` or `UPDATE` queries in a loop creates an N+1 problem, incurring significant latency due to database round trips, even within a single transaction.
**Action:** Always favor bulk `INSERT` statements with placeholders (e.g., `VALUES (?, ?), (?, ?)`) constructed via `Array.prototype.map()` and `.join()` whenever inserting or updating a known collection of items simultaneously to maximize throughput.
