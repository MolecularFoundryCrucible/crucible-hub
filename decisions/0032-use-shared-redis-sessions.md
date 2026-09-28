# 0032: Use Shared Redis Sessions for Hub Authentication

Status: Accepted

Date: 2026-09-28

## Context

The local ORCID flow uses process-local maps for login transactions, sessions, and refresh coordination. Multiple Hub replicas cannot safely share those maps, and a second refresh with the same rotating token may trigger API replay detection.

## Decision

Use a single-shard managed Redis service for production Hub session state. The browser receives only a random opaque cookie; Redis keys contain hashes of random identifiers, and records containing API tokens or PKCE verifiers use AES-256-GCM authenticated encryption. A managed key ring allows new writes with the first key and reads with retained older keys. Short-lived transactions are consumed once. Atomic Redis operations claim refresh, rotate session IDs when global administrator mode changes, and close sessions on logout. A claimed refresh is never retried with the same token after an uncertain result; the affected session ends and requires sign-in. Shared-store failure fails closed. Local development may continue to use process-local state when shared storage is not configured.

Sessions have an eight-hour idle limit and a twelve-hour absolute limit. Production activation requires HTTPS, a TLS Redis connection, managed secrets, explicit configuration, and the browser and multi-replica evidence in [authentication transition](../docs/authentication-transition.md). The production activation setting remains off until that evidence is complete.

## Consequences

- A callback or authenticated request can reach any Hub replica.
- Tokens and privilege intent stay in server-side state, and browser cookies do not contain them.
- Redis availability and key management become production dependencies.
- A crashed or timed-out refresh may require the user to sign in again, avoiding reuse of an uncertain rotating token.
- Redis Cluster is not supported by the current multi-key atomic operations.

## Alternatives

Sticky routing does not survive a replica restart or failover and does not coordinate concurrent refresh across replicas. A browser-held encrypted token does not provide atomic revocation or refresh coordination. A relational session store could provide comparable guarantees but would add database operations to every Hub request and is not selected for this deployment.
