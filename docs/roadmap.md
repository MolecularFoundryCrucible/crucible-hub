# Crucible Hub Roadmap

Status: Active

Date: 2026-09-06

## Purpose

This document owns delivery order, entry and completion gates, current status, and the next action. [Product brief](product-brief.md) owns product intent, [information architecture](information-architecture.md) owns route behavior, [architecture](architecture.md) owns technical boundaries, and [Phase 0 evidence](phase-0-evidence.md) owns current verification detail.

## Delivery rules

- Build API-authorized, capability-aware workflows without recreating authorization in Hub.
- Complete one recoverable workflow at a time and keep mutation states local.
- Do not expose a production mutation until the shared session, authentication, same-origin, and CSRF gates are complete.
- Record API-owned blockers in [Crucible API handoff](crucible-api-handoff.md), not as Hub workarounds.
- Treat a package as complete only when its scoped validation and documentation are current.

## Current position

The local fixture workspace has the Phase 0 scaffold, server boundary, generated contract consumption, Query foundation, responsive shell, read workspace, dedicated project, sample, and dataset creation, controlled descriptive and scientific metadata editing, reviewed deletion requests, and direct project membership controls. Production authentication, shared sessions, and production mutation exposure remain blocked by the API-owned login exchange and session boundary.

| Area                                       | Status                                                                                                          |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| Runtime and server-only boundary           | Locally verified; production session gate remains open.                                                         |
| Read workspace                             | Implemented and fixture/browser verified.                                                                       |
| Controlled resource and settings mutations | Implemented and fixture/browser verified; not production-exposed.                                               |
| Direct project membership                  | Add, role change, removal, and self-leave are implemented and fixture/browser verified; not production-exposed. |
| Resource access management                 | Route-backed Access pages and local fixture/browser mutation coverage are implemented; not production-exposed.  |
| Join requests                              | Deferred pending the API-owned identity, status, capability, and efficient project-state contract.              |
| Instrument management                      | Lifecycle, operators, ownership transfer, and registration are implemented for local development.               |
| Resource assignment and ownership          | Sample and dataset project moves and resource ownership transfer are implemented for local development.         |
| Project, sample, and dataset creation      | Dedicated API-backed creation routes are implemented for local development; file upload remains separate.       |
| Uploads and graphs                         | Uploads remain blocked; bounded one-hop resource graph tabs are implemented for local development.              |

## Ordered work packages

### P0: production foundation

1. Finalize the API-owned web login exchange and Hub shared-session contract.
2. Implement and verify authenticated middleware, session rotation, revocation, account replacement, same-origin mutation protection, and CSRF enforcement.
3. Complete upload feasibility evidence for the direct object-storage boundary.
4. Run the production go or no-go review with container, path-prefix, authentication, and operational evidence.

Entry: accepted API login and session contract. Completion: production-shaped authentication, session, security, deployment, and recovery evidence is recorded in [Phase 0 evidence](phase-0-evidence.md).

### P1: useful read workspace

The local read workspace is complete enough for continued feature work: Home continuation, global and project Data collections and filters, projects, instruments and scoped datasets, resource and contextual inspection, bounded search, public-safe people, and on-demand single-file downloads are implemented. Production release remains subject to P0.

#### Resource inspector slice

