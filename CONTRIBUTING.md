# Contributing to Crucible Hub

Read [`AGENTS.md`](AGENTS.md) and the relevant authoritative documents it names before changing the repository. Keep changes focused and preserve unrelated work.

## Setup

Use Node.js 22.22 and npm 10.9. `package.json` defines supported ranges and `package-lock.json` is authoritative for installation.

```bash
npm ci
npm run dev:fixtures
```

Development serves `http://127.0.0.1:3000/hub/` with strict port handling. Do not add another package-manager lockfile. Direct dependency changes require deliberate review of package and generated-skill changes.

There is no default data source: `HUB_DATA_SOURCE` must be `fixture`, `api`, or `hub-auth`. Plain `npm run dev` therefore shows a configuration error; use one of the development scenarios below.

## Development scenarios

The [README](README.md#work-against-a-real-api) lists the scenarios. Each one is a `npm run dev:<scenario>` script that loads nonsecret API URLs and callback settings from [`config/env/`](config/env/), clears settings from other scenarios, and gives credentials only to the server process.

API-key scenarios (`dev:api-local`, `dev:api-staging`, `dev:api-main`) read a user-scoped `CRUCIBLE_API_KEY` from the matching gitignored `.env.api-*.local` file, for example `.env.api-staging.local`; `.env.api-key.local` or an exported shell variable is a fallback. The Hub server sends API requests as you, so these modes can perform real mutations: use test resources and the staging API for workflow testing, and run `dev:api-main` only when you explicitly intend to work against production data. API-key mode does not exercise ORCID sign-in, session cookies, or logout, and it fails closed in production.

ORCID scenarios (`dev:orcid-local`, `dev:orcid-staging`) exercise sign-in, sessions, and logout. They read `HUB_AUTH_CLIENT_SECRET` from the matching gitignored `.env.orcid-*.local` file; `.env.hub-auth.local` is a fallback. `dev:orcid-local` also reads `HUB_AUTH_PUBLIC_API_URL` and `HUB_AUTH_CALLBACK_URI` from `.env.orcid-local.local`, typically a private HTTPS name such as `https://<host>.<tailnet>.ts.net`, and allows that host in the dev server; the chosen API must register the exact callback and have its own ORCID callback registered. To reach a plain `npm run dev` server through another host name, set `HUB_DEV_ALLOWED_HOSTS` (comma-separated) in a gitignored `.env.local`. See [authentication transition](docs/authentication-transition.md) for the full setup. Deployed Hub settings are separate from local development.

For a local HTTPS API, set `NODE_EXTRA_CA_CERTS` to its trusted certificate before Node starts. Never use a `VITE_` prefix for credentials, enter them in the browser, expose them to browser code or storage, print them, or commit local credential files.

## Change workflow

Prefer supported framework mechanisms, generated contract types, server-only credentials, TanStack Query for browser server state, semantic design tokens, and shared domain components. Add tests for deterministic logic and changed failure or recovery paths. Update the authoritative product, architecture, design-system, API-integration, roadmap, or decision document when behavior changes.

Markdown prose and list items must remain unwrapped. Do not use emojis or em dashes. Do not include credentials, signed URLs, private keys, secret paths, or sensitive production identifiers. Check local links, trailing whitespace, terminology, and decision status.

Add one short, direct `Unreleased` changelog bullet only for user, operator, contributor, privacy, security, downstream-contract, deployment, configuration, migration, or supported-workflow changes; state what changed in a single concise sentence without implementation prose. Planning, internal refactors, tests alone, formatting, and documentation corrections do not require an entry.

## Canonical commands

| Command                                    | Purpose                                                                                                             |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `npm run validate`                         | Full formatting, lint, type, unused-code, unit, contract, boundary, token, link, secret, and production-build suite |
| `npm run validate:static`                  | The same static and unit checks without the production build                                                        |
| `npm run test:browser`                     | Bounded Chromium smoke, responsive, theme, workflow, and accessibility checks used by CI                            |
| `npm run test:production`                  | Production build, Node runtime, `/hub` paths, health, shutdown, and server-function checks                          |
| `npm run api:fetch -- vX.Y.Z`              | Pin a published API release: download and verify its contract asset, update the lock, regenerate                    |
| `npm run api:generate`                     | Regenerate TypeScript from the pinned OpenAPI artifact                                                              |
| `npm run api:check`                        | Verify artifact digest and deterministic generated output                                                           |
| `npm run boundary:check`                   | Verify browser-reachable code cannot import the server-only adapter                                                 |
| `npm run unused:check`                     | Find unused files, exports, and dependencies with knip (`knip.json`)                                                |
| `npm run docs:check`                       | Verify local documentation links                                                                                    |
| `npm run secrets:check`                    | Scan for credentials and secret-like values                                                                         |
| `npm run skills:list`                      | List allowlisted skills from installed TanStack packages                                                            |
| `npm run skills:load -- <package>#<skill>` | Load an installed TanStack skill for the current task                                                               |
| `npm run skills:stale`                     | Report stale TanStack skill sources without updating them                                                           |
| `npm run audit`                            | Fail on high or critical npm advisories                                                                             |
| `npm run release`                          | Stamp `CHANGELOG.md`, commit, and tag `vX.Y.Z` without invalidating lockfile caches                                 |

Install Chromium once with `npx playwright install chromium`. CI runs static and unit validation in parallel with one browser job that performs the functional gate, production build, and runtime checks. The bounded browser gate uses one worker without retries so shared server fixtures remain deterministic and failures remain visible. Browser and production specs use [`tests/fixtures.ts`](tests/fixtures.ts), whose automatic fixture fails tests on uncaught page errors.

## Visual and runtime review

Use targeted local screenshots and native desktop-browser zoom when a visual change needs review. Keep generated images out of the repository and CI. Check affected routes for enlarged text, available controls, visible focus, and unnecessary horizontal scrolling, then record durable evidence in [`docs/phase-0-evidence.md`](docs/phase-0-evidence.md) when required.

After Dockerfile, runtime, dependency, or deployment-path changes, run the disposable non-root container check:

```bash
docker build -t crucible-hub:phase0 .
docker run -d --rm --name crucible-hub-phase0-check -e HUB_ENABLE_FIXTURES=true -p 127.0.0.1:4175:3000 crucible-hub:phase0
docker inspect --format '{{.Config.User}} {{.State.Health.Status}}' crucible-hub-phase0-check
curl -fsS http://127.0.0.1:4175/hub/health
curl -fsS http://127.0.0.1:4175/hub/data >/dev/null
docker stop -t 7 crucible-hub-phase0-check
```

Expect `node healthy` and `{"status":"ok"}`. Do not enable fixtures in a real deployment.
