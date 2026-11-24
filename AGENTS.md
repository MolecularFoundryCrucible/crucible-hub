# Crucible Hub agent guide

This is the only agent instruction file in the repository. Human contributor rules live in [`CONTRIBUTING.md`](CONTRIBUTING.md) and apply to agents too.

<!-- intent-skills:start -->

## Skill loading

Load the narrowest matching skill before editing; skills supplement this guide and never authorize live actions.

| Change                                                  | Skill                                                           |
| ------------------------------------------------------- | --------------------------------------------------------------- |
| Links, navigation, and `useNavigate`                    | `@tanstack/router-core#router-core/navigation`                  |
| Route loaders, pending states, and preloading           | `@tanstack/router-core#router-core/data-loading`                |
| Search parameter validation and URL state               | `@tanstack/router-core#router-core/search-params`               |
| Code splitting                                          | `@tanstack/router-core#router-core/code-splitting`              |
| Not-found and error boundaries                          | `@tanstack/router-core#router-core/not-found-and-errors`        |
| Server rendering and streaming                          | `@tanstack/router-core#router-core/ssr`                         |
| Server functions and their validation                   | `@tanstack/start-client-core#start-core/server-functions`       |
| Server routes such as `/hub/health` and OAuth callbacks | `@tanstack/start-client-core#start-core/server-routes`          |
| Request and server-function middleware                  | `@tanstack/start-client-core#start-core/middleware`             |
| What runs on the server, the client, or both            | `@tanstack/start-client-core#start-core/execution-model`        |
| Sessions, cookies, and server-side auth primitives      | `@tanstack/start-client-core#start-core/auth-server-primitives` |

For `src/components/ui` primitives and `components.json`, use the official shadcn skill if you have it installed for your user; the primitives use Base UI ([decision 0006](decisions/0006-use-base-ui-primitives.md)) and the CLI pinned in `package.json`. Agent skills are installed per user, never committed. Load a TanStack skill with `npm run skills:load -- <package>#<skill>`; these ship inside the installed packages, so they match `package-lock.json`. `npm run skills:list` shows the rest. TanStack Query and TanStack Form ship no skills; use their official documentation.

<!-- intent-skills:end -->

## Scope and authority

Crucible Hub is a TypeScript, React, and TanStack Start backend for the frontend of the Crucible API. Hub owns browser behavior, navigation, accessibility, design components, Hub sessions, Query state, API contract consumption, tests, and deployment configuration. `crucible-api` owns HTTP contracts, authorization, persistence, uploads, and scientific processing. Do not edit sibling repositories unless the user expands the scope; when another repository owns a required change, name the dependency.

Read only the sources relevant to the change:

- Product behavior: [`docs/product-brief.md`](docs/product-brief.md)
- Routes and page structure: [`docs/information-architecture.md`](docs/information-architecture.md)
- Runtime, security, and module boundaries: [`docs/architecture.md`](docs/architecture.md)
- Sign-in, sessions, and runtime settings: [`docs/authentication.md`](docs/authentication.md)
- Visual and interaction rules: [`docs/design-system.md`](docs/design-system.md)
- API, Query, pagination, and invalidation: [`docs/api-integration.md`](docs/api-integration.md)
- Open API requests: [`docs/crucible-api-handoff.md`](docs/crucible-api-handoff.md)
- Remaining work: [`docs/roadmap.md`](docs/roadmap.md)
- Durable choices: [`decisions/`](decisions/README.md)

A proposal or unmerged API contract is not accepted behavior.

## Repository layout

- `src/routes/`: route configuration only (search validation, loaders, head, and the page and pending components imported from `src/features/`)
- `src/features/`: product workflows and page composition
- `src/components/ui/`: controlled shadcn primitives
- `src/components/crucible/`: shared domain components and semantic icons
- `src/data/crucible/`: browser-safe models, Query ownership, fixtures, and adapters
- `src/server/crucible/`: server-only API transport and safe errors
- `src/generated/` and `contracts/`: generated client types and the pinned OpenAPI contract

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
- Feature screens prefer `src/components/crucible` components over raw `src/components/ui` primitives.
- Prefer semantic HTML and native behavior. Verify keyboard, focus, disabled, error, theme, and accessible-name states when changing a primitive.
- Never rely on color alone for resource type, lifecycle, permission, or state.
- Keep heavy optional code (graph canvas, ELK, forms, QR rendering) and its styles in on-demand chunks loaded with `React.lazy` or dynamic imports. Route search schemas and loader helpers live in modules without UI imports, because they load on every page, and page components read route state with `getRouteApi`. `npm run test:e2e` fails when sign-in or Home first-load size exceeds its budget.

## Security and live systems

- Never read, print, log, commit, or report credentials, cookies, authorization codes, API keys, signed URLs, upload secrets, or secret paths.
- Never expose an API key to browser JavaScript or browser storage. Deployed Hubs use opaque browser cookies and shared server-side sessions.
- Normal requests never use a platform-administrator credential. Validate browser and server-function inputs independently and protect mutations with same-origin and CSRF checks.
- Do not call authenticated live APIs, mutate live records or infrastructure, upload files, review requests, deploy, publish, or run sibling integration tests without explicit authorization. Use local source, fixtures, and committed contracts for routine work.
- Changes involving stored browser data, retention, personal data, telemetry, cookies, credentials, uploads, or third-party hosts need a privacy review and a documentation update.

## Working in this repository

- Follow [`CONTRIBUTING.md`](CONTRIBUTING.md) for the pull-request workflow, changelog entries, Markdown style, and commands. Never commit to `main` directly, and do not switch branches, push, publish, deploy, tag, release, or reset unrelated work unless the user asks.
- Use strict TypeScript, schema validation, abort propagation, type inference, and established framework mechanisms. Keep changes focused: no speculative abstractions, unrelated refactors, or comments that restate the code.
- Update the document that owns changed behavior, and add a decision record for a durable architectural choice.
- Follow the testing rules in [`CONTRIBUTING.md`](CONTRIBUTING.md#tests): one layer per behavior, no styling, framework, or fixture tests, and the fewest tests that would fail without the change.
- Do not start a second `vite dev` server from this checkout while one may be running: they share the `node_modules/.vite` cache, and a re-optimization breaks the other server's dynamic imports. For ad hoc browser checks, run `npm run build`, then `node .output/server/index.mjs` on a spare port with `HUB_DATA_SOURCE=fixture` and `HUB_ENABLE_FIXTURES=true`.
- Run focused checks while iterating and checks proportional to the change before finishing; `npm run validate` is the complete gate. For documentation-only work, run `npm run docs:check`, `npm run format:check`, and `npm run secrets:check`.
- When finishing, report the validation you ran, the changelog impact, unresolved dependencies, and cross-repository consequences.
