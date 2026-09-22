# Administration and Scoped Management

Status: Proposed

Date: 2026-09-16

## Purpose

This document defines a proposed Administration workspace for Crucible Hub and the corresponding contextual management surfaces inside projects, instruments, and resources. It specifies product boundaries, information architecture, interaction behavior, Hub implementation, API requirements, authorization guidance, pagination, mutation semantics, cache effects, delivery order, and acceptance criteria.

The Administration workspace is an action center for review, operations, identity management, and audit. It is not a generic database console. Contextual management remains available next to the project, instrument, dataset, or sample whenever the action has a clear local subject. The broad Administration workspace aggregates the same authorized work across every scope available to the caller and never grants additional authority.

This proposal extends the administration requirements in [`crucible-api-handoff.md`](crucible-api-handoff.md). The pinned OpenAPI artifact remains authoritative for implemented HTTP behavior. Nothing in this document should be treated as an accepted API contract until it appears in a reviewed OpenAPI artifact.

## Product principles

- Keep actions close to their subject. Project membership and join reviews belong in Project Manage, instrument operators and lifecycle belong in Instrument Manage, and dataset-specific ingestion belongs in Dataset Processing.
- Provide a broad console for people who administer several projects, instruments, or platform-wide workflows so they do not have to visit every resource individually.
- The broad console shows the union of work the caller may access. It does not imply platform-administrator authority.
- The API remains the sole authorization authority. Hub capabilities guide navigation and presentation but never grant access.
- Use exact operation-specific capabilities instead of inferring authority from platform role, ownership, resource role, endpoint success, or an empty response.
- Preserve stable MFIDs for navigation and cache identity. Internal database IDs and project slugs may be displayed when useful but must not drive routes.
- Keep domain queues separate. Join requests, deletion requests, processing operations, service accounts, people, and audit events have different fields and actions and should not be forced into one generic record model.
- Use shared queue, status, identity, pagination, confirmation, error, and empty-state components while keeping domain mutations explicit.
- Never calculate cross-workspace counts, filters, ordering, or groups from partial pages in the Hub.
- Consequential actions require explicit confirmation, authoritative server responses, and local recovery without optimistic domain changes.
- Empty queues are normal states. They should not be treated as authorization failures.

## Implemented privilege behavior

The pinned API contract separates a human platform administrator's assigned entitlement from the privilege mode applied to each request. Hub sends `Crucible-Privilege-Mode: normal` for standard access and verifies the applied mode returned by successful authenticated responses. Normal `/account/profile` capabilities describe normal authority, while `authorization.can_elevate` keeps eligible platform Administration destinations discoverable.

Platform Administration and global Administrator view are separate Hub scopes. Requests owned by implemented `/admin` service-account routes use an explicit elevated server client without changing global mode. The shell shows a contextual Platform administration indicator, and leaving the route returns ordinary requests to the selected global mode. An eligible human administrator may separately enable Administrator view through the first control in the sidebar Administration section. That visible mode applies elevated authority throughout the Hub, uses a persistent warning action in the top bar, and ends when explicitly disabled or when the browser session ends during the development bridge. Production must store privilege intent and any future API-issued lease in the authenticated server-side Hub session with expiry and session rotation.

Normal and elevated Query representations use distinct identity scopes. Elevated Queries are never dehydrated, and disabling global Administrator view cancels and removes elevated data before the route reloads with ordinary ACL authority. The Hub never retries a denied or missing resource in elevated mode automatically.

## Roles and scopes

The interface should distinguish authority scope from identity type.

| Caller scope                         | Examples                                                         | Expected Administration access                                                                                                                     |
| ------------------------------------ | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Platform administrator               | Platform operations or identity administrator                    | Every queue and identity function explicitly granted by account capabilities                                                                       |
| Project lead or project admin        | Lead or admin of one or more projects                            | Join requests, project membership, eligible project-resource deletion reviews, scoped processing, and scoped audit where exact capabilities permit |
| Instrument owner or instrument admin | Owner or admin of one or more instruments                        | Operators, lifecycle, eligible instrument-related processing, and scoped audit where exact capabilities permit                                     |
| Resource owner or admin              | Owner or admin of a dataset or sample                            | Existing access, ownership, assignment, and deletion-request submission; review only when an exact review capability is returned                   |
| Service account                      | Automated principal                                              | No platform-role administration; other access is limited to the resource operations explicitly authorized by the API                               |
| Ordinary member                      | Viewer, contributor, or editor without administrative capability | No Administration destination unless at least one account-level or scoped administrative capability is present                                     |

