<!-- intent-skills:start -->

## Skill loading

Before a substantial change:

- Run `npm run skills:list` from the workspace root.
- If a listed skill matches the work, load it with `npm run skills:load -- <package>#<skill>` before editing.
- Follow the loaded `SKILL.md`. In a monorepo, run the check at the workspace root and choose the most specific package skill.

<!-- intent-skills:end -->

# Crucible Hub agent guide

This is the canonical repository guide. Tool-specific instruction files should point here instead of copying it.

## Scope and authority

Crucible Hub is a TypeScript, React, and TanStack Start browser workspace. Hub owns browser behavior, navigation, accessibility, design components, Hub sessions, Query state, API contract consumption, tests, and deployment configuration. `crucible-api` owns HTTP contracts, authorization, persistence, uploads, and scientific processing.

Do not edit sibling repositories unless the user expands the scope. When another repository owns a required change, identify that dependency and follow its instructions.

Use the narrowest authoritative source:

- Product behavior: [`docs/product-brief.md`](docs/product-brief.md)
- Routes and page structure: [`docs/information-architecture.md`](docs/information-architecture.md)
- Runtime and security: [`docs/architecture.md`](docs/architecture.md)
- Visual and interaction rules: [`docs/design-system.md`](docs/design-system.md)
- API, Query, pagination, and invalidation: [`docs/api-integration.md`](docs/api-integration.md)
- Delivery status: [`docs/roadmap.md`](docs/roadmap.md)
- Durable choices: [`decisions/`](decisions/)
- Contributor commands: [`CONTRIBUTING.md`](CONTRIBUTING.md)

Read only the sources relevant to the change. A proposal or unmerged API contract is not accepted behavior.

## Repository layout

- `src/routes/`: route modules and persistent layouts
- `src/features/`: product workflows and page composition
- `src/components/ui/`: controlled shadcn primitives
- `src/components/crucible/`: shared domain components and semantic icons
- `src/data/crucible/`: browser-safe models, Query ownership, fixtures, and adapters
- `src/server/crucible/`: server-only API transport and safe errors
- `src/generated/` and `contracts/`: generated client types and pinned OpenAPI input
- `docs/` and `decisions/`: product, architecture, and decision authority

## Architecture invariants

- The API authorizes every operation. Hub capabilities guide presentation but never grant access.
- Use stable MFIDs for routes, Query keys, history, pins, and relationships. Slugs are labels and lookup inputs.
- TanStack Query owns browser server state. Authenticated keys include server and account identity. Replace the Query client before another identity renders after account, server, logout, or credential changes.
- Keep credentials, sessions, and API transport in authenticated server functions or server-only modules. Every private server function authenticates independently.
- Hub is a backend for the frontend, not another domain backend. Do not recreate authorization, persistence, or scientific processing.
- Never hand-edit generated OpenAPI output. Use generated types and the server adapter, and surface contract mismatches explicitly.
- Collection rows must not replace richer detail cache entries. Preserve readable content during refresh failures and keep local failures within the affected row, field, file, or dialog.
- Project membership and resource ACLs are separate. Ordinary grants stop at `admin`; ownership changes use transfer operations.
- Preserve successful stages in multi-stage mutations and retry only incomplete work. Preview consequential operations before explicit confirmation when the API supports it.

## Interface rules

- Build through semantic tokens, shared UI primitives, Crucible domain components, then product screens. Feature code does not introduce hardcoded colors, typography, spacing, radii, shadows, breakpoints, z-index values, or motion durations.
- `src/components/ui` owns controlled shadcn primitives. Feature screens should prefer `src/components/crucible` components.
- Prefer semantic HTML and native behavior. Verify keyboard, focus, disabled, error, theme, and accessible-name states when changing a primitive.
- Never rely on color alone for resource type, lifecycle, permission, or state.

## Security and live systems

- Never read, print, log, commit, or report credentials, cookies, authorization codes, API keys, signed URLs, upload secrets, or secret paths.
- Never expose a general API key to browser JavaScript or browser storage. Production uses opaque browser cookies and shared server-side session state.
- Normal requests never use a platform-administrator credential. Validate browser and server-function inputs independently and protect mutations with same-origin and CSRF checks.
- Do not call authenticated live APIs, mutate live records or infrastructure, upload files, review requests, deploy, publish, or run sibling integration tests without explicit authorization.
- Use local source and committed contracts for routine work. Changes involving stored browser data, retention, personal data, telemetry, cookies, credentials, uploads, or third-party hosts require a privacy and documentation review.

## Change discipline

- Use strict TypeScript, schema validation, abort propagation, type inference, and established framework mechanisms.
- Keep changes focused. Do not add speculative abstractions, unrelated refactors, or comments unless the reason cannot be expressed clearly in code.
- Update the document that owns changed behavior. Use a decision record for a durable architectural choice.
- Keep Markdown prose and list items unwrapped. Use no emojis or em dashes.
- Add one concise `CHANGELOG.md` entry under `Unreleased` for user, operator, contributor, privacy, security, contract, deployment, configuration, migration, or supported-workflow changes. Omit entries for planning, internal refactors, tests alone, formatting, and documentation corrections.
- Report validation, changelog impact, unresolved dependencies, and cross-repository consequences when finishing.

## Skills and validation

Read [`skills/README.md`](skills/README.md) before changing skills. Do not hand-edit installed external skills.

Run focused checks while iterating and checks proportional to the change before completion. `npm run validate` is the complete gate; [`CONTRIBUTING.md`](CONTRIBUTING.md) lists focused commands. For documentation-only work, inspect the diff and run `npm run docs:check` plus relevant secret and formatting checks.

Do not switch branches, push, publish, deploy, tag, release, or reset unrelated work unless the user explicitly requests it.
