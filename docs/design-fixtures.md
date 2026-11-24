# Crucible Hub design fixtures

Fixtures are deterministic, contract-shaped data for components, routes, and browser tests without an authenticated API. They are not a second domain model, an authorization engine, or a production fallback. [api-integration.md](api-integration.md#pinned-contract) owns the contract and how it is refreshed; [design-system.md](design-system.md) owns visual rules.

## Rules

- Type fixtures with the generated OpenAPI types (`satisfies` or explicit schema types), so a contract change fails type checking. Repair fixtures without casts or invented fields.
- Use synthetic identities, organizations, stable identifiers, and ISO timestamps, with coherent cross-resource relationships and deliberate null, omitted, minimal, and full representations. Scientific metadata only needs to be plausible for layout.
- Never use random values, the current time, network calls, environment-dependent content, real records, real storage paths, API keys, cookies, authorization codes, signed URLs, or upload capabilities.
- Capability values drive presentation as real responses do; they never change production authorization.
- Failures are scenario state around typed data with deterministic browser-safe messages, never invented API fields.

## Scenarios

`src/data/crucible/fixtures/demo-workspace.ts` holds the `operando-catalyst-study` workspace: synthetic people and a service account, a member project and a minimal discoverable project, an instrument, samples with varied visibility and metadata, related datasets, and files. The server adapter (`src/data/crucible/workspace-fixture.server.ts`) serves these scenarios:

| Scenario     | Coverage                                                               |
| ------------ | ---------------------------------------------------------------------- |
| `populated`  | Typical member workspace and permitted actions (default)               |
| `empty`      | Authenticated workspace without accessible content                     |
| `restricted` | Public-safe and minimal representations                                |
| `dense`      | Long values, full MFIDs, dense metadata, pagination, and relationships |
| `partial`    | Local failures beside independently usable content                     |
| `degraded`   | Failures, and every optional API feature switched off                  |

Dense fixtures apply instrument and project scope before cursor slicing and model assigned, shared, and unassigned resources explicitly, so collection, inspector, and permission-limited behavior is exercised without recreating API permission logic. Loading and refreshing are component state, not scenarios.

## Running fixtures

- `npm run dev:fixtures` starts the dev server on fixture data.
- `/hub/fixtures/scenarios` selects a scenario and keeps `scenario` in navigation; the scenario is part of the Query identity scope, so scenarios never share cache entries.
- `/hub/fixtures/design-system` shows theme roles, controls, statuses, identities, access roles, visibility, and loading, empty, restricted, partial, error, and dense specimens.
- Fixture routes are unlinked and `noindex`, and return 404 unless the server runs on fixture data.
- Fixtures are on outside production. In production they fail closed unless `HUB_ENABLE_FIXTURES=true`, which allows only `populated` and is never a real deployment setting.
- API calls are server-only, so browser tests substitute the server adapter rather than intercepting browser requests.
- `npm run test:e2e` runs the Playwright suite against fixtures on the production build without storing screenshots.