Project and instrument roles must not be converted into platform privileges. Instrument responsibility must not reveal dataset content that the caller cannot otherwise read. Operational views may expose a public-safe request identity and state without exposing scientific metadata, file content, credentials, signed URLs, or unrelated project information.

## Information architecture

### Broad Administration routes

| Route                                         | Purpose                                                                               | Initial eligibility                                                                                          |
| --------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `/admin`                                      | Actionable summaries and direct links to authorized administration areas              | `can_open_administration`                                                                                    |
| `/admin/reviews`                              | Combined navigation for join and deletion review queues                               | At least one review capability                                                                               |
| `/admin/reviews/join-requests`                | Join requests across every project the caller may review                              | `can_review_join_requests`                                                                                   |
| `/admin/reviews/deletion-requests`            | Deletion requests across every scope the caller may review                            | `can_review_deletion_requests`                                                                               |
| `/admin/processing`                           | Failed, running, queued, and completed processing operations across authorized scopes | `can_manage_processing` or `can_view_processing_operations`                                                  |
| `/admin/service-accounts`                     | Existing service-account directory and creation workflow                              | Human `can_elevate` eligibility or effective `can_manage_service_accounts`                                   |
| `/admin/service-accounts/:serviceAccountMfid` | Existing service-account identity, role, and credential workflow                      | Human `can_elevate` eligibility or effective `can_manage_service_accounts`, plus operation-specific guidance |
| `/admin/people`                               | Human account lookup and administration                                               | `can_manage_people`                                                                                          |
| `/admin/people/:personMfid`                   | Administrative person detail separate from the public profile                         | `can_manage_people` plus operation-specific guidance                                                         |
| `/admin/audit`                                | Immutable administrative and operational history                                      | `can_view_audit`                                                                                             |

The future broad Administration sidebar group should appear when `can_open_administration` is true. The API should set that value whenever at least one child capability is true. The implemented service-account entry currently appears for an eligible human administrator through `authorization.can_elevate` or an effective `can_manage_service_accounts`, and its requests use contextual elevation. Future scoped administration entries should use their exact normal-mode navigation capability and must not depend on platform elevation eligibility.

### Contextual project surfaces

Project Data, Overview, and Manage remain the primary project navigation. Manage should contain the following capability-gated sections:

- Access management retains direct members, roles, public access, leave, and ownership behavior.
- Join requests shows a pending count, a bounded list of the newest requests, Approve and Reject actions, and a View all action linked to `/admin/reviews/join-requests?project=<project_mfid>`.
- Resource review shows pending deletion requests for resources assigned to or shared with the project only if project policy and exact capabilities allow the caller to review them.
- Processing attention shows failed or stuck requests for project datasets only when the caller has both the required operational authority and sufficient visibility into the affected dataset.
- Project activity links to `/admin/audit?project=<project_mfid>` when scoped audit is supported.

The project page should not load hidden queues on every visit. Pending counts may come from the project detail or a lightweight scoped summary. Queue records load only when the relevant card is visible or opened.

### Contextual instrument surfaces

Instrument Data, Overview, and Manage remain the primary instrument navigation. Manage should contain the following capability-gated sections:

- Access management retains instrument ACL behavior when supported.
- Operators retains service-account assignment and removal.
- Lifecycle retains status changes and ownership transfer.
- Processing attention shows failed or stuck requests associated with the instrument only when the API can expose a privacy-safe operational representation and exact view or action capabilities.
- Instrument activity links to `/admin/audit?instrument=<instrument_mfid>` when scoped audit is supported.

An instrument administrator does not automatically gain access to the scientific contents of every acquired dataset. The API must define whether instrument-scoped operations reveal only request status, dataset identity, and safe failure information or require independent dataset read permission.

### Contextual resource surfaces

