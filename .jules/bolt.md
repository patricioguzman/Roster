## 2024-05-18 - [Parallelized Data Fetching]
**Learning:** The `/api/data` endpoint, which is the primary data loader for the frontend, fetches settings, stores, members, and shifts sequentially. For MySQL (which the app supports via connection pooling), this creates cumulative network latency.
**Action:** Use `Promise.all` to parallelize independent read queries, taking full advantage of MySQL connection pooling or offloading concurrent tasks cleanly in SQLite.
## 2024-05-18 - [Frontend O(N²) Loop Bottlenecks]
**Learning:** The frontend heavily relied on `Array.find()` inside nested loops (e.g., rendering `membersToRender` over multiple days, or exporting to PDF). Because the data is not paginated, this created O(N²) scaling issues that would lock up the UI thread with large numbers of employees and shifts.
**Action:** When searching an array inside a loop, pre-compute a hash map (dictionary) of the array items using composite keys (like `name_date`) for O(1) lookups.
