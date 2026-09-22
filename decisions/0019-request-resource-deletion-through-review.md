# 0019: Request Resource Deletion Through Review

Status: Accepted

Date: 2026-09-06

## Context

The Crucible API supports reviewed sample and dataset deletion through `POST /resources/{resource_id}/delete` with an optional reason. Contributor access is required, an active request causes a conflict, and the successful response is a deletion-request record. A separate force-delete operation permanently removes a resource without review and is not appropriate for ordinary Hub workflows.

The current resource capability model does not identify whether the caller may request deletion, and sample and dataset detail expose active deletion state through an open object rather than the typed deletion-request response. Inferring eligibility from `can_edit` would incorrectly exclude contributors.

## Decision

Canonical sample and dataset Manage pages expose a destructive Danger zone action that opens a confirmation dialog with an optional bounded reason. The dialog states that submission starts review and does not immediately delete the resource or its files. Submission uses a strict POST TanStack Start server function and the API's reviewed deletion-request operation. Hub never invokes direct permanent deletion from this workflow. [Decision 0028](0028-consolidate-resource-management.md) supersedes the original header-action placement.

Until the API publishes explicit `can_request_deletion` guidance, Hub presents the action to authenticated users when detail contains no active request. The API remains authoritative and a denied request produces local feedback without changing the page. Hub does not substitute `can_edit` or `can_manage_access` for the missing capability.

Hub safely reads the known deletion-request fields from the open detail value and ignores unknown additions. A confirmed response must identify the requested resource. Success updates the exact detail record with server-confirmed request state and API mode refreshes exact detail, the corresponding resource-family lists, and search. Conflict refreshes exact detail because another active request may already exist. Failed submission retains the reason. No optimistic deletion state is shown.

An active request replaces the request action with a fixed-geometry status action. The shared `/deletion-requests` workspace exposes Submitted by you and Needs review as separate API scopes. Required per-request `can_review` guidance controls review actions. Approval permanently deletes the database resource while stored GCS objects remain retained; rejection restores normal discovery. Project Manage may show a bounded project-filtered review preview. Review, audit, cancellation, and force deletion remain separate workflows.

Submission, approval, and rejection invalidate the affected resource families, facets, search, graphs, project and instrument summaries, deletion-request collections, and exact resource detail. Request collections use deterministic API offset ordering and preserve their URL-backed scope, project filter, and page.

## Consequences

- Scientists can request reviewed deletion without direct destructive authority.
- Contributor eligibility remains available even though current capabilities cannot predict it.
- Viewers may encounter a local permission error until operation-specific capability guidance exists.
- Unknown deletion-request response additions do not erase otherwise valid known state.
- Force deletion remains unavailable in Hub.
- Requesters can find pending and completed submissions after the resource leaves ordinary discovery.
- Resource Admin and Owner reviewers use ordinary ACL authority unless global Administrator view is explicitly enabled.

## Privacy review

The optional reason is sent only when the user submits the request. Hub does not persist it in browser storage, URLs, telemetry, logs, or Query keys. API credentials remain behind the existing server boundary.

## Validation

- Verify sample and dataset submission with and without a reason, strict reason and MFID validation, request identity validation, API conflict mapping, cancellation propagation, and no live API calls in fixture tests.
- Verify active-request presentation, local forbidden and failure feedback, retained reasons, fixed pending geometry, keyboard operation, compact layout, theme parity, horizontal containment, and automated accessibility.
- Verify that no Hub path invokes direct permanent deletion.