- Dataset Processing remains the complete file and ingestion history for one dataset.
- Dataset and Sample Manage retain deletion-request submission and current request status.
- A reviewer who has an exact review capability may see a Review request action on the affected resource. It opens the same domain review experience used by the broad queue and returns to the resource after completion.
- Contextual actions and broad-console actions must use the same server functions, Query keys, confirmation components, and mutation semantics.

## Administration overview

`/admin` should prioritize work requiring attention. It should not reproduce complete queues or show decorative metrics.

Recommended cards:

1. Join requests awaiting review.
2. Deletion requests awaiting review.
3. Failed or stuck processing operations.
4. Service-account credentials requiring attention when expiration or revocation status becomes available.

Each card contains a count, a concise state label, a bounded preview of the newest items when useful, and View all. Cards absent from the caller's capabilities are omitted without leaving empty grid tracks. A zero count renders a calm empty state rather than hiding an area the caller is authorized to manage.

The overview should read one lightweight summary. It must not request every first queue page solely to calculate badges. Counts must state whether they are exact, capped, or lower bounds.

Suggested response shape:

```json
{
  "join_requests": { "count": 4, "precision": "exact" },
  "deletion_requests": { "count": 2, "precision": "exact" },
  "processing_attention": { "count": 3, "precision": "at_least", "cap": 3 },
  "credential_attention": null,
  "updated_at": "2026-09-16T21:30:00Z"
}
```

`null` means the category is not available to the caller or deployment. Zero means the caller is authorized and no matching work exists.

## Review requests

### Queue presentation

Review queues use a full-width table on larger screens and stable stacked rows on compact screens. The first useful columns are Subject, Requester, Scope, Requested, Status, and Open. Queue filters belong in a shared filter panel and remain URL-backed. Supported filters should include status, project, instrument where relevant, resource type, requester, and requested-time range. The API owns filtering, sorting, counts, and pagination.

Opening a request should use a dedicated route or stable detail panel that preserves the queue's filters and scroll position. The detail presentation contains:

- Resolved subject identity with canonical navigation.
- Resolved requester identity using the shared person presentation.
- Scope identity, such as the project or instrument.
- Request reason and reviewer notes.
- Requested and reviewed timestamps in browser-local time.
- Current status and exact available actions.
- A bounded impact summary for consequential actions.
- Prior reviewer identity when available.

Approve and Reject are separate actions. Approval uses the default action style unless it triggers permanent deletion. Rejection uses an outlined action unless domain policy treats it as destructive. Permanent deletion approval uses the destructive action style and an alert dialog describing the actual impact.

### Join requests

Project-local and broad join review must share one implementation. Approval selects a role only from API-provided `available_roles`, then atomically creates the project membership and associated access-group state. Rejection may include bounded reviewer notes. The confirmed API response returns both the reviewed request and the authoritative membership created by approval.

Required conflict behavior:

- A duplicate pending request returns a typed conflict and the existing request.
- Approval of a user who is already a member returns a typed conflict and current membership.
- A concurrent or already-resolved review returns a typed stale-state conflict and current request.
- A deleted project or unavailable requester returns an explicit terminal state rather than an untyped server error.
- Repeating the same review decision is either idempotent or returns a typed conflict that permits an authoritative refresh.

### Deletion requests

Deletion review must state whether approval performs immediate permanent deletion, schedules asynchronous deletion, or transitions to another review state. The review detail should expose a bounded impact summary including resource type, resource identity, containing project, relationship impact, file impact, and whether recovery is possible. The Hub must not infer this impact from loaded relationships or files.

Approval and rejection accept an expected version or equivalent precondition. Approval returns the reviewed request plus either the readable resource, a typed tombstone, or a deletion-operation reference. The result must be sufficient for the Hub to update navigation and invalidate affected collections without guessing whether the resource still exists.

## Processing operations

The broad processing console should initially cover ingestion requests and later include typed post-processing requests. It should not expose a generic editable request object.

Recommended filters:

- Status: queued, running, succeeded, failed, cancelled, and any additional documented enum values.
- Operation kind.
- Project.
- Instrument.
- Dataset.
- Requester.
- Created or updated time.

Each operation should include stable request identity, operation kind, status, request, start, update, and completion times, requester, dataset and file references, project and instrument references when authorized, safe failure code and message, bounded progress when meaningful, implementation version, and exact available actions.

