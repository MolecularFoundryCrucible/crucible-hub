# Authentication and sessions

This document owns how the Hub chooses a data source, signs people in, stores sessions, and protects requests. [Decision 0002](../decisions/0002-server-side-session-boundary.md) records the server-side session boundary and [decision 0033](../decisions/0033-use-existing-cloud-sql-for-shared-hub-sessions.md) the Postgres store. Endpoint shapes belong to the pinned contract in [`contracts/`](../contracts/) and the generated types in `src/generated/`.

## Data sources

`HUB_DATA_SOURCE` has no default; an unset or unknown value fails closed with a configuration error and never falls back to fixtures.

| Value      | Use                            | Authority                                                            |
| ---------- | ------------------------------ | -------------------------------------------------------------------- |
| `hub-auth` | Deployments and sign-in work   | The signed-in person's OAuth tokens, held in the server session      |
| `api`      | Development against a live API | A developer's own user-scoped `CRUCIBLE_API_KEY`                     |
| `fixture`  | Design, tests, and demos       | Built-in demo data; production also needs `HUB_ENABLE_FIXTURES=true` |

Feature routes, Queries, and mutations call the same validated server functions in every mode; only the server adapter changes how it obtains authority. Routes, components, query keys, and feature types stay credential-unaware.

## Development scenarios

The `npm run dev:<scenario>` scripts (`scripts/dev-scenario.mjs`) load nonsecret settings from [`config/env/`](../config/env/) and pass credentials only to the server process, never through Vite's public variables. [`CONTRIBUTING.md`](../CONTRIBUTING.md#development-scenarios) lists the scenarios and the credential file each one reads.

### API-key mode

API-key mode is the supported way to run a dev server against a live API without setting up sign-in. The `dev:api-*` scripts set `HUB_DATA_SOURCE=api` and read the developer's own `CRUCIBLE_API_KEY`. The key is read only by server-only code, is applied only by the generated server client, and never reaches HTML, server-function responses, hydration, storage, URLs, logs, errors, or telemetry. The Hub acts as that person and can change real data, so prefer staging and use `dev:api-main` only deliberately. This mode does not exercise sign-in, session cookies, logout, or account setup, and it is refused when `NODE_ENV=production`. It must not grow refresh, rotation, persistence, impersonation, or browser-login behavior.

Without the Postgres store (API-key mode, fixtures, and development sign-in without a database), the Administrator view is a browser-session `HttpOnly`, `SameSite=Lax` intent cookie. It holds no credential and grants nothing: the API checks the caller's own authority on every elevated request. With the Postgres store the intent lives in the server session.

### Sign-in scenarios

`dev:orcid-local` and `dev:orcid-staging` exercise the real sign-in flow. The API must list the exact Hub callback among its allowed redirects, and each provider's own callback must be registered with that provider. For a local HTTPS API, set `NODE_EXTRA_CA_CERTS` to its certificate before Node starts; never disable certificate verification.

The callback origin must match the address in the browser exactly. `dev:orcid-staging` defaults to `http://localhost:3000/hub/auth/callback`; from another machine, forward the port with `ssh -L 3000:127.0.0.1:3000 <workstation>` and browse `http://localhost:3000/hub/`. To reach a workstation through a private HTTPS name such as Tailscale Serve, set `HUB_AUTH_PUBLIC_API_URL` and `HUB_AUTH_CALLBACK_URI` to that name in the scenario's gitignored `.env.orcid-*.local` file, register the same callback with the API, and, for uploads, allow the origin in the bucket CORS policy. A browser redirect to `127.0.0.1` reaches the browser's own device, not the Hub host, so a remote browser always needs one of these two approaches.

Without a session store, local sign-in keeps sessions in process memory, so a Hub restart signs everyone out.

## Settings

