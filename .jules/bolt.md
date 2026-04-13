## 2024-06-25 - Parallelizing Database Queries Requires Explicit Error Handling
**Learning:** When using `Promise.all` to parallelize database queries in `/api/data`, optional queries that might fail (like `manager_stores` if the table is missing or user lacks permissions) will reject the entire `Promise.all` array unless explicitly handled.
**Action:** Chain a `.catch(() => [])` directly onto the specific `db.query` promise inside the `Promise.all` array to provide a safe fallback and prevent the entire parallel block from failing due to one optional query.