Retry and Cancel should use dedicated action operations such as `POST /ingestion_requests/{request_id}/retry` and `POST /ingestion_requests/{request_id}/cancel`, or an equally explicit typed action contract. The current generic PATCH accepting an entire ingestion request should not be used for administrative actions. Retried operations should return the new or updated authoritative request and define idempotency behavior.

## Service-account administration

The implemented service-account area provides search, creation, identity editing, platform-role editing, non-secret key status, one-time credential display, key rotation, instrument operator selection, and project membership selection.

Recommended additions:

- Status values such as active, disabled, and expired where the API supports them.
- Disable and reactivate actions that do not delete historical identity.
- Explicit key revocation without forcing immediate replacement.
- Last-used time and safe usage source when collection is permitted by privacy policy.
- Credential expiration in collection responses or a server-side attention filter so the Hub does not issue one detail request per account.
- Server-side platform-role, lifecycle, expiration, and sort filters.
- A bounded list of project and instrument assignments if the API can provide it without reconstructing access from unrelated groups.
- An immutable audit trail for account creation, role changes, disablement, key rotation, and key revocation without exposing keys.

Platform-role editing is implemented against the pinned API contract from PR #263. It still needs a staging recheck after that deployment because a call made against the preceding deployment returned an unmapped upstream failure when changing a role to Contributor. If the failure remains, API logs should verify the database update and `ServiceAccountAdminDetail` response serialization.

## People and platform roles

Public people pages remain separate from administrative people detail. The administrative directory should expose only fields needed for defined workflows and should not become a general export of personal information.

Potential operations:

- Search human accounts by public identity fields.
- View platform role and account state.
- Change a human platform role through a dedicated endpoint.
- Disable or reactivate an account while retaining audit history.
- Inspect bounded project and instrument responsibilities when authorized.
- Open the public profile without duplicating public presentation.

Each operation needs an exact capability. The existing generic `PATCH /users/{user_id}` edits descriptive profile fields and must not be extended implicitly into role or lifecycle management. Platform-role and account-state changes need dedicated typed operations, confirmation behavior, propagation semantics, and audit events.

Account impersonation is not part of this proposal. Troubleshooting should use audit data, correlation references, capability inspection, and explicit read-only diagnostics rather than acting as another user.

## Audit log

Audit is an immutable history, not an activity feed reconstructed from resource modification timestamps. Initial event families should include:

- Join-request submission, approval, rejection, cancellation, and expiration.
- Direct membership addition, role change, removal, and leave.
- Resource ACL grant, role change, revoke, and public-access change.
- Ownership transfer and project or instrument reassignment.
- Instrument lifecycle changes and operator changes.
- Deletion-request submission and review outcome.
- Service-account creation, role change, lifecycle change, key rotation, and key revocation.
- Processing request, retry, cancellation, failure, and completion.

Each event should contain a stable event ID, typed event kind, timestamp, public-safe actor reference, subject reference, scope references, previous and resulting states where safe, correlation reference, and visibility guidance. Events must exclude credentials, signed URLs, raw file paths, scientific metadata, request bodies, and private fields unrelated to the operation.

The API must define retention, redaction after access loss, service-account representation, event immutability, duplicate suppression, and whether event time represents request, execution, or completion. Cursor pagination and deterministic newest-first ordering are required.

## Capability contract

Account capabilities should expose navigation eligibility without making the Hub derive policy from platform role:

```json
{
  "can_open_administration": true,
  "can_review_join_requests": true,
  "can_review_deletion_requests": false,
  "can_view_processing_operations": true,
  "can_manage_processing": false,
  "can_manage_service_accounts": false,
  "can_manage_people": false,
  "can_view_audit": true
}
```

These booleans mean the caller has at least one accessible scope. They do not authorize every record in a collection.

Project capabilities should add exact scoped guidance where supported:

```json
{
  "can_review_join_requests": true,
  "can_review_resource_deletions": false,
  "can_view_processing_operations": true,
  "can_manage_processing": false,
  "can_view_audit": true
}
```

Instrument capabilities should add:

```json
{
  "can_manage_operators": true,
  "can_view_processing_operations": true,
  "can_manage_processing": true,
  "can_view_audit": true
}
```

