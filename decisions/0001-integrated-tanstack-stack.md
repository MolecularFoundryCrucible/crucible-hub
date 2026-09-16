# 0001: Use the Integrated TanStack Stack

Status: Accepted

Date: 2026-09-02

## Context

Hub needs typed route and URL state, authenticated server execution, server-state caching, scalable collections, complex forms, SSR for the initial route, and a containerized backend-for-frontend runtime.

The principal candidates were React Router Framework Mode, Next.js, a plain React SPA with a separate backend, and TanStack Start.

## Decision

Use TypeScript and React with:

- TanStack Start for the full-stack runtime
- TanStack Router for routes and schema-validated URL state
- TanStack Query for browser-side Crucible server state
- TanStack Table and TanStack Virtual when client-side table state or rendered collection volume requires them
- TanStack Form with shared schema validation for complex forms

TanStack Query is the single browser cache owner for Crucible server state. Route loaders prefetch or require Query data and must not create a competing cache for the same representation.

All credentialed API access occurs through authenticated server functions or explicit server-only modules. Ordinary isomorphic loaders do not access credentials.

## Consequences

- Route parameters, filters, sorting, grouping, cursors, tabs, and graph focus can be type-safe and URL-addressable.
- The application uses a coherent family of routing, server-state, and form tools, with compatible table and virtualization packages available when justified.
- Current server-paginated collections use semantic HTML tables and do not install Table or Virtual until their state or rendering behavior is needed.
- Developers must understand TanStack Start's server and browser execution model.
- Generic TypeScript complexity and compile performance require monitoring as the route tree grows.
- The framework's release cadence requires deliberate dependency upgrades and production validation.
- Production readiness requires validation of the build, container deployment, path prefixes, server-only imports, sessions, CSRF, cancellation, and testing.

## Alternatives considered

### React Router Framework Mode

Mature and well suited to backend-for-frontend applications, forms, actions, sessions, and progressive enhancement. It remains the fallback if TanStack Start fails the Phase 0 gate. Its URL search-parameter typing and integrated client-cache story are less compelling for Hub's data-heavy screens.

### Next.js

Mature full-stack React ecosystem with strong server features. Its additional rendering and caching conventions are not clearly beneficial for an authenticated application sitting in front of an existing FastAPI service.

### Plain React and Vite SPA

Simple initial setup, but it requires a separate secure backend, duplicates routing and mutation infrastructure, and encourages direct browser access to long-lived API credentials.

## Validation

The local runtime, server-only boundary, Query integration, test harness, container runtime, and `/hub` path behavior have passed their foundation gates. Production authentication, shared sessions, CSRF, target deployment, and direct-upload gates remain open in `docs/architecture.md`. A blocking architectural failure requires a new decision record that supersedes this one.

## References

- [TanStack Start overview](https://tanstack.com/start/latest/docs/framework/react/overview)
- [TanStack Router overview](https://tanstack.com/router/latest/docs/overview)
- [TanStack Start execution model](https://tanstack.com/start/latest/docs/framework/react/guide/execution-model)
