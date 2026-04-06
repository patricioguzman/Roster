## 2024-05-18 - Promise.all Optimization in /api/data

**Learning:** When parallelizing independent database queries using `Promise.all` in Express routes like `/api/data`, ensuring sequential resolution of authentication dependencies (e.g. `allowedStoreIds` computed from `user.role` and `user.id`) first is critical, as later logic maps store ids to the authenticated user. In this application, concurrent queries should still fallback gracefully (e.g. `catch(() => [])` for `manager_stores`) to avoid breaking the entire dataset.

**Action:** Always map dependencies cleanly so that user authentication remains fully sequential and synchronous/blocking prior to kicking off concurrent batch queries for independent relational data. Ensure fallback handlers exist for non-critical query sets within the `Promise.all` block.
