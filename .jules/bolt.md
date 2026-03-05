## 2024-05-18 - [Parallelized Data Fetching]
**Learning:** The `/api/data` endpoint, which is the primary data loader for the frontend, fetches settings, stores, members, and shifts sequentially. For MySQL (which the app supports via connection pooling), this creates cumulative network latency.
**Action:** Use `Promise.all` to parallelize independent read queries, taking full advantage of MySQL connection pooling or offloading concurrent tasks cleanly in SQLite.

## 2025-02-23 - [In-Memory Caching for N+1 Batch Queries]
**Learning:** In `backend/server.js`, processing multiple entries in the `/api/shifts/week` endpoint caused an N+1 query problem due to sequential execution of a `SELECT` statement looking up member IDs for every new shift item. Because the user might copy a schedule across many weeks or days for the same staff members, this lookup was redundant.
**Action:** Always employ an in-memory dictionary cache to memoize foreign key resolutions (like resolving member IDs from `name` and `storeId`) when iterating over batch insertions to avoid repeating database queries.