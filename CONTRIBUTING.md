# Contributing to Crucible Hub

Read [`AGENTS.md`](AGENTS.md) and the relevant authoritative documents it names before changing the repository. Keep changes focused and preserve unrelated work.

## Setup

Use Node.js 22.22 and npm 10.9. `package.json` defines supported ranges and `package-lock.json` is authoritative for installation.

```bash
npm ci
npm run dev
```

Development serves `http://127.0.0.1:3000/hub/` with strict port handling. Do not add another package-manager lockfile. Direct dependency changes require deliberate review of package and generated-skill changes.

Fixtures are the default data source. Use the [named development scenarios](README.md#quick-start) to select fixture, API-key, or ORCID mode and its local or staging API target. The temporary API bridge uses a user-scoped `CRUCIBLE_API_KEY` on the server process. Do not use a `VITE_` prefix, expose credentials to browser code or storage, print them, or commit them. API-key mode fails closed in production.

## Change workflow

Prefer supported framework mechanisms, generated contract types, server-only credentials, TanStack Query for browser server state, semantic design tokens, and shared domain components. Add tests for deterministic logic and changed failure or recovery paths. Update the authoritative product, architecture, design-system, API-integration, roadmap, or decision document when behavior changes.

Markdown prose and list items must remain unwrapped. Do not use emojis or em dashes. Do not include credentials, signed URLs, private keys, secret paths, or sensitive production identifiers. Check local links, trailing whitespace, terminology, and decision status.

Add an `Unreleased` changelog entry only for user, operator, contributor, privacy, security, downstream-contract, deployment, configuration, migration, or supported-workflow changes. Planning, internal refactors, tests alone, formatting, and documentation corrections do not require an entry.

## Canonical commands

| Command                                    | Purpose                                                                                                |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `npm run validate`                         | Full formatting, lint, type, unit, contract, boundary, token, link, secret, and production-build suite |
| `npm run validate:static`                  | The same static and unit checks without the production build                                           |
| `npm run test:browser`                     | Bounded Chromium smoke, responsive, theme, workflow, and accessibility checks used by CI               |
| `npm run test:production`                  | Production build, Node runtime, `/hub` paths, health, shutdown, and server-function checks             |
| `npm run api:generate`                     | Regenerate TypeScript from the pinned OpenAPI artifact                                                 |
| `npm run api:check`                        | Verify artifact digest and deterministic generated output                                              |
| `npm run boundary:check`                   | Verify browser-reachable code cannot import the server-only adapter                                    |
| `npm run docs:check`                       | Verify local documentation links                                                                       |
| `npm run secrets:check`                    | Scan for credentials and secret-like values                                                            |
| `npm run skills:list`                      | List allowlisted skills from installed TanStack packages                                               |
| `npm run skills:load -- <package>#<skill>` | Load an installed TanStack skill for the current task                                                  |
| `npm run skills:stale`                     | Report stale TanStack skill sources without updating them                                              |
| `npm run audit`                            | Fail on high or critical npm advisories                                                                |

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
