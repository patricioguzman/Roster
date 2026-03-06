## 2024-05-18 - [Parallelized Data Fetching]
**Learning:** The `/api/data` endpoint, which is the primary data loader for the frontend, fetches settings, stores, members, and shifts sequentially. For MySQL (which the app supports via connection pooling), this creates cumulative network latency.
**Action:** Use `Promise.all` to parallelize independent read queries, taking full advantage of MySQL connection pooling or offloading concurrent tasks cleanly in SQLite.
## 2025-02-12 - [Batch Insertion N+1 Query Anti-Pattern]
**Learning:** In the `/api/shifts/week` endpoint, saving multiple shifts triggered an independent `SELECT m.id ...` query for each shift to resolve the `member_id` from the `member_stores` relationship, creating a significant N+1 query performance bottleneck. Since a single member typically works multiple shifts a week, this resulted in numerous redundant database round-trips.
**Action:** Implemented a simple JavaScript dictionary (`memberCache`) to memoize database lookup results during the batch processing loop. Always use in-memory caching or bulk-fetch strategies when iteratively processing data that requires dependent lookups inside a loop.
