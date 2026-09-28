# 0032: Use Shared Redis Sessions When Scaling Hub Authentication

Status: Accepted

Date: 2026-09-28

## Context

The local ORCID flow uses process-local maps for login transactions, sessions, and refresh coordination. Multiple Hub replicas cannot safely share those maps, and a second refresh with the same rotating token may trigger API replay detection. The initial production rollout is a limited user pilot on one Cloud Run instance; preserving sessions across restarts is not required for that pilot.

## Decision

Defer Redis for the limited pilot. Configure Cloud Run with one minimum and one maximum instance and best-effort session affinity, and keep access and refresh tokens only in server memory. Cloud Run can briefly exceed the maximum during replacement or scaling, and affinity cannot guarantee a request reaches the instance holding its session. An instance restart, replacement, deployment, or request routed to a different instance may require the user to sign in again. The pilot requires explicit `HUB_AUTH_SESSION_MODE=single-instance` and `HUB_AUTH_PRODUCTION_ENABLED=true`; no Redis configuration may be present. Do not silently fall back from Redis to process-local sessions or use browser-held credentials.

Before raising the maximum instance count or requiring sessions to survive restarts, use a single-shard managed Redis service for Hub session state. The browser still receives only a random opaque cookie; Redis keys contain hashes of random identifiers, and records containing API tokens or PKCE verifiers use AES-256-GCM authenticated encryption. A managed key ring allows new writes with the first key and reads with retained older keys. Short-lived transactions are consumed once. Atomic Redis operations claim refresh, rotate session IDs when global administrator mode changes, and close sessions on logout. A claimed refresh is never retried with the same token after an uncertain result; the affected session ends and requires sign-in. Shared-store failure fails closed.

Sessions have an eight-hour idle limit and a twelve-hour absolute limit in either mode. Pilot activation requires HTTPS, explicit process-local mode, the Cloud Run instance cap and affinity, managed client credentials, and the browser and security evidence in [authentication transition](../docs/authentication-transition.md). The production activation setting remains off until that evidence is complete. Redis activation additionally requires a trusted TLS connection, managed session keys, and multi-replica evidence.

## Future Redis deployment

Start with a single-shard Memorystore for Redis Standard Tier instance in the Hub's Cloud Run region. One GiB is an initial capacity estimate, not a measured requirement. Use Redis 6.2 or newer, private networking through Direct VPC egress, Redis authentication, and server-authenticated TLS. Store the Redis URL and Hub encryption key ring as server-only, version-pinned managed secrets accessible to the dedicated Hub service identity. Trust the provider CA without disabling certificate verification. Retain previous encryption keys for at least the twelve-hour absolute session lifetime.

Validate login, refresh races, logout, expiry, key rotation, Redis failure, and recovery across at least two Hub instances before lifting the one-instance cap. Monitor memory, connections, errors, and session failures; size the instance from measured use. Redis Cluster is not a drop-in upgrade because the current atomic operations span keys. Redis has a continuous capacity charge even when the Hub is idle, so obtain a current price estimate and provisioning approval at that transition.

## Consequences

- The pilot may lose active sessions and pending sign-ins when its instance is replaced or a request reaches another instance; deployments require users to sign in again.
- With Redis, a callback or authenticated request can reach any Hub replica.
- Tokens stay server-side, and browser cookies never contain them. The current process-local mode keeps only non-authoritative administrator intent in a browser cookie; shared mode keeps that intent in the server session.
- Redis availability and key management become dependencies when shared sessions are activated.
- A crashed or timed-out refresh may require the user to sign in again, avoiding reuse of an uncertain rotating token.
- Redis Cluster is not supported by the current multi-key atomic operations.
- Moving from the pilot to Redis invalidates process-local sessions; schedule the cutover with a fresh sign-in and no expectation of seamless session migration.

## Alternatives

Sticky routing does not survive a replica restart or failover and does not coordinate concurrent refresh across replicas. A browser-held encrypted token does not provide atomic revocation or refresh coordination. A relational session store could provide comparable guarantees but would add database operations to every Hub request and is not selected for the scaled deployment.
