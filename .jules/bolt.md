## 2024-05-18 - [Parallelized Data Fetching]
**Learning:** The `/api/data` endpoint, which is the primary data loader for the frontend, fetches settings, stores, members, and shifts sequentially. For MySQL (which the app supports via connection pooling), this creates cumulative network latency.
**Action:** Use `Promise.all` to parallelize independent read queries, taking full advantage of MySQL connection pooling or offloading concurrent tasks cleanly in SQLite.
## 2024-05-18 - [N+1 DB Interactions in Schedule Saving]
**Learning:** Saving a large weekly roster previously resulted in severe N+1 transaction behavior on the `/api/shifts/week` endpoint, combining duplicate `SELECT` queries to find the member ID for each individual shift and then performing single `INSERT` actions.
**Action:** When handling a batch payload, introduce an in-memory dictionary cache (e.g., `memberCache`) for repeating lookups within the request, and use batched `INSERT INTO ... VALUES (), ()...` queries (respecting chunk size limits) rather than awaiting insertions individually.
