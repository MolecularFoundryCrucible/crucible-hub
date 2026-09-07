# 0028: Consolidate Sample and Dataset Management

Status: Accepted

Date: 2026-09-07

## Context

Sample and dataset Access pages already contain ACL controls, project assignment, and ownership transfer, while reviewed deletion appears as a global header action. Access is too narrow a label for this collection of authority and lifecycle operations, and the header gives deletion more prominence than its reviewed workflow requires.

The API provides exact capability guidance for access and ownership but does not provide `can_request_deletion`. Hub must keep deletion discoverable without inferring eligibility from unrelated capabilities.

## Decision

Canonical sample and dataset management uses `/samples/:sampleMfid/manage` and `/datasets/:datasetMfid/manage`. Existing `/access` routes redirect to the corresponding Manage route while preserving validated search state.

Manage contains capability-gated access controls, project assignment, ownership transfer, and reviewed deletion as separate sections. The navigation remains visible for every readable sample and dataset because deletion has no presentation capability. Access controls require `can_manage_access`, ownership requires `can_transfer`, and the API independently authorizes every mutation.

Reviewed deletion appears last in a destructive Danger zone card. Its semantic destructive surface, boundary, action, icon, title, and explanation communicate risk without relying on color. It retains the existing review dialog, optional local reason, server-confirmed state, failure recovery, and prohibition on direct permanent deletion.

## Consequences

- Scientists find resource authority and lifecycle operations under one predictable Manage destination.
- Accounts without access or ownership capabilities can still request deletion when the API permits it.
- Access data remains lazy and is not requested for accounts without access-management capability.
- Existing Access links continue to work through replacement redirects.

## Validation

- Verify canonical Manage navigation, direct entry, legacy Access redirects, and preserved search state.
- Verify access, assignment, and ownership capability boundaries remain unchanged.
- Verify deletion submission, active state, retained failure input, compact containment, theme parity, and accessibility from Manage.