Every queue item or detail response should include exact operation guidance such as `can_approve`, `can_reject`, `can_retry`, `can_cancel`, `can_disable`, or an enum `available_actions`. Collection-level capability must not be used to assume that every returned item is actionable.

## Shared API references

Administration responses should reuse resolved public-safe reference models:

```json
{
  "principal": {
    "unique_id": "01...",
    "first_name": "Ada",
    "last_name": "Lovelace",
    "username": "ada",
    "is_service_account": false
  },
  "project": {
    "mfid": "01...",
    "project_id": "accelerator-2026",
    "title": "Accelerator materials"
  },
  "instrument": {
    "mfid": "01...",
    "name": "Beamline microscope"
  },
  "resource": {
    "mfid": "01...",
    "resource_type": "dataset",
    "name": "Calibration scan"
  }
}
```

References should be nullable only when the subject has been deleted or the caller cannot see it. In those cases the response should retain a safe snapshot label and typed unavailable reason so the queue remains understandable.

## Pagination, filtering, and ordering

- Prefer opaque cursor pagination for new queues and audit streams.
- Cursors are tied to authorization scope, filters, ordering, and stable tie-breaking.
- Continue a cursor chain with the same filters and sort. Cursors remain opaque to the Hub.
- Use typed enum filters rather than free-form status strings.
- Provide deterministic default ordering, normally requested time descending with request ID as a stable tie-breaker.
- Return exact totals only where the interface displays them and the query can provide them efficiently.
- Use capped or lower-bound counts explicitly for overview attention summaries.
- Provide canonical project, instrument, principal, and resource filters using MFIDs.
- Never require the Hub to resolve every row through additional identity requests.
- Do not make the Hub merge independently authorized pages into a claim about the complete queue.

## Mutation and concurrency contract

Review and operational mutations should accept an expected version, ETag, or equivalent precondition. A stale mutation returns `409` with a typed conflict code and the current readable record when permitted.

Recommended safe error categories:

- `already_resolved`
- `stale_version`
- `subject_unavailable`
- `requester_already_member`
- `insufficient_scope`
- `action_not_available`
- `operation_already_running`
- `operation_not_retryable`
- `operation_not_cancellable`

Mutation responses return authoritative domain records and any directly created or removed object needed by the client. The Hub should not issue a chain of identity lookups to understand whether an action succeeded.

The API should accept and return a supported correlation header so the Hub's safe reference can be matched to API logs. The value must not contain account identity or credentials.

## Hub implementation

### Component boundaries

Recommended shared components:

- `AdministrationNavigation` for capability-gated section navigation.
- `AdministrationSummaryCard` for counts, precision labels, bounded previews, and View all.
- `ReviewQueue` for responsive queue structure, loading, refresh error, empty state, and pagination.
- `ReviewRequestIdentity` for subject, requester, scope, status, and timestamps.
- `ReviewDecisionDialog` for notes, role selection when applicable, expected-version submission, and local errors.
- `OperationStatusBadge` for typed processing states.
- Existing `PersonIdentity`, `ResourceIdentity`, `MfidValue`, role badges, confirmation dialogs, collection states, and local-time formatting for presentation.

Do not build a universal mutation form that accepts arbitrary fields and actions. Join review, deletion review, retry, cancel, role change, lifecycle change, and credential actions require separate validated server functions.

### Query ownership

Suggested identity-scoped Query-key families:

```text
administration.summary(scope)
administration.joinRequests(scope, filters)
administration.joinRequest(scope, requestId)
administration.deletionRequests(scope, filters)
administration.deletionRequest(scope, requestId)
administration.processing(scope, filters)
administration.processingOperation(scope, operationId)
administration.audit(scope, filters)
```

Contextual cards use the same collection families with canonical project or instrument filters. They do not own duplicate caches under separate feature-specific keys.

### Mutation invalidation

