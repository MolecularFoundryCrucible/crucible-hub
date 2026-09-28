# 0002: Use a Server-Side Hub Session Boundary

Status: Accepted

Date: 2026-09-02

## Context

The current Crucible API browser authentication flow exchanges a short-lived ORCID cookie for a long-lived API key returned to the caller. The current Explorer authenticates with ORCID, uses an administrative API credential to obtain a user's key, and stores that key in a Flask session.

Hub needs an authenticated browser experience without exposing a general Crucible API key to browser JavaScript, browser storage, logs, or telemetry. Normal Hub operation must not depend on a platform-administrator credential.

The final login exchange requires an API-owned contract that does not yet exist. [`docs/authentication-transition.md`](../docs/authentication-transition.md) defines how read-only Hub development proceeds without treating the local API-key bridge as authentication and records the eventual cutover requirements.

## Proposed decision

Use the Hub server as the exclusive credential boundary:

- The browser holds only an opaque session identifier in an `HttpOnly`, `Secure`, `SameSite=Lax` cookie.
- Session and credential material remain in encrypted server-side storage.
- Hub authenticates every private server function independently through shared middleware.
- Hub calls Crucible API with the signed-in user's authority.
- Login uses state, nonce, PKCE, a single-use authorization code, and an allowlisted redirect URI.
- Session identifiers rotate after authentication and privilege-relevant changes.
- Logout and credential rotation revoke affected server-side sessions.
- Mutations enforce same-origin and CSRF protection.

## Consequences

- A compromised non-HTTP browser script cannot directly read the user's general API key.
- Hub requires a stateful shared session service in production.
- Session encryption and signing keys need managed rotation.
- Hub replicas cannot rely on process-local session state.
- The API or identity layer must implement a supported one-time exchange for Hub.
- Hub authentication failures and API credential failures become distinct operational states.
- This design reduces credential exposure but does not remove the need for XSS prevention, CSRF protection, secure dependencies, and strict content security policy.

## Alternatives considered

### Store an API key in browser memory

Avoids a stateful Hub server but exposes a long-lived credential to browser JavaScript and complicates refresh, navigation, and recovery.

### Store an API key in a signed cookie

Signing protects integrity, not confidentiality. The browser still stores the credential, so this is not accepted as the production model.

### Use a permanent Hub administrator credential to obtain user keys

Matches part of the current Explorer flow but creates an unnecessarily powerful standing credential and broadens the impact of a Hub compromise.

### Proxy anonymous browser calls directly to the API

Does not solve user authentication or preserve user-scoped authorization.

## Required validation

- Agree on the API-owned one-time login exchange.
- Select the production session store and key-management mechanism.
- Define session duration, idle timeout, absolute timeout, rotation, revocation, and concurrent-session policy.
- Threat-model login CSRF, session fixation, XSS, replay, token theft, proxy headers, and logout.
- Verify account and cache isolation across two concurrent users.

## Ownership impact

Hub owns session behavior. `crucible-api` owns any new authorization exchange and user credential semantics. The cross-repository contract must be recorded and coordinated before implementation.
