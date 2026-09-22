# 0031: Separate Contextual and Global Administrator Authority

Status: Accepted

Date: 2026-09-22

## Context

The Crucible API can apply either ordinary ACL-derived authority or explicit platform-administrator authority to each authenticated request. Human platform administrators need immediate access to platform Administration workflows without making every ordinary collection show all platform resources. They also need one deliberate global mode for platform-wide browsing without repeated collection-level scope controls.

## Decision

Hub exposes two related authority scopes.

Platform Administration uses contextual elevated authority for the requests owned by implemented `/admin` routes. Administration remains discoverable from the normal account profile through `authorization.can_elevate`. Entering service-account Administration requires no additional toggle and does not change authority outside Administration.

Administrator view is a separate explicit global mode available to an eligible human administrator. When active, routine Hub API requests use elevated authority throughout navigation. The account menu owns the toggle, and a persistent warning action in the application bar identifies the active mode and returns to standard access.

The server-only OpenAPI client attaches an explicit privilege-mode header and verifies the applied mode on successful responses. Query identity includes the effective privilege mode, elevated Queries are excluded from dehydration, and deactivation cancels and removes elevated Query data before normal-mode route reload.

During the development API-key bridge, global privilege intent uses a browser-session HttpOnly same-site cookie containing no credential. The API still authorizes every elevated request. Production moves the intent and any future short-lived API privilege lease into the authenticated server-side Hub session, with session rotation, expiration, and revocation behavior owned by the authentication transition.

## Consequences

- Service-account administration is directly accessible to eligible human administrators in standard global mode.
- Leaving Administration restores the selected global authority without a hidden mode change.
- Global Administrator view changes collections, search, details, capabilities, and mutations consistently rather than adding repeated All Crucible controls.
- Normal and elevated representations cannot collide in TanStack Query or SSR dehydration.
- The API remains the authorization authority, and a privilege-mode value never grants authority by itself.
- Production exposure remains blocked until the server-side Hub session boundary is implemented and validated.

## Alternatives considered

### Require global Administrator view before entering Administration

This adds an unnecessary activation step for an already deliberate platform-administration route and hides available administrative work behind unrelated global browsing state.

### Add an elevated scope control to every collection

Repeated controls clutter collection toolbars and make authority inconsistent across search, detail, graph, and mutation requests.

### Make every request elevated while inside or after entering Administration

Automatically changing global scope makes unrelated collection results surprising and leaves the user without a clear distinction between contextual administration and platform-wide browsing.