| Action                         | Exact cache update                                              | Required invalidation                                                                                                                                                                                     |
| ------------------------------ | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Approve join request           | Replace request detail and returned project membership          | Matching join queues, Administration summary, project members, project detail shapes, account-visible projects for the requester when applicable                                                          |
| Reject join request            | Replace request detail                                          | Matching join queues and Administration summary                                                                                                                                                           |
| Approve deletion               | Replace request detail and apply returned resource or tombstone | Matching deletion queues, Administration summary, resource detail shapes, project or instrument collections, search, facets, relationships, recent items, and sibling sequences as identified by response |
| Reject deletion                | Replace request detail                                          | Matching deletion queues, Administration summary, and resource deletion-request state                                                                                                                     |
| Retry processing               | Replace or add returned operation                               | Matching processing queues, Administration summary, dataset Processing, file ingestion state, and operation detail                                                                                        |
| Cancel processing              | Replace returned operation                                      | Matching processing queues, Administration summary, dataset Processing, and operation detail                                                                                                              |
| Change service-account role    | Replace exact service-account detail                            | Service-account lists and relevant audit views; authority propagation remains API-defined                                                                                                                 |
| Disable or reactivate identity | Replace exact administrative identity                           | Identity lists, Administration summary, account or session state where relevant, and affected assignment views returned by the API                                                                        |

Invalidation must use canonical MFIDs and affected references from the mutation response. It must not scan arbitrary Query cache contents to infer subjects.

### Loading and failure behavior

- Keep Administration navigation and queue headers stable during reads.
- Use row or card skeletons only for API-owned content.
- Preserve readable queue pages during refresh failures.
- Keep mutation failures within the request detail or dialog that initiated them.
- A failed action does not close the dialog or discard reviewer notes.
- A `403` after navigation becomes a normal unavailable state and refreshes account capabilities; it does not reveal hidden queue data.
- A `404` for a queue item removes or marks only that item after an authoritative queue refresh.
- A stale `409` replaces readable detail with the returned current record and explains that another reviewer acted first.

### Responsive and accessible behavior

- Desktop queues use comparison-friendly tables; compact layouts use labelled stacked rows without horizontal scrolling for primary actions.
- Dialog bodies scroll independently while headers and actions remain reachable.
- Status never relies on color alone.
- Icon-only actions are reserved for familiar low-risk navigation or utilities and retain visible tooltips and accessible names.
- Approve, Reject, Retry, Cancel, Disable, Revoke, and Delete retain text labels.
- Queue filters, decisions, notes, and status controls are keyboard reachable and maintain visible focus.
- Time is displayed in browser-local 24-hour format through the shared formatter.

## Current contract readiness

| Area                    | Available today                                                                        | Missing for robust Hub support                                                                                                                                                                                             |
| ----------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Service accounts        | Directory, create, detail, profile edit, platform-role patch, key status, key rotation | Recheck the role patch after PR #263 deployment; lifecycle, revoke-only, last use, list-level credential attention, filters, audit                                                                                         |
| Join requests           | List, detail, approve or reject; project leads can list groups they lead               | Canonical project MFID filter, resolved project and requester references, typed statuses and decisions, available roles, exact capabilities, cancellation, concurrency, authoritative membership result, cursor pagination |
| Deletion requests       | List, detail, review                                                                   | Exact reviewer capabilities, typed statuses and decisions, expected version, stable project and resource references, impact summary, deletion result or tombstone, cursor pagination, audit semantics                      |
| Ingestion operations    | Admin-wide or scoped list, detail, generic patch                                       | Typed statuses, safe failures, project and instrument filters, exact capabilities, explicit retry and cancel, progress, concurrency and idempotency, cursor pagination                                                     |
| People                  | Public search and profile, generic admin profile patch                                 | Administrative account detail, platform-role operation, lifecycle operation, exact capabilities, filters, audit                                                                                                            |
| Administration overview | None                                                                                   | Capability-gated summary with exact, capped, or lower-bound counts                                                                                                                                                         |
| Audit                   | None                                                                                   | Durable typed event model, scoped authorization, retention, redaction, cursor pagination, filters                                                                                                                          |
| Correlation             | Hub-generated safe reference                                                           | Supported propagation into API logs and returned API correlation identity                                                                                                                                                  |

## Suggested delivery plan

### Phase 1: capability and summary foundation

1. Add account Administration navigation capabilities.
2. Add exact project and instrument scoped capabilities.
3. Add exact item-level available actions.
4. Add `GET /administration/summary` with explicit count precision.
5. Add supported correlation propagation.
6. Build `/admin` and the capability-gated navigation shell after the contract is pinned.

