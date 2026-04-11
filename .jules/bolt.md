## 2024-05-24 - Parallelize Database Queries
**Learning:** In `backend/server.js`, the `/api/data` endpoint fetches settings, stores, members, and shifts sequentially. This causes a waterfall of database requests which slows down the response time, particularly with network latency.
**Action:** Use `Promise.all` to fetch independent data tables concurrently.

## 2024-05-24 - Parallelize Database Queries
**Learning:** In `backend/server.js`, the `/api/data` endpoint fetches settings, stores, members, and shifts sequentially. This causes a waterfall of database requests which slows down the response time, particularly with network latency.
**Action:** Use `Promise.all` to fetch independent data tables concurrently.
