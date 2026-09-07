# 0024: Preview ownership transfers and project moves

Status: Accepted

Date: 2026-09-06

## Context

Ownership transfer can remove the current owner from a resource, and moving a sample or dataset replaces its primary project grant. Both API operations default to a non-mutating preview and require `confirm=true` to execute. Hub must preserve stable MFID navigation, avoid optimistic authority changes, and keep ownership, project assignment, descriptive editing, membership, and ACL management distinct.

## Decision

Hub uses the API preview before presenting final confirmation for ownership transfers and sample or dataset project moves. The preview resolves the target and describes the current state without mutation. Confirmation repeats the same target through the dedicated operation with `confirm=true`.

Exact `can_transfer` guides ownership presentation. Exact `can_manage_access` guides project-move presentation because the API has no operation-specific move capability. The API independently authorizes the source and target on every request.

Ownership is available as a separate Settings subsection for projects and instruments and as a separate card in sample and dataset Access. Project assignment is a separate card in sample and dataset Access, while project and instrument values in Overview Summary remain descriptive. Instruments are never assigned to projects. Dataset instrument reassignment remains absent until the API publishes a dedicated atomic operation.

Confirmed responses update only fields they authoritatively contain. Dependent exact detail, collection, project, and search Queries are then invalidated as needed. Neither operation is optimistic.

## Consequences

- A typo or ambiguous target cannot cause an immediate consequential mutation.
- Mutable project slugs remain API payload values while Hub navigation and Query keys continue to use MFIDs.
- Project selection requires resolving the selected project MFID to its current API project ID before preview and confirmation.
- Ownership confirmation invalidates resource and collection state because the previous caller's capabilities can change.
- Project moves invalidate the resource, affected project views, related resource collections, and search results.

## Validation

- Verify preview requests do not mutate and confirmation requests set `confirm=true`.
- Verify project MFIDs resolve to current project IDs before the move request.
- Verify local failures preserve the selected target and readable resource context.
- Verify project assignment never appears for instruments.
- Verify exact resource and dependent collection state refresh after confirmation.