### Phase 2: join review

1. Strengthen join request schemas and canonical project filtering.
2. Return resolved requester and project references.
3. Add typed review input, role selection, concurrency, and authoritative membership result.
4. Implement the broad queue and project Manage card using the same Query and mutation families.
5. Add pending-count invalidation and stale-review recovery.

### Phase 3: deletion review

1. Define reviewer policy for platform, project, instrument, and resource administrators.
2. Add exact capabilities, typed decisions, expected version, impact summary, and deletion result.
3. Implement the broad queue and contextual resource or project entry points.
4. Add tombstone-aware navigation and complete affected-cache invalidation.

### Phase 4: processing operations

1. Publish typed operation states, filters, safe failures, and actions.
2. Add explicit retry and cancel contracts.
3. Implement broad, project-scoped, instrument-scoped, and dataset-scoped views through shared Query families.
4. Add future post-processing kinds without changing queue fundamentals.

### Phase 5: identity lifecycle and audit

1. Add service-account disablement, reactivation, key revocation, last use, filters, and audit.
2. Add dedicated human platform-role and lifecycle operations.
3. Add immutable scoped audit events and the Audit route.
4. Add credential and identity attention summaries only from server-owned queries.

## API acceptance criteria

- OpenAPI contains every capability, enum, filter, response reference, mutation body, conflict response, and pagination field consumed by the Hub.
- Account capability guidance is sufficient to discover Administration navigation without probing protected endpoints.
- Project, instrument, resource, and item responses provide exact operation-specific capabilities.
- Broad queues return only records authorized for the caller and use the same policy as contextual reads.
- Stable canonical MFIDs identify every navigable project, instrument, resource, and identity.
- Queue rows include resolved public-safe references and do not require per-row lookups.
- New queues use opaque cursor pagination and deterministic server-side ordering.
- Filters and status values are typed enums with documented null and unknown behavior.
- Review mutations support stale-write protection and return current state on typed conflicts where permitted.
- Consequential mutations return authoritative affected records or tombstones.
- Summary counts state exact, capped, or lower-bound semantics.
- Correlation references can be followed across Hub and API logs without exposing credentials or personal data.
- Audit retention, privacy, redaction, and visibility are documented before deployment.
- Service-account and human identity lifecycle operations never expose credential material.
- API tests cover platform, project, instrument, resource, service-account, ordinary-member, inaccessible, concurrent, and already-resolved cases.

## Hub acceptance criteria

- Administration navigation appears only from account capabilities and each child is gated independently.
- The broad console never increases authority beyond contextual APIs.
- Project and instrument cards use the same queue records and mutations as the broad console.
- URL-backed filters are type-safe, shareable, and reset pagination when changed.
- Queue continuation follows server cursors without client-side filtering or reordering.
- Readable data remains visible during refresh failures.
- Mutation errors remain local and preserve user input.
- Confirmed responses update exact records and invalidate every documented dependent Query family.
- Stale reviews show the current server result and identify that another actor completed the action.
- Compact layouts keep decision actions reachable and dialog footers visible.
- Keyboard, focus, accessible names, status text, light theme, dark theme, long identity names, and complete MFIDs are validated.
- No credential, signed URL, raw scientific metadata, or private unrelated profile field enters browser persistence, URLs, telemetry, or error messages.

## Policy decisions required before implementation

1. Which project roles may review join requests, and what membership roles may each reviewer grant?
2. May project or instrument administrators approve deletion, or may they only recommend it to a platform reviewer?
3. Does deletion approval immediately remove data, schedule a job, or enter another review state?
4. What operational information may an instrument administrator see for datasets they cannot otherwise read?
5. Which processing actions belong to project administrators, instrument administrators, resource editors, and platform operators?
6. Can service accounts be disabled independently from key revocation, and what happens to active jobs and resource access?
7. Which human platform roles are assignable, by whom, and with what propagation delay?
8. What audit retention and redaction rules apply after an actor or viewer loses access?
9. Which overview counts must be exact, and which may be capped or lower bounds?
10. Should project leads with only scoped review authority see the sidebar label Administration, or should the shared destination use a broader label such as Review and operations?
