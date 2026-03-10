## 2024-05-18 - [Parallelized Data Fetching]
**Learning:** The `/api/data` endpoint, which is the primary data loader for the frontend, fetches settings, stores, members, and shifts sequentially. For MySQL (which the app supports via connection pooling), this creates cumulative network latency.
**Action:** Use `Promise.all` to parallelize independent read queries, taking full advantage of MySQL connection pooling or offloading concurrent tasks cleanly in SQLite.
## 2024-05-18 - [Optimizing O(N²) Frontend Rendering Loops]
**Learning:** The frontend heavily relies on unpaginated data arrays (`shifts`), creating O(N²) bottlenecks during UI grid rendering and PDF export when using array search methods like `.find()` inside loops.
**Action:** Pre-compute hash maps (dictionaries) utilizing composite keys (e.g., `shift.name + '_' + shift.date`) before loops to achieve O(1) lookups and significantly reduce rendering latency for large datasets.
