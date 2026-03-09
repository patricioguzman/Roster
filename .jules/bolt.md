## 2024-05-18 - Optimize member_stores inserts to avoid N+1 queries
**Learning:** Inserting into associative tables one-by-one via loops inside a transaction leads to O(N) database calls, which is a classic N+1 performance bottleneck.
**Action:** Always use chunked bulk insertion when creating multiple associative records at once (e.g. `INSERT INTO table (a, b) VALUES (?, ?), (?, ?)...`). This dramatically reduces the number of database roundtrips while respecting query size limits (by chunking).
