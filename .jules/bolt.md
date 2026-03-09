## 2024-05-18 - [Parallelized Data Fetching]
**Learning:** The `/api/data` endpoint, which is the primary data loader for the frontend, fetches settings, stores, members, and shifts sequentially. For MySQL (which the app supports via connection pooling), this creates cumulative network latency.
**Action:** Use `Promise.all` to parallelize independent read queries, taking full advantage of MySQL connection pooling or offloading concurrent tasks cleanly in SQLite.
## 2024-05-24 - [N+1 Query Elimination in Database Writes]
**Learning:** Performing `SELECT` queries inside a loop while processing multiple incoming records (e.g., shifts) causes massive O(N) database operations, significantly slowing down write endpoints.
**Action:** When handling bulk inserts or updates, use an in-memory dictionary (cache) to resolve foreign keys or lookups, and execute the actual inserts in chunked batches (e.g., chunks of 100) to respect database parameter limits while minimizing transaction overhead.
