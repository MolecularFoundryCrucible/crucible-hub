<!-- intent-skills:start -->

## Skill loading

Before a substantial change:

- Run `npm run skills:list` from the workspace root.
- If a listed skill matches the work, load it with `npm run skills:load -- <package>#<skill>` before editing.
- Follow the loaded `SKILL.md`. In a monorepo, run the check at the workspace root and choose the most specific package skill.

<!-- intent-skills:end -->

# Crucible Hub agent guide

This is the canonical repository guidance for agents and contributors. Tool-specific files point here instead of copying these rules.

## Repository status and scope

Crucible Hub is a TypeScript and React TanStack Start application for finding, organizing, understanding, sharing, uploading, and managing Crucible resources. The local-development workspace includes the responsive application shell and design system, generated OpenAPI client, server-only API adapter, identity-scoped Query state, global and contextual search, paginated and grouped resource browsing, collection previews, sibling navigation, canonical project, instrument, sample, and dataset workspaces, creation and controlled management workflows, graph and processing views, and capability-gated service-account administration. Deterministic fixtures, browser coverage, production runtime checks, and CI are implemented. Production authentication and mutation exposure remain blocked by the API-owned one-time login exchange and Hub session boundary. Browser upload remains blocked by the secure exact-object upload contract. No deployment or release process exists.

Hub owns browser behavior, navigation, responsive presentation, accessibility, design tokens and components, Hub sessions, browser-to-Hub security, Query state, bounded web aggregation, API contract consumption, uploads, tests, and deployment configuration. It does not own API paths or authorization, persistence, scientific ingestion, Python or CLI behavior, mobile-local behavior, existing Explorer behavior before migration, or cross-repository policy.

Do not edit sibling repositories unless the user explicitly expands scope. Identify the owning repository and its dependency when a change elsewhere is needed, and follow that repository's guidance.

## Repository map

- `src/routes/`: TanStack Router route modules and persistent route layouts
- `src/features/`: product workflows and page composition
- `src/components/ui/`: controlled shadcn primitives
- `src/components/crucible/`: Crucible domain components and semantic icons
- `src/data/crucible/`: browser-safe models, Query ownership, fixtures, and feature adapters
- `src/server/crucible/`: server-only API transport and safe errors
- `src/generated/` and `contracts/`: generated types and pinned API input
- `tests/`, `scripts/`, and `.github/workflows/`: validation and CI
- `docs/` and `decisions/`: authoritative contracts, plans, evidence, and durable choices
- `.agents/skills/` and `skills/`: installed skill instructions and lifecycle policy

## Ecosystem map

| Repository                                                        | Authority relevant to Hub                                                               |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `crucible-api`                                                    | HTTP contract, authorization, persistence, uploads, and ingestion requests              |
| `nano-crucible`                                                   | Supported Python and CLI workflows                                                      |
| `crucible-lens`                                                   | Mobile behavior and a reference for capability-aware interaction and visual consistency |
| `crucible_graph_explorer`                                         | Generic graph and specialized browser workflows until deliberately migrated             |
| `crucible-ecosystem`                                              | Cross-repository ownership, compatibility, and architecture                             |
| `crucible-ingestion`, `ingestion-cloud-consumer`, `crucible-labs` | Scientific ingestion, cloud execution, and downstream analysis                          |

## Authorities

Use the narrowest authoritative source and do not duplicate its complete contents here:

- Product goals and workflows: [`docs/product-brief.md`](docs/product-brief.md)
- Routes and information architecture: [`docs/information-architecture.md`](docs/information-architecture.md)
- Runtime boundaries, security, and architecture: [`docs/architecture.md`](docs/architecture.md)
- Design tokens, components, accessibility, and responsive behavior: [`docs/design-system.md`](docs/design-system.md)
- API integration, Query ownership, pagination, and invalidation: [`docs/api-integration.md`](docs/api-integration.md)
- Work order and gates: [`docs/roadmap.md`](docs/roadmap.md)
- Current foundation evidence: [`docs/phase-0-evidence.md`](docs/phase-0-evidence.md)
- Durable choices: [`decisions/`](decisions/)
- Skill lifecycle and routing: [`skills/README.md`](skills/README.md)
- Contributor workflow and commands: [`CONTRIBUTING.md`](CONTRIBUTING.md)
- User, operator, contributor, privacy, security, and downstream history: [`CHANGELOG.md`](CHANGELOG.md)
- HTTP contract: the pinned OpenAPI artifact owned by `crucible-api`
- Cross-repository topology and compatibility: `crucible-ecosystem`

Read the product brief, architecture, and relevant decisions before implementation. Confirm whether the change affects product scope, architecture, a cross-repository contract, or only local code. Do not implement a proposed decision or API contract as accepted. Prefer supported framework mechanisms and make the smallest coherent change.

## Architecture and domain invariants

