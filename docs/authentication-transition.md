# Authentication Transition

Status: Active migration contract

Date: 2026-09-04

## Scope and current boundary

This document preserves independently testable Hub development during the API-owned login cutover and defines its production gate in [decision 0002](../decisions/0002-server-side-session-boundary.md). The temporary local API-key bridge is development infrastructure only. It must not shape feature APIs, reach browser code, or become production behavior. During this bridge, a browser-session `HttpOnly`, `SameSite=Lax` intent cookie may select the API's explicit global privilege mode. The cookie contains no credential, does not grant authority, and is still checked by the API against the configured human administrator credential on every elevated request. Production moves this intent into the authenticated server-side Hub session.

Fixtures are the default deterministic source. Local API mode is explicit: `HUB_DATA_SOURCE=api` with trusted `CRUCIBLE_API_BASE_URL` and a developer's own user-scoped `CRUCIBLE_API_KEY` in the Hub server environment. The key is read only by server-only code, is never `VITE_`-prefixed or returned through HTML, server functions, hydration, storage, URLs, logs, errors, or telemetry, and is applied only by the generated server client. API mode is rejected in production. Missing or invalid requested API configuration fails closed rather than falling back to fixtures.

Local ORCID mode is explicit: `HUB_DATA_SOURCE=hub-auth`, `CRUCIBLE_API_BASE_URL=https://127.0.0.1:7778/testapi`, and `HUB_AUTH_CLIENT_SECRET` in the Hub server environment. Set `NODE_EXTRA_CA_CERTS` to the local API's trusted certificate before starting Node; never disable certificate verification. The exact Hub callback is `http://127.0.0.1:3000/hub/auth/callback`, so start the Hub on that host and port. The registered ORCID callback belongs to the API, not the Hub. Keep the shared client secret out of git, browser configuration, command output, and chat. This local mode uses a process-local server-side session store, so restarting the Hub requires signing in again and multiple Hub processes cannot share sessions. It is disabled in production until a shared encrypted session store and key management are implemented and verified.

