# Contributing to Crucible Hub

Read [`AGENTS.md`](AGENTS.md) for the architecture invariants and the documents that own each area, then the documents relevant to your change.

## Setup

Use Node.js 22.22 and npm 10.9; `package-lock.json` is authoritative, so do not add another package manager's lockfile.

```bash
npm ci
npm run dev:fixtures
```

The dev server serves <http://127.0.0.1:3000/hub/> on a strict port. `HUB_DATA_SOURCE` has no default, so plain `npm run dev` shows a configuration error; use one of the scenarios below. Install Chromium once with `npx playwright install chromium` before running browser tests.

## Development scenarios

Each `npm run dev:<scenario>` script loads nonsecret settings from [`config/env/`](config/env/), clears settings left over from other scenarios, and gives credentials only to the server process.

| Scenario                                           | Data source                                 | Credential file (gitignored)                            |
| -------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------- |
| `dev:fixtures`                                     | Built-in demo data                          | None                                                    |
| `dev:api-local`, `dev:api-staging`, `dev:api-main` | A live API, acting as you with your API key | `.env.api-<name>.local` with `CRUCIBLE_API_KEY`         |
| `dev:orcid-local`, `dev:orcid-staging`             | A live API through Hub sign-in              | `.env.orcid-<name>.local` with `HUB_AUTH_CLIENT_SECRET` |

API-key scenarios are the quickest way to develop against real data. The server sends every request as you, so they can change real records: use test resources and staging for workflow testing, and use `dev:api-main` only when you mean to work against production data. They do not exercise sign-in, session cookies, or logout, and they refuse to run in production. An exported `CRUCIBLE_API_KEY` or `.env.api-key.local` works as a fallback.

Sign-in scenarios exercise the real login, session, and logout flow. `dev:orcid-local` also reads `HUB_AUTH_PUBLIC_API_URL` and `HUB_AUTH_CALLBACK_URI` from `.env.orcid-local.local`; the API must allow that exact callback. To reach a dev server through another host name, set `HUB_DEV_ALLOWED_HOSTS` (comma-separated) in a gitignored `.env.local`. For a local HTTPS API, set `NODE_EXTRA_CA_CERTS` before Node starts. [Authentication](docs/authentication.md) describes every setting.

Never give a credential a `VITE_` prefix, enter it in the browser, expose it to browser code or storage, print it, or commit a local credential file.

## Pull requests

- Branch from `main` and open a pull request back to `main`; nothing is committed to `main` directly. CI must pass before merging.
- Keep each pull request focused, and prefer supported framework mechanisms, generated contract types, server-only credentials, TanStack Query for server state, semantic design tokens, and shared domain components.
- Add tests for deterministic logic and changed failure or recovery paths.
- Update the document that owns the changed behavior, and add a decision record in [`decisions/`](decisions/README.md) for a durable architectural choice.
- Run `npm run validate` before asking for review.
- Dependabot opens one grouped pull request a month for npm minor and patch updates, separate ones for major updates, and one for GitHub Actions, each a week after the release. Review them like any other change.

## Changelog

Add one short `Unreleased` bullet to [`CHANGELOG.md`](CHANGELOG.md) for user, operator, contributor, privacy, security, contract, deployment, configuration, migration, or supported-workflow changes. State what changed in a single sentence without implementation detail, and fold related visual changes into one bullet. Planning, internal refactors, tests alone, formatting, and documentation corrections need no entry. `npm run release` stamps the changelog and tags `vX.Y.Z`; [releases](docs/releases.md) covers what happens next.

## Documentation style

Write each Markdown paragraph or list item on one unwrapped line. Use no emojis or em dashes. Document the current system: history belongs in git and the changelog. Decision records are the exception: they are historical, so change only their status and links, and supersede one with a new record instead of rewriting it. Each fact has one owning document; link to it instead of repeating it. Never include credentials, signed URLs, private keys, secret paths, or sensitive production identifiers.

## Commands

| Command                                    | Purpose                                                                                                           |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `npm run validate`                         | Full gate: formatting, lint, types, unused code, unit tests, contract, boundary, tokens, docs, secrets, and build |
| `npm run validate:static`                  | The same checks without the production build                                                                      |
| `npm run test:browser`                     | Chromium smoke, responsive, theme, workflow, and accessibility checks                                             |
| `npm run test:production`                  | Production build, Node runtime, `/hub` paths, health, shutdown, and server-function checks                        |
| `npm run api:fetch -- vX.Y.Z`              | Pin a published API release: download and verify its contract, update the lock, regenerate types                  |
| `npm run api:generate`                     | Regenerate TypeScript from the pinned contract                                                                    |
| `npm run api:check`                        | Verify the contract digest and that generated output is current                                                   |
| `npm run boundary:check`                   | Verify browser-reachable code cannot import server-only modules                                                   |
| `npm run unused:check`                     | Find unused files, exports, and dependencies with knip                                                            |
| `npm run docs:check`                       | Verify local documentation links and heading anchors                                                              |
| `npm run secrets:check`                    | Scan for credentials and secret-like values                                                                       |
| `npm run skills:load -- <package>#<skill>` | Load an installed TanStack agent skill                                                                            |
| `npm run skills:stale`                     | Report stale TanStack skill sources                                                                               |
| `npm run audit`                            | Fail on high or critical npm advisories                                                                           |
| `npm run release`                          | Stamp `CHANGELOG.md`, commit, and tag `vX.Y.Z`                                                                    |

CI runs `validate:static`, the npm audit, and the skill check in one job, and `test:production` in a parallel job. `test:browser` runs on the weekly schedule and on manual dispatch, with one worker and no retries so shared fixtures stay deterministic. Browser specs use [`tests/fixtures.ts`](tests/fixtures.ts), which fails a test on any uncaught page error.

## Visual and runtime review

For visual changes, check affected routes in light and dark themes, at narrow widths, and with browser zoom: enlarged text, available controls, visible focus, and no unnecessary horizontal scrolling. Keep screenshots out of the repository.

After Dockerfile, runtime, dependency, or deployment-path changes, run the disposable non-root container check:

```bash
docker build -t crucible-hub:check .
docker run -d --rm --name crucible-hub-check -e HUB_ENABLE_FIXTURES=true -p 127.0.0.1:4175:3000 crucible-hub:check
docker inspect --format '{{.Config.User}} {{.State.Health.Status}}' crucible-hub-check
curl -fsS http://127.0.0.1:4175/hub/health
curl -fsS http://127.0.0.1:4175/hub/data >/dev/null
docker stop -t 7 crucible-hub-check
```

Expect `node healthy` and `{"status":"ok"}`. Never enable fixtures in a real deployment.
