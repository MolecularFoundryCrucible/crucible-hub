# Crucible Hub Design Fixtures

Status: Active fixture contract

Date: 2026-09-16

## Scope and rules

Fixtures provide deterministic, contract-shaped design and test data while authenticated API access is unavailable. They support components, routes, browser tests, screenshots, and controlled failures. They are not a second domain model, authorization engine, or production fallback. [`api-integration.md`](api-integration.md) owns generated-contract and server-boundary rules; [`design-system.md`](design-system.md) owns visual requirements.

Fixture types use generated OpenAPI types from the reviewed pinned artifact with `satisfies` or explicit schema types. Contract changes must fail type checking. Use deterministic synthetic identities, organizations, stable identifiers, ISO timestamps, coherent cross-resource relationships, and intentional null, omitted, minimal, and full representations. Scientific metadata must be plausible for layout, not claimed scientific truth.

Never use random values, current time, network calls, environment-dependent content, staging or production records, real storage paths, API keys, cookies, authorization codes, signed URLs, or upload capabilities. Fixtures fail closed when unavailable. Capability values drive presentation as real API responses do and never change production authorization behavior.

## Scenarios and delivery

`operando-catalyst-study` is the populated demonstration workspace in `src/data/crucible/fixtures/demo-workspace.ts`. It contains synthetic people and a service account, a full member project, a minimal discoverable project, an active hard X-ray instrument, samples with varied visibility and metadata completeness, related spectroscopy, diffraction, and microscopy datasets, and deterministic files. It is intentionally small while covering dashboard, collections, project, resource, instrument, metadata, access, and file layouts.

The server adapter provides `populated`, `empty`, `restricted`, `dense`, `partial`, and `degraded` scenarios. The unlinked `/hub/fixtures/scenarios` route validates and retains `scenario` in application navigation, incorporating it into identity scope so scenarios cannot share Query entries. Only the populated scenario may be explicitly enabled for controlled production-mode preview; non-default scenarios are rejected in production. `/hub/fixtures/design-system` is an isolated deterministic surface for theme roles, focusable controls, semantic statuses, resource and principal identities, access roles, visibility, loading, empty, restricted, partial, terminal-error, and dense component specimens. Loading and refreshing are component state, not route timing.

| Scenario                | Required coverage                                                      |
| ----------------------- | ---------------------------------------------------------------------- |
| `populated`             | Typical member workspace and permitted actions                         |
| `empty`                 | Authenticated workspace without accessible content                     |
| `restricted`            | Public-safe and minimal representations                                |
| `loading`, `refreshing` | Deterministic skeleton and readable refresh states                     |
| `partial`, `degraded`   | Local failure with independently usable content                        |
| `dense`                 | Long values, full MFIDs, dense metadata, pagination, and relationships |

Failures are scenario state around typed data, never invented API fields. They return deterministic browser-safe messages only. Dense fixtures apply instrument and project scope filtering before cursor slicing; model assigned, shared, and unassigned resources explicitly; retain actual assignment separately from contextual relation; and use reciprocal, unavailable, and explicit-empty resource links. This exercises collection, inspector, history, and permission-limited behavior without recreating API permission logic.

| Layer             | Mechanism                                                | Purpose                                                    |
| ----------------- | -------------------------------------------------------- | ---------------------------------------------------------- |
| Domain fixture    | Typed immutable modules in `src/data/crucible/fixtures/` | Coherent records and scenarios                             |
| Component fixture | Explicit component props                                 | Stable visual and accessibility states                     |
| Server adapter    | Development-only Hub boundary adapter                    | Routes, Query, aborts, timeouts, and errors                |
| Browser fixture   | Controlled startup plus adapter                          | Navigation, URL state, screenshots, and identity isolation |

Do not rely only on browser interception because API calls are server-only. Substitute the narrow server adapter or its fetch implementation instead. Fixtures are enabled outside production and fail closed in production. `HUB_ENABLE_FIXTURES=true` permits only populated controlled previews and is never a real deployment setting.

Fixture routes are unlinked and `noindex`. The bounded Playwright gate checks representative account, deletion, download, shell, theme, accessibility, responsive collection, scenario-retention, and text-spacing behavior without storing screenshots. Targeted local screenshots, native zoom, additional route combinations, and manual assistive-technology checks remain separate review evidence.

## Contract refresh

Obtain a deterministic artifact from an identified API revision, compare it with `contracts/crucible-api.json` including security, required fields, nullability, unions, pagination, and deprecations, update the lock record, regenerate with `npm run api:generate`, review the semantic diff, repair fixtures without casts or invented compatibility fields, update adapters and tests, then run `npm run validate`. CI and production startup never fetch staging OpenAPI. A deployed environment is observational input, not a reproducible build dependency.
