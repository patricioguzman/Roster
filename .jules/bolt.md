## 2024-05-18 - [Parallelized Data Fetching]
**Learning:** The `/api/data` endpoint, which is the primary data loader for the frontend, fetches settings, stores, members, and shifts sequentially. For MySQL (which the app supports via connection pooling), this creates cumulative network latency.
**Action:** Use `Promise.all` to parallelize independent read queries, taking full advantage of MySQL connection pooling or offloading concurrent tasks cleanly in SQLite.

## 2024-05-20 - [Optimized PDF Export Lookups]
**Learning:** Exporting PDF with many shifts and members caused significant browser lag because it repeatedly filtered the entire `shifts` array for each member and each day, resulting in O(M * S) complexity.
**Action:** Pre-compute hash maps (dictionaries) for O(1) lookups by composite keys (e.g., `name_date`) before entering nested loops to reduce complexity to O(M + S).