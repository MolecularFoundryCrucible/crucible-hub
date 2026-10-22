# 0031: Scope Administrator Authority to the Administrator View

Status: Accepted

Date: 2026-09-22

Updated: 2026-10-22

The first version also gave the `/admin` routes their own contextual elevation without a toggle. That was removed: the Administrator view is now the only source of elevated authority, and Administration server functions refuse with `403` while it is off.

## Context

The Crucible API can apply either ordinary ACL-derived authority or explicit platform-administrator authority to each authenticated request. Human platform administrators need immediate access to platform Administration workflows without making every ordinary collection show all platform resources. They also need one deliberate global mode for platform-wide browsing without repeated collection-level scope controls.

## Decision

Hub sends normal authority by default. Administrator view is one explicit global mode available to an eligible human administrator (`authorization.can_elevate`), and it is the only source of elevated authority. When active, routine Hub API requests use elevated authority throughout navigation, Administration destinations appear, and elevated actions show on resources. While it is off, Administration server functions refuse with `403` instead of elevating on their own. A labelled switch in the sidebar Administration section owns the toggle, condenses to an identifiable pressed icon with the sidebar, and a persistent warning action in the application bar identifies the active mode and returns to standard access.

The server-only OpenAPI client attaches an explicit privilege-mode header and verifies the applied mode on successful responses. Query identity includes the effective privilege mode, elevated Queries are excluded from dehydration, and deactivation cancels and removes elevated Query data before normal-mode route reload.

The privilege intent lives in the authenticated server-side Hub session when the shared session store is in use, with a browser-session HttpOnly same-site cookie containing no credential as the fallback for process-local sessions. The API still authorizes every elevated request.

## Consequences

- There is one visible source of elevation: the switch and the application bar warning always show whether requests are elevated.
- Administration needs the Administrator view, so an administrator turns it on before managing users or service accounts.
- Global Administrator view changes collections, search, details, capabilities, and mutations consistently rather than adding repeated All Crucible controls.
- Normal and elevated representations cannot collide in TanStack Query or SSR dehydration.
- The API remains the authorization authority, and a privilege-mode value never grants authority by itself.

## Alternatives considered

### Contextual elevation inside Administration (the original choice)

Elevating only the requests of `/admin` routes avoided one activation step, but it made a second, invisible source of elevated authority. Requiring the Administrator view keeps elevation deliberate and always visible, at the cost of one switch before administration work.

### Add an elevated scope control to every collection

Repeated controls clutter collection toolbars and make authority inconsistent across search, detail, graph, and mutation requests.

### Make every request elevated while inside or after entering Administration

Automatically changing global scope makes unrelated collection results surprising and leaves the user without a clear distinction between contextual administration and platform-wide browsing.
