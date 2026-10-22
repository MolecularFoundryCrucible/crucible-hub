# 0033: Use Existing Cloud SQL for Shared Hub Sessions

Status: Accepted

Date: 2026-09-28

Updated: 2026-10-22

Supersedes [decision 0032](0032-use-shared-redis-sessions.md) for the shared session store. The process-local pilot in that decision remains unchanged.

## Context

The API already uses Cloud SQL for PostgreSQL to persist Hub token families, access-token hashes, refresh-token hashes, login transactions, and one-time handoff codes. Its `/auth/hub` contract issues, refreshes, and revokes tokens, but does not map the Hub's opaque browser cookie to its current tokens or retain the Hub's PKCE verifier, return destination, idle timeout, or administrator intent. The Hub currently keeps that state in process memory or an optional encrypted Redis store. Process memory does not survive a restart and cannot coordinate refresh across replicas. Redis would require a new always-on service and private network configuration for a small initial Hub workload.

## Decision

Keep the limited single-instance pilot as implemented, with its documented risk of sign-out on restart or misrouting. Before requiring session continuity or raising the Cloud Run instance cap, implement a Hub-owned session store in a separate database or schema on the existing Cloud SQL PostgreSQL instance. Hub owns its tables, migrations, cleanup, and database role. The role can access only Hub session objects; it cannot read or write API domain or token tables. The API remains the authority for token issuance, refresh, revocation, and every resource request. Hub does not use the API database schema as a private interface or add a per-request API session-vault call.

The browser receives only a random opaque `HttpOnly`, `Secure`, `SameSite=Lax` cookie. Store a hash of the session identifier as the lookup key and encrypt token and login-transaction payloads with authenticated encryption and a versioned server-only key ring. Keep the eight-hour idle and twelve-hour absolute Hub session limits and enforce them on every read; scheduled deletion is cleanup, not the expiry control. Preserve one-time state consumption, callback cancellation, session-ID rotation when global administrator mode changes, and logout closure with atomic PostgreSQL operations. Store refresh claim ownership and a fencing value so one replica can call the API refresh route while others wait or reread the resulting session. Do not hold a database transaction open across that HTTP call. A lost or uncertain refresh closes the affected session instead of reusing a potentially spent refresh token. Shared-store failure fails closed and never falls back to local sessions.

Connect from Cloud Run through a supported Cloud SQL connection method with a dedicated service identity and a small bounded connection pool. Prefer automatic IAM database authentication where the selected connection method supports it; otherwise keep the dedicated database credential in version-pinned Secret Manager and rotate it. Retain previous encryption keys for at least the maximum Hub session lifetime. Put expiry indexes on the session and transaction tables and run bounded cleanup under the Hub role. Review the existing instance's connection budget, load, storage, region, availability, backups, and migration privileges before provisioning the database objects. Keep Hub schema migrations separate from the API's Alembic revision gate and coordinate their rollout with API operators.

## Validation and rollout

Implement and verify the PostgreSQL store before changing `HUB_AUTH_SESSION_MODE` or the one-instance cap. Validate state replay and cancellation, callback creation, concurrent refresh on separate Hub instances, uncertain API refresh, session rotation, logout and revocation, idle and absolute expiry, key rotation, database outage, restart continuity, and browser/account isolation. Measure session lookup latency and database connections under expected concurrency. Roll from process memory to Cloud SQL with a fresh sign-in; do not attempt to migrate in-memory sessions. Update deployment settings and the production gate only after these checks pass.

## Consequences and alternatives

- This reuses the existing managed database instance and avoids a dedicated Redis service. It still incurs storage, connection, and query load, so it is not free and must fit alongside the API workload.
- Hub session availability now depends on Cloud SQL as well as the API. Separate objects and least-privilege database access prevent Hub from owning or querying API token records.
- The PostgreSQL store is implemented and is the only shared store. The earlier Redis implementation was never deployed and was removed on 2026-10-22, together with `HUB_SESSION_REDIS_URL` and `HUB_AUTH_SESSION_MODE=redis`.
- Firestore is a viable serverless store, but would add a new persistence service and a new transactional adapter. An API-owned browser-session endpoint would reuse API persistence but expand the API contract and introduce an additional session lookup boundary. Neither is selected for this rollout.

See [Cloud Run's Cloud SQL connection guidance](https://docs.cloud.google.com/sql/docs/postgres/connect-run) and [database connection guidance](https://docs.cloud.google.com/sql/docs/postgres/manage-connections).
