## 2024-05-18 - [Parallelized Data Fetching]
**Learning:** The `/api/data` endpoint, which is the primary data loader for the frontend, fetches settings, stores, members, and shifts sequentially. For MySQL (which the app supports via connection pooling), this creates cumulative network latency.
**Action:** Use `Promise.all` to parallelize independent read queries, taking full advantage of MySQL connection pooling or offloading concurrent tasks cleanly in SQLite.

## 2024-10-27 - [O(N^2) Frontend Array Lookups in Loops]
**Learning:** Repeated `shifts.find(...)` array lookups inside nested loops during frontend grid rendering in Vanilla JavaScript are incredibly slow when dealing with large datasets of schedule shifts, creating an O(N^2) bottleneck. This is an application-specific pattern in Roster Manager due to how it loads all unpaginated shifts into `appData.shifts`.
**Action:** Always pre-compute a dictionary/hash map of shifts (e.g. keyed by `name_date` or grouped by `name`) before iterating over members and days to achieve O(1) lookups and significantly boost rendering performance.