| Setting                         | Meaning                                                                                                                                                                                                             |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CRUCIBLE_API_BASE_URL`         | API base URL the Hub server calls. HTTPS, HTTP on a loopback host, or, with `HUB_API_ALLOW_HTTP=true`, HTTP to a container name or private address.                                                                 |
| `HUB_AUTH_PUBLIC_API_URL`       | API base URL browsers use for sign-in, when it differs from the server URL. HTTPS, or HTTP on a loopback host.                                                                                                      |
| `HUB_AUTH_CALLBACK_URI`         | Exact `/hub/auth/callback` URL; its origin is the public Hub origin. HTTPS, or HTTP on a loopback host. Defaults to `http://127.0.0.1:3000/hub/auth/callback`.                                                      |
| `HUB_AUTH_CLIENT_SECRET`        | Client secret shared with the API.                                                                                                                                                                                  |
| `HUB_AUTH_PRODUCTION_ENABLED`   | Must be `true` for sign-in when `NODE_ENV=production`.                                                                                                                                                              |
| `HUB_AUTH_SESSION_MODE`         | `postgres`, required in production.                                                                                                                                                                                 |
| `HUB_SESSION_KEYS`              | Session encryption key ring (see below).                                                                                                                                                                            |
| `HUB_SESSION_DATABASE_URL`      | Any Postgres database. `HUB_SESSION_DATABASE_PASSWORD` fills in a URL that names no password.                                                                                                                       |
| `HUB_SESSION_DATABASE_INSTANCE` | Cloud SQL instance connection name, used instead of a URL with `HUB_SESSION_DATABASE_PASSWORD`, `HUB_SESSION_DATABASE_NAME` (default `crucible_hub`), and `HUB_SESSION_DATABASE_USER` (default `crucible_hub_app`). |
| `HUB_TRUSTED_PROXY_HOPS`        | Proxies that append to `X-Forwarded-For` (default 1). The sign-in rate limit uses the entry that many places from the right; 0 uses the socket address.                                                             |

Cookies drop `Secure` only when the callback is plain HTTP on a loopback host. `HUB_AUTH_CLIENT_SECRET`, `HUB_SESSION_KEYS`, `HUB_SESSION_DATABASE_URL`, `HUB_SESSION_DATABASE_PASSWORD`, and `CRUCIBLE_API_KEY` are read from exactly one of the file named by `NAME_FILE`, `/run/secrets/NAME`, or the `NAME` variable, as the Crucible API does; the Hub refuses to start when one is given more than one way, and a blank value counts as unset. The session-store scripts follow the same rule. Keep these values in managed secrets, out of git, browser configuration, command output, and logs.

## Session store

The Postgres store keeps every record in `hub.session_entries` in the Hub-owned `crucible_hub` database. The Hub connects as `crucible_hub_app`, which can read and write rows but cannot change the schema. Migrations in `migrations/session-store` run as `crucible_hub_owner` through `scripts/migrate-session-store.mjs`; for a Hub-owned database, `scripts/setup-session-store.mjs` also creates both roles (the owner cannot sign in) and the `hub` schema from an administrator connection. The hosted pilot connects to Cloud SQL through the [Cloud SQL Node.js connector](https://github.com/GoogleCloudPlatform/cloud-sql-nodejs-connector); [self-hosting](../deploy/compose/README.md) runs its own PostgreSQL.

- Session records and login transactions use authenticated encryption under opaque, hashed keys, so the database holds no readable token. Expired rows are ignored on read and deleted in the background.
- `HUB_SESSION_KEYS` is a comma-separated ring of `id:<base64url 32-byte key>` entries. The first key encrypts; every listed key decrypts. Keep an old key for at least the 30-day absolute session lifetime when rotating.
- Sessions expire after 7 days idle or 30 days absolute, and the session cookie persists for the absolute lifetime. The Administrator view returns to standard access 12 hours after it is turned on.
- Refresh claims are atomic across instances and lapse after 30 seconds. A request that waits on another instance's refresh too long reports a retryable error and keeps the session. A lost or uncertain refresh closes the session rather than reusing a possibly spent token, except a `429`, which keeps the session and its current access token and waits for `Retry-After`.
- Callback consumption, cancellation, session creation, Administrator-view rotation, and logout are single statements or row-locked transactions. Store failures fail closed and never fall back to process memory or fixtures.
- `/hub/health` returns 503 while the store cannot read the session table.

## Sign-in

- The sign-in page lists `GET /auth/methods`: one button per method, with the ORCID mark only for a method flagged `is_orcid`. An empty or unreadable list shows a neutral Sign in button and lets the API choose.
- The Hub stores random state and an S256 PKCE verifier for ten minutes, sets a short-lived host-only `HttpOnly`, `SameSite=Lax` transaction cookie, and redirects to the API's `/oauth/authorize`. Sign-in is always a full-page redirect.
- The callback checks `state`, then requires `iss` to equal the public API URL (RFC 9207), consumes the transaction, exchanges the code at `/oauth/token` with HTTP Basic client authentication, replaces any previous session, and redirects to the validated `/hub/` destination on the public Hub origin so the code never appears in the final URL.
- A callback carrying `error` ends the transaction without an exchange: `login_required` shows the different-account page, `temporarily_unavailable` and `server_error` show an unavailable page, and anything else offers Try again. Logs record only allowlisted error values and categorized reasons, never codes, state, cookies, or tokens.
- The browser keeps only an opaque session cookie scoped to `/hub`. The server sends bearer authority and an explicit privilege mode, refreshes with the `refresh_token` grant once per session at a time, and revokes the refresh token on sign-out. Changing the Administrator view rotates the session ID.
- A signed-in account without a username goes to `/account/setup` first. Email is self-asserted, so Hub identifies people only by unique ID.

### Reauthentication

An API step-up challenge (`401` with `WWW-Authenticate` error `insufficient_user_authentication`) is not an expired session: the Hub neither refreshes nor ends the session and reports a reauthentication-required error. Actions wrapped in `withReauthentication` open a pop-up login with `max_age=0` and `required_user` set to the current account. The pop-up returns to `/hub/reauthenticated`, which announces completion on a same-origin `BroadcastChannel` and closes, and the action repeats once. If the browser blocks the pop-up, the dialog offers Sign in again, which falls back to a full-page login that does not resume the action or persist drafts. Because `required_user` passes through the browser unsigned, the Hub also checks that the returning account matches and that `auth_time` is no earlier than the start of that login (30 seconds of tolerance); otherwise it revokes the new tokens, keeps the existing session, and shows an error.

### Linked logins and approvals

The account page lists the person's logins from the API and hides the list when the API reports identity lookup is off. Adding a login needs a fresh sign-in, stores a ten-minute link transaction tied to the current session, uses `<public Hub origin>/hub/auth/link/callback` (which the API must also allow), and follows the API's returned address only if it is on the public API URL. The link is previewed and confirmed only for `available` and `already_yours` results. Removing a login needs a fresh sign-in, is disabled for the only login, and ends the person's other Hub sessions. In Administrator view, administrators can see and remove another person's logins (ending all of that person's sessions) but never add them, and can approve or reject accounts waiting for approval. A waiting account never receives a Hub session.

## Sign-out

Sign-out requires an exact `Origin` match with the public Hub origin and rejects missing, null, or foreign origins. It snapshots the refresh token, closes the local session without waiting for a pending refresh, cancels any pending login transaction, clears both auth cookies and the Administrator view, attempts revocation, and redirects to the sign-in page with a signed-out message or a warning that revocation could not be confirmed. A browser tab message sends other open Hub tabs to sign-in, and a session-identity check catches background tabs when they become visible or return from the back-forward cache. Neither writes identity data to browser storage. Signing out of the Hub does not end the provider's session.

## Request protection

- TanStack Start's CSRF middleware covers every non-safe request method, including server routes, and compares the browser origin with the public Hub origin in sign-in mode.
- Authenticated HTML uses `Cache-Control: private, no-store`, and private server functions set `no-store` independently.
- Request middleware in `src/start.ts` sets `Content-Security-Policy: frame-ancestors 'none'; base-uri 'self'; object-src 'none'`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and `Referrer-Policy: same-origin`. OAuth redirects use `Referrer-Policy: no-referrer` and `no-store`.
- Protected routes redirect to the standalone sign-in page when no session exists; the attempted path is validated as a same-origin `/hub/` destination and restored after sign-in.

A stricter script policy would need report-only validation against TanStack's SSR scripts and the theme initializer first.

## Ownership

`crucible-api` owns token issuance, user-authority semantics, credential lifecycle, refresh, and revocation. Hub owns login orchestration, sessions, cookie policy, private-function authentication, Query-client isolation, and safe browser errors. Deployment operations own HTTPS termination, proxy trust, session-store availability, and key management.