Implemented and fixture/browser verified. It provides bounded in-place relationship inspection, native history, local failure recovery, and canonical promotion. See [information architecture](information-architecture.md#resource-inspector-navigation) and decisions 0008 and 0009.

#### Project collection inspection

Implemented and fixture/browser verified. It reuses the inspector without altering project collection filters, cursors, geometry, or scroll. See decision 0010.

#### Global Data collection inspection

Implemented and fixture/browser verified. It preserves applied global Data filters and cursor state while preview navigation remains independent of collection reads. See decision 0012.

#### Single-file downloads

Implemented and fixture/browser verified. Links are generated only after activation and remain outside client caches, route state, and logs. The typed response and attachment behavior remain API follow-ups.

#### Resource graph traversal

Implemented for local development. Canonical sample and dataset Graph tabs load an identity-scoped one-hop graph only on entry, provide Cytoscape traversal with the existing overlay inspector, support canonical rerooting through Explore from here, and retain an equivalent relationship table. The prototype uses the untyped CTE endpoint behind strict Hub validation; a typed, bounded API graph contract remains an external dependency. See decision 0026 and [Crucible API handoff](crucible-api-handoff.md).

### P2: controlled self-service management

Completed local slices are descriptive project and instrument Overview editing, sample and dataset summary editing, scientific metadata editing, reviewed resource deletion requests, a consolidated Project Overview, direct project membership, and resource relationship management. Project navigation uses Data and Overview plus capability-gated Manage for route-backed Members and Ownership operations.

Direct membership uses the accepted contract: add an existing user, change an allowed non-owner role, remove a member, or let a non-owner leave. It is separate from resource ACLs, ownership transfer, and future join requests. No invitation workflow is planned. See decisions 0020 and 0021.

#### Resource relationship management

Implemented and fixture/browser verified for local development. Canonical sample and dataset pages provide capability-guided parent, child, and cross-type link management with bounded target search, confirmed unlink, retained failure state, exact source and target rereads, and no resource deletion. Production exposure remains gated on the API relationship contract described in [Crucible API handoff](crucible-api-handoff.md) and the Hub session boundary.

#### Resource access management

Implemented and fixture/browser verified for local development. Route-backed sample and dataset Access pages reuse the canonical parent shell, load ACLs only on Access entry with preload disabled, gate manager controls on exact `can_manage_access`, cap user and project grants with `max_grant_role`, keep non-manageable principals read-only, confirm publish, unpublish, and revoke, and apply server-confirmed non-optimistic mutations. The API shape and production session gate remain the authoritative deployment constraints.

#### Deferred: join requests

Join submission and review remain deferred pending the API-owned workflow described in [Crucible API handoff](crucible-api-handoff.md). Hub must not scan an account-wide request history or issue N+1 identity lookups to construct project-level state and review queues.

#### Instrument lifecycle

Implemented for local development. Instrument Manage has a capability-gated Lifecycle subsection using the dedicated status operation and authoritative instrument response. Hub offers active, maintenance, and decommissioned, confirms decommissioning, preserves local failure state, keeps lifecycle separate from descriptive Overview editing, and provides API-filtered directory views for every state. The API's untyped status parameter and response, transition rules, and error outcomes remain documented in [Crucible API handoff](crucible-api-handoff.md).

#### Instrument operators, registration, ownership, and project moves

Implemented and fixture/browser verified for local development. Instrument Manage has separate Operators and Ownership subsections. Operators resolve an exact service-account username or MFID, replace the API's complete returned list, and confirm removal. Ownership for projects, instruments, samples, and datasets uses server preview before explicit confirmation. Sample and dataset Access offers the equivalent preview-confirm project move without implying any project-to-instrument relationship. Instrument registration is a dedicated route for human accounts, validates the API's instrument ID rule, omits owner, and opens the returned canonical MFID.

Dataset instrument reassignment is omitted because the API intentionally freezes the legacy PATCH fields and exposes no dedicated atomic operation. Browser upload orchestration remains blocked by proposed decision 0005 and the API requirements in [Crucible API handoff](crucible-api-handoff.md); Hub does not expose a misleading or insecure upload control.

#### Project, sample, and dataset creation

Implemented and fixture/browser verified for local development without file upload. Dedicated routes validate contract fields, use bounded project, instrument, sample, and lead selectors, omit caller-assigned MFIDs, and navigate from API-assigned canonical identities. Confirmed rejections retain correctable drafts. Uncertain sample and dataset creates do not retry without API idempotency and direct the user to check Data before resubmitting. Dataset sample associations begin only after confirmed creation and retry only incomplete links. File attachment remains a later stage until the upload contract is safe for browsers.

#### Next action: resource graph usability verification

Complete the user-led local usability pass for sample and dataset graph traversal, then record interaction and contract corrections before adding depth, graph filters, or editing. Production exposure remains blocked by P0.

### P3: Explorer convergence

Move advanced graph and data workflows only after the bounded graph prototype demonstrates feature, performance, accessibility, and usage parity. Migrate specialized viewers individually behind stable contracts and accountable ownership. Do not add new runtime handoffs to Explorer.

### P4: high-scale management

Add API-backed bulk operations, saved views, exports, richer activity and audit timelines, and administration only with the corresponding API, privacy, and operational contracts.

## External dependencies

| Dependency                      | Required outcome                                                                                                               |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Web login exchange              | One-time, server-to-server credential exchange suitable for opaque Hub sessions.                                               |
| Session infrastructure          | Shared storage, encryption and rotation approach, revocation behavior, and multi-replica verification.                         |
| Upload contract                 | Authorized direct upload lifecycle, CORS, retry, resume, expiry, cleanup, and non-production feasibility evidence.             |
| Collection and search contracts | Owned-resource filtering, stable sorting and grouping, scalable facets, and bounded summaries where requested.                 |
| Resource graph contract         | Typed nodes and edges, relationship semantics, bounded depth, truncation, permission behavior, and stable error outcomes.      |
| Mutation contracts              | Operation-specific capability guidance, conditional-write safety, complete authoritative responses, and clear-field semantics. |

## Completion gates

- Every included route or mutation has usable loading, empty, failure, authorization, and narrow-layout behavior.
- Tests prove request scope, cache isolation, cancellation, keyboard behavior, and recovery appropriate to the package.
- Browser-visible data and telemetry never receive credentials, signed links, or secrets.
- Production work additionally proves the accepted session and mutation boundary. Fixture success alone does not clear this gate.
- API-dependent gaps are omitted or labeled, never simulated with unbounded client work.
