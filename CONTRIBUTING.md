# Contributing to Crucible Hub

Read [`AGENTS.md`](AGENTS.md), [`docs/product-brief.md`](docs/product-brief.md), [`docs/architecture.md`](docs/architecture.md), and relevant records under [`decisions/`](decisions/) before changing the repository. Keep changes focused, identify the authoritative document, and preserve unrelated work.

## Setup

Use Node.js 22.22 and npm 10.9. `package.json` defines supported ranges and `package-lock.json` is authoritative for installation.

```bash
npm ci
npm run dev
```

Development serves `http://127.0.0.1:3000/hub/` with strict port handling. Do not add another package-manager lockfile. Direct dependency changes require deliberate review of package and generated-skill changes.

Fixtures are the default data source. The temporary local API bridge uses `HUB_DATA_SOURCE=api`, `CRUCIBLE_API_BASE_URL`, and a user-scoped `CRUCIBLE_API_KEY` on the server process. Do not use a `VITE_` prefix, expose the key to browser code or storage, print it, or commit it. API-key mode fails closed in production.

## Change workflow

Prefer supported framework mechanisms, generated contract types, server-only credentials, TanStack Query for browser server state, semantic design tokens, and shared domain components. Add tests for deterministic logic and changed failure or recovery paths. Update the authoritative product, architecture, design-system, API-integration, roadmap, or decision document when behavior changes.

Markdown prose and list items must remain unwrapped. Do not use emojis or em dashes. Do not include credentials, signed URLs, private keys, secret paths, or sensitive production identifiers. Check local links, trailing whitespace, terminology, and decision status.

Add an `Unreleased` changelog entry only for user, operator, contributor, privacy, security, downstream-contract, deployment, configuration, migration, or supported-workflow changes. Planning, internal refactors, tests alone, formatting, and documentation corrections do not require an entry.

## Canonical commands

| Command                                    | Purpose                                                                                                |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `npm run validate`                         | Full formatting, lint, type, unit, contract, boundary, token, link, secret, and production-build suite |
| `npm run test:browser`                     | Chromium shell, responsive, theme, and accessibility checks                                            |
| `npm run test:visual`                      | Committed design-system, route-scenario, and project-inspector baselines                               |
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

Install Chromium once with `npx playwright install chromium`. CI runs the canonical suite. Browser and production specs use [`tests/fixtures.ts`](tests/fixtures.ts), whose automatic fixture fails tests on uncaught page errors.

## Visual and runtime review

After an intentional visual change, run `npm run test:visual:update`, inspect every affected image across themes, widths, and scenarios, and include the reviewed baselines. Never update snapshots to dismiss an unexplained difference.

Use native desktop-browser zoom for the required 200 percent review. Check Home, dense Data, restricted Projects, Instruments, populated Search, and a resource detail route for enlarged text, available controls, visible focus, and no unnecessary horizontal scrolling. Record evidence in [`docs/phase-0-evidence.md`](docs/phase-0-evidence.md).

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

## Skills and review handoff

Read [`skills/README.md`](skills/README.md) for skill lifecycle and routing. Do not update external skills silently. Review project-installed skill and lockfile changes before accepting them.

Before handoff, report scope completed, files changed, validation performed, changelog impact, unresolved decisions or blocked dependencies, and cross-repository consequences. Do not switch branches, push, publish, deploy, tag, release, or reset unrelated work.
