# 0021: Adopt the Direct Project Membership Contract

Status: Accepted

Date: 2026-09-06

## Context

The project Overview and Settings boundary in [decision 0020](0020-consolidate-project-overview-and-people.md) was accepted while the project membership mutation contract was still treated as conditional. The API contract is now confirmed through its generated OpenAPI operation shapes and permission-system authority. Project membership is managed directly by adding an existing user, changing a role, or removing a member. The API does not define an invitation workflow.

## Decision

Hub provides direct project membership controls in project Settings, separate from the descriptive project form, resource ACL presentation, join-request review, ownership transfer, and project assignment. The operations are:

- `POST /projects/{project_ref}/users/{orcid}` adds an existing user immediately.
- `PATCH /projects/{project_ref}/users/{orcid}?role=...` changes an existing member's role.
- `DELETE /projects/{project_ref}/users/{orcid}` removes a member or lets the current member leave.

`can_manage_access` gates add and role-change presentation. `max_grant_role` limits assignable roles: editors can assign contributor or below, admins can assign editor or below, and owners can assign admin or below. Ownership is exclusive and is changed through the ownership-transfer operation, not a membership role edit. `can_transfer` guides presentation for removing another member and for ownership transfer. A current non-owner member may leave through the direct delete operation; this state comes from the current membership and is not inferred from an unconfirmed capability field. The API independently authorizes every operation and remains authoritative when capability guidance is absent or stale.

The role hierarchy is owner, admin, editor, contributor, and viewer. The management ceiling follows owner to admin, admin to editor, and editor to contributor, with lower roles such as viewer remaining available when permitted by the API. A caller cannot modify a member at the caller's own role, and no membership operation grants owner standing.

Every direct membership mutation returns the complete authoritative member list. Hub replaces the cached members representation with that list rather than merging a client-authored row. API mode invalidates the related exact project detail, account-scoped project list, and search queries so membership-derived views refresh from the API. Fixture mode returns deterministic copy-on-write results for local interaction and tests.

No invitation workflow is planned. A future invitation feature would require a separate accepted API contract and decision rather than reinterpreting immediate member addition.

## Consequences

- Project Settings exposes direct membership management in local development. Production exposure remains gated by the authenticated session boundary.
- Capability guidance controls presentation without becoming a second authorization system.
- Full-list mutation responses keep member presentation synchronized with API authority even though the read endpoint is paginated.
- Project membership remains distinct from descriptive editing, resource ACLs, join requests, ownership transfer, and project assignment.
- OpenAPI status documentation and explicit names for remove and self-leave guidance remain documentation improvements, not blockers to the direct contract.

## Privacy review

Member records remain the API's public-safe representations. Hub does not add invitation state, browser persistence, telemetry, credentials, or new recipients.

## Validation

- Verify capability-gated add and role-change presentation, assignable-role ceilings, current-member self-leave, owner protection, and API error handling.
- Verify that successful add, role change, and removal replace the cached member list with the complete server response and invalidate related project, account, and search queries in API mode.
- Verify that descriptive project fields and resource ACL controls remain separate from membership operations.
