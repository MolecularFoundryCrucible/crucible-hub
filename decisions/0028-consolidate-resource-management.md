# 0028: Consolidate Sample and Dataset Management

Status: Accepted

Date: 2026-09-07

Updated: 2026-10-22

## Context

Sample and dataset Access pages already contain ACL controls, project assignment, and ownership transfer, while reviewed deletion appears as a global header action. Access is too narrow a label for this collection of authority and lifecycle operations, and the header gives deletion more prominence than its reviewed workflow requires.

The API provides exact capability guidance for access and ownership but does not provide `can_request_deletion`. Hub must keep deletion discoverable without inferring eligibility from unrelated capabilities.

## Decision

Canonical sample and dataset management uses `/samples/:sampleMfid/manage` and `/datasets/:datasetMfid/manage`. Existing `/access` routes redirect to the corresponding Manage route while preserving validated search state.

Manage contains capability-gated access controls, project assignment, ownership transfer, and reviewed deletion as separate sections. The navigation remains visible for every readable sample and dataset because deletion has no presentation capability. The Access management card is shown to everyone the API allows to read the access list (`can_view_access`: a role on the resource other than through public access, directly or through a project), with the same layout for everyone and change controls only for `can_manage_access`. People who can only read a public resource see that access is unavailable. Ownership requires `can_transfer`, and the API independently authorizes every mutation.

Reviewed deletion appears last in a destructive Danger zone card. Its semantic destructive surface, boundary, action, icon, title, and explanation communicate risk without relying on color. It retains the existing review dialog, optional local reason, server-confirmed state, failure recovery, and prohibition on direct permanent deletion.

## Consequences

- Scientists find resource authority and lifecycle operations under one predictable Manage destination.
- Accounts without access or ownership capabilities can still request deletion when the API permits it.
- Access data remains lazy and is requested only for accounts with `can_view_access`, so everyone working with a resource can see who has access without being able to change it.
- Existing Access links continue to work through replacement redirects.

## Validation

- Verify canonical Manage navigation, direct entry, legacy Access redirects, and preserved search state.
- Verify access, assignment, and ownership capability boundaries remain unchanged.
- Verify deletion submission, active state, retained failure input, compact containment, theme parity, and accessibility from Manage.
