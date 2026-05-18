## 2024-05-18 - [Parallelized Data Fetching]
**Learning:** The `/api/data` endpoint, which is the primary data loader for the frontend, fetches settings, stores, members, and shifts sequentially. For MySQL (which the app supports via connection pooling), this creates cumulative network latency.
**Action:** Use `Promise.all` to parallelize independent read queries, taking full advantage of MySQL connection pooling or offloading concurrent tasks cleanly in SQLite.

## 2024-05-24 - Bulk DB Inserts vs Sequential execution
**Learning:** Sequential `await tx.run()` inside a loop incurs significant database roundtrip latency, especially for trivial data such as settings updates. For a payload of 100 settings, it sequentially hit the SQLite database 100 times, taking ~32-37ms. Optimizing this to use a single bulk parameterized query (`INSERT ... VALUES (?, ?), (?, ?)`) reduced the execution time to ~5-7ms, making the DB operation ~5-7x faster.
**Action:** Next time there is an iteration of updates or inserts, group the data into array matrices and utilize parameterized bulk queries. Ensure edge cases like empty arrays are appropriately handled to prevent SQL syntax errors.

## 2024-05-24 - N+1 database updates
**Learning:** Sequential `await tx.run()` calls when batch uploading worked hours arrays generated extreme overhead. Doing an insert of N items sequentially hits the DB N times across the network. A more performant approach uses flattened parameter arrays and single query executions `INSERT ... VALUES (?,?), (?,?)`.
**Action:** Next time when persisting arrays of data, use bulk/batch parameterized inserts in chunks (e.g. 50 items) instead of N+1 `for` loops to minimize database driver round trips.