- `crucible-api` is authoritative for authorization. Hub capabilities guide presentation but never grant access.
- Stable MFIDs identify routes, query keys, pins, history, and relationships. Slugs are labels and lookup inputs.
- TanStack Query is the sole browser owner of Crucible server state. Authenticated keys include server identity and stable account identity.
- Account, server, logout, or credential changes replace the active Query client before another identity renders.
- Ordinary loaders are isomorphic. Credentials, sessions, and the API adapter stay in authenticated server functions or explicit server-only modules. Every private server function authenticates independently.
- Hub is a backend for the frontend, not a second domain backend. Do not recreate permission logic, persistence, or scientific processing.
- OpenAPI output is reproducible and never hand-edited. Use generated types and the server-only adapter; surface API mismatches instead of compensating silently.
- Collection rows must not overwrite richer detail cache entries. Preserve readable data during refresh errors and keep row, field, file, and dialog failures local.
- Project membership and resource ACLs are separate. Normal grants stop at `admin`; ownership changes use transfer operations. Public-safe and permission-filtered responses are valid authorized results.
- Cursor pagination applies to samples and datasets; use the API response shape for other pagination. Scientific metadata uses dedicated operations.
- Multi-stage creation and uploads preserve completed stages and retry only incomplete work. Consequential changes use API preview followed by explicit confirmation.

## Design-system invariants

The hierarchy is primitive scale, semantic token, shared UI primitive, Crucible domain component, and product screen. Feature code uses tokens and shared components rather than hardcoded colors, typography, spacing, radii, shadows, breakpoints, z-index values, or motion durations. Missing values become design-system tokens.

Light, dark, and system themes share semantic roles. Pair foreground and background tokens for contrast. `components/ui` owns controlled shadcn primitives; feature screens primarily use `components/crucible` components. Prefer semantic HTML and native behavior. Test keyboard, focus, disabled, error, theme, and accessible-name states when changing a primitive. State, permission, lifecycle, and resource type must not rely on color alone.

## Security, privacy, and live systems

- Never read, print, log, commit, or report credentials, cookies, authorization codes, API keys, signed URLs, upload secrets, or secret paths.
- Never expose a general API key to browser JavaScript or browser storage. Production uses opaque browser cookies with shared server-side storage, not cookie-backed secret storage.
- Normal requests must never use a platform-administrator credential. Validate browser and server-function inputs independently and enforce same-origin and CSRF protection on mutations.
- Do not call authenticated live APIs, create or change records, upload files, change access, review requests, deploy, publish, or mutate infrastructure without explicit authorization. Do not run sibling integration tests as routine validation.
- Use local source and committed OpenAPI artifacts for routine work. Any change affecting stored browser data, retention, personal data, telemetry, cookies, credentials, upload content, or third-party hosts needs a privacy review and documentation decision.
- Report security issues privately. Do not put exploitable details or secrets in public issues or changelogs.

## Implementation and documentation rules

Use strict TypeScript, schema validation, abort propagation, and native framework mechanisms. Preserve type inference. Add no code comments unless the why is non-obvious. Do not add speculative abstractions or unrelated refactors.

For complex changes, a capable coordinator owns planning, file boundaries, integration review, and final validation. Delegate bounded implementation when useful, avoid overlapping file ownership, and treat every delegated result as unreviewed until the coordinator inspects and validates it.

Update the authoritative document with behavior changes: product brief for scope, information architecture for routes, architecture for runtime or security, a decision record for durable choices, design system for visual conventions, API integration for contract or Query behavior, roadmap for work order or gates, and CONTRIBUTING for contributor workflow. Keep Markdown prose and list items unwrapped. Use no emojis or em dashes.

Add one concise `CHANGELOG.md` entry under `Unreleased` when a change affects users, operators, contributors, privacy, security, downstream contracts, deployment, configuration, migration, or supported workflow. Do not add entries for planning, internal refactors, tests alone, formatting, or documentation corrections. Every completed task reports changelog impact and any cross-repository consequence.

## Skills

Read [`skills/README.md`](skills/README.md) before creating, activating, changing, or removing a repository-local skill. The project-installed shadcn skill under `.agents/skills/shadcn` is updated only through its supported installer. TanStack skills come from installed package versions through the managed loading block above; do not vendor a separate snapshot. Developer-scoped skills may be used when available, but their absence does not weaken required validation or security review.

No Hub-authored workflow skill is active unless its `SKILL.md` exists and this guide routes matching work to it. Do not infer active skills from names in planning documents.

## Validation and safety

Run focused checks while iterating and the relevant browser checks before completion. Canonical commands are:

- `npm run validate`: formatting, lint, types, unit tests, OpenAPI, server boundary, design tokens, links, secrets, and production build
- `npm run boundary:check`: negative server-only import build
- `npm run test:browser`: Chromium shell, responsive, theme, and accessibility checks
- `npm run test:production`: built Node runtime, `/hub` paths, health, shutdown, and server-function checks
- `npm run api:generate` and `npm run api:check`: generated contract workflow and drift check
- `npm run design:check`: design-token policy
- `npm run docs:check` and `npm run secrets:check`: documentation links and secret scan
- `npm run skills:list` and `npm run skills:stale`: TanStack skill inventory and read-only currency report
- `npm run audit`: high and critical npm advisories

For documentation-only changes, inspect changed files and local links, check trailing whitespace, hard wrapping, em dashes, credentials, private paths, and decision status. Do not switch branches, push, publish, deploy, tag, release, or reset unrelated work. Repository hosting and pull-request policy are not defined and must not be assumed.
