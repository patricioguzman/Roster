## 2024-05-18 - [Parallelized Data Fetching]
**Learning:** The `/api/data` endpoint, which is the primary data loader for the frontend, fetches settings, stores, members, and shifts sequentially. For MySQL (which the app supports via connection pooling), this creates cumulative network latency.
**Action:** Use `Promise.all` to parallelize independent read queries, taking full advantage of MySQL connection pooling or offloading concurrent tasks cleanly in SQLite.
## 2025-03-10 - Fix N+1 queries in member stores updates via bulk insertion
**Learning:** Inserting records inside a loop generates significant overhead (N+1 query problem). This is particularly noticeable even with small datasets (e.g., 50 records) in SQLite. Consolidating these into a single chunked bulk insert query `INSERT INTO ... VALUES (?,?), (?,?)` significantly reduces query compilation and round-trip execution time overhead.
**Action:** When inserting multiple related records from an array payload (like bridging tables), always reach for chunked bulk inserts (e.g., chunkSize = 100) instead of sequential loop inserts. Ensure edge cases like empty arrays are safely handled.
