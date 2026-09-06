# 0007: Coordinate Route and Query Loading

Status: Accepted

Date: 2026-09-04

## Context

Crucible Hub has a persistent authenticated shell and data-heavy pages whose URL search parameters select server data. Treating every search-parameter change as blocking route navigation replaces established page context with a pending route and produces disruptive full-content flashes. Treating every request as component-local fetching gives up router-coordinated SSR, intent preloading, and destination readiness.

TanStack Router integrates with TanStack Query by allowing route loaders to prime the Query cache. TanStack Query separately supports placeholder data for paginated Query-key changes. Hub needs an explicit ownership boundary between these mechanisms so pages present loading, refresh, pagination, error, and empty states consistently.

## Decision

Use the Router for destination readiness and Query for updates within an established destination.

- Initial entry and cross-route navigation load critical data through a route loader using `ensureQueryData`.
- A search-parameter change within the active collection route starts the corresponding Query without blocking the route.
- Paginated collections retain their previous successful page as placeholder data only when the previous and next Query keys share the same server and account identity.
- The authenticated shell and unchanged page context remain mounted. Pending feedback belongs to the smallest asynchronous content region.
- Use a shape-preserving skeleton only when no readable representation exists. Background refresh and pagination retain readable content, mark its region busy, and expose concise local status.
- Loading, empty, unavailable, and failed states are mutually exclusive.

## Consequences

- Cross-route navigation can wait for critical destination data while preserving the authenticated application shell.
- Pagination and filtering no longer replace stable headings, explanations, and controls.
- Collection components must distinguish initial pending state from background fetching and successful empty results.
- Placeholder data needs an identity guard. Query's unrestricted `keepPreviousData` helper is insufficient for account and server transitions.
- Pagination controls may be temporarily withheld while a request is in flight when repeating the action would target stale page state.

## Alternatives considered

### Block every route search change

This keeps all loading in route loaders but turns pagination, filtering, sorting, and tab changes into destination transitions. It replaces more of the interface than the data change requires and makes established pages feel unstable.

### Fetch all route data only in components

This makes in-page updates straightforward but gives up router-coordinated destination readiness, intent preloading, and critical SSR data loading.

### Use unrestricted previous Query data

TanStack Query's `keepPreviousData` pattern avoids pagination flashes, but using it without scope validation can briefly present data from a prior server or account after identity changes. Hub retains previous data only within the same identity prefix.

### Use Suspense for every collection request

Suspense provides a clear initial boundary, but placeholder data is not available with suspense Queries. Transitions could prevent fallback replacement, but route-owned URL updates and identity-scoped retained data are clearer with explicit Query states for Hub's collection pages.

## Validation

- Verify initial and cross-route entry resolve critical data through route loaders.
- Verify pagination preserves headings and the last readable collection while the next page loads.
- Verify a server or account change never renders placeholder data from the previous identity.
- Verify pending, empty, unavailable, error, and retry behavior independently.
- Run unit, browser, and production-shaped navigation checks.

## References

- [TanStack Router external data loading](https://tanstack.com/router/latest/docs/guide/external-data-loading)
- [TanStack Router data loading](https://tanstack.com/router/latest/docs/guide/data-loading)
- [TanStack Router preloading](https://tanstack.com/router/latest/docs/guide/preloading)
- [TanStack Query paginated queries](https://tanstack.com/query/latest/docs/framework/react/guides/paginated-queries)
- [TanStack Query suspense](https://tanstack.com/query/latest/docs/framework/react/guides/suspense)