For local sign-in, fill the gitignored `.env.hub-auth.local` with the same client secret configured in the API, then run `set -a; . ./.env.hub-auth.local; set +a; npm run dev` from the Hub root. Do not run the old inline `HUB_DATA_SOURCE=api` command at the same time. Sourcing is required because the server reads unprefixed values from `process.env`, while [Vite's env files expose only prefixed values to application code](https://vite.dev/guide/env-and-mode); [Node reads `NODE_EXTRA_CA_CERTS` only when the process starts](https://nodejs.org/download/release/v22.23.0/docs/api/cli.html). The local file should remain private to its owner and must never be committed.

The Hub starts sign-in with random state and an S256 PKCE verifier stored for ten minutes on the server. The browser receives a short-lived, host-only, `HttpOnly`, `SameSite=Lax` transaction cookie and is redirected to the API login endpoint. The Hub callback consumes the transaction before a server-to-server code exchange, replaces any previous Hub session, and redirects to the validated Hub destination so the one-time code is absent from the destination URL. The browser keeps only an opaque session cookie scoped to `/hub`; its `Secure` attribute follows the request scheme for local HTTP and is required for production HTTPS. The server sends bearer authority and an explicit privilege mode to the API, coordinates refresh per session, and revokes the refresh token on sign-out. The API-key bridge remains available separately pending an end-to-end sign-in test.

The sign-in page uses the [unmodified official ORCID iD icon](https://orcid.org/assets/vectors/orcid.logo.icon.svg) and a full-page redirect, following [ORCID's OAuth sign-in guidance](https://info.orcid.org/documentation/integration-guide/orcid-oauth-sign-in-guidelines/). It explains the use of ORCID and links to ORCID without sending a Hub referrer. The attempted Hub path is validated as a same-origin `/hub/` destination, stored with the short-lived transaction, and restored after sign-in. The current account-profile response has no authenticated ORCID iD field, so the Hub cannot yet render a profile record link under [ORCID's iD display guidance](https://info.orcid.org/documentation/integration-guide/orcid-id-display-guidelines/).

Feature routes, Queries, mutations, and transient actions use browser-safe validated server functions and identity-scoped types. Fixtures and API adapters implement the same feature-facing contract. Read-only development and controlled local mutation proofs may proceed, but routine tests use fixtures and do not call live services. Production authentication and mutation exposure remain blocked until the shared session boundary and cutover evidence exist. The API-key bridge must not acquire refresh, rotation, persistence, impersonation, administrator exchange, or browser-login behavior. Contextual Administration uses dedicated elevated server adapters without changing the global intent cookie. The global Administrator view cookie lasts only for the browser session and is removed explicitly when the user returns to standard access.

Direct project membership is implemented in fixture and local API development through this seam. It adds existing users immediately, changes roles, removes members, or allows non-owner self-leave using confirmed server responses. There is no invitation workflow. It remains unavailable in production until the session-authentication gate is satisfied and deployment is approved.

## Stable feature seam

```mermaid
flowchart LR
    Route --> Query[identity-scoped Query]
    Query --> Read[validated server function]
    Action --> Write[validated mutation or transient function]
    Read --> Source[workspace source adapter]
    Write --> Source
    Source --> Fixture
    Source --> API[server-only Crucible client]
```

Mutations use Query for pending and error state and change server state only through validated functions. Signed download links and similar transient capabilities bypass Query ownership but not the authentication boundary. Cutover changes only how the server obtains user authority. It must not make routes, components, query keys, feature types, or generated operations credential-aware. After cutover, every private server function authenticates independently; route guards remain user experience, not authorization.

## Target contract

The browser starts login through Hub. Hub creates cryptographically random state and PKCE values, stores a short-lived transaction server-side, and redirects to the API-owned authorization entry. The API owns ORCID nonce handling and returns a short-lived, single-use authorization code to the allowlisted Hub callback. Hub validates the transaction and state, exchanges the code server to server for user authority, stores credential material and global privilege intent only in encrypted server-side session storage, rotates the session identifier, and sets an opaque `HttpOnly`, `Secure`, `SameSite=Lax` cookie. Private functions resolve that session and call the API as the signed-in user. Privilege activation rotates the session identifier, and expiration, deactivation, logout, account change, or server change removes elevated authority. Logout revokes the server session and clears the cookie. The browser never receives a reusable general API credential.

The pinned API contract now publishes the Hub authorization, token, refresh, and revoke operations, exact redirect registration, and PKCE requirements. End-to-end evidence must still verify code lifetime, single-use and replay behavior, account-disable semantics, safe errors, rate limits, and audit without credential disclosure across the intended environments. Hub does not use an administrator credential to obtain user keys.

Before production authentication, Hub must choose shared multi-replica session storage; encryption and signing-key handling and rotation; idle and absolute timeouts; concurrent-session policy; revocation behavior; cookie and proxy policy; same-origin and CSRF enforcement; redacted logging; and browser-safe error mapping. Session expiry and upstream authorization failure are distinct states.

## Cutover and evidence

1. Accept and pin the API exchange contract and OpenAPI update where applicable.
2. Record session storage and key-management decisions.
3. Implement server-only transaction, callback validation, code exchange, session creation and rotation, and logout.
4. Authenticate every private server function through shared middleware and resolve API authority from the request session.
5. Add login, callback, logout, expired-session, and unavailable-authentication states.
6. Replace the active Query client whenever server, account, login, or credential identity changes. Include preview Back and Forward restoration in two-account tests.
7. Prove direct private-function enforcement and concurrent two-account server-session and cache isolation, then collect staging evidence.
8. Remove the local API-key bridge, its configuration, documentation, tests, and secret-scan allowances before enabling production authentication.

The production gate needs reviewable evidence of state mismatch, missing or expired transaction, replay, and PKCE rejection; exact redirect URI enforcement; session-ID rotation; deployed secure cookie attributes; direct-function authentication; same-origin and CSRF mutation protection; logout, expiry, revocation, disablement, and credential rotation; no credential material in browser artifacts, Query, storage, URLs, logs, telemetry, or screenshots; two-account isolation; multi-replica sessions and key rotation; safe API unavailability behavior; and secret-free audit and correlation. The accepted design requires a repository-grounded threat model before production use.

Rollback disables production login and invalidates affected sessions. It never restores process-level API-key mode in production. Fixtures remain available only for permitted controlled development and runtime verification, and local API mode remains separately guarded during a staged cutover.

Migration completes only after normal operation no longer selects `HUB_DATA_SOURCE=api`, `CRUCIBLE_API_KEY` is not a Hub authentication mechanism, bridge-specific documentation, tests, errors, and secret-scan allowances are removed, and roadmap evidence no longer marks the API exchange or session boundary blocked. Fixtures remain test and design data, never authentication fallback.

`crucible-api` owns issuance, user-authority semantics, credential lifecycle, renewal, and revocation. Hub owns login orchestration, sessions, cookie policy, private-function authentication, Query-client isolation, and safe browser errors. Deployment operations own HTTPS termination, proxy trust, session-store availability, and key management. A cross-boundary change updates the API artifact, decision, integration documentation, tests, changelog, and roadmap evidence in the responsible repositories.
