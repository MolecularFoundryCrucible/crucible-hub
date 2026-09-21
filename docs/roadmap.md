# Crucible Hub Roadmap

Status: Active

Date: 2026-09-16

## Purpose

This document owns delivery order, entry and completion gates, current status, and the next action. [Product brief](product-brief.md) owns product intent, [information architecture](information-architecture.md) owns route behavior, [architecture](architecture.md) owns technical boundaries, and [foundation evidence](phase-0-evidence.md) owns current verification detail.

## Delivery rules

- Build API-authorized, capability-aware workflows without recreating authorization in Hub.
- Complete one recoverable workflow at a time and keep mutation states local.
- Do not expose a production mutation until the shared session, authentication, same-origin, and CSRF gates are complete.
- Record API-owned blockers in [Crucible API handoff](crucible-api-handoff.md), not as Hub workarounds.
- Treat a package as complete only when its scoped validation and documentation are current.

## Current position

The local workspace has the runtime and server boundary, generated contract consumption, identity-scoped Query foundation, responsive shell and design system, global and contextual discovery, cursor-paginated and grouped collections, resource previews and sibling navigation, canonical resource workspaces, creation and controlled management workflows, graph and dataset processing views, and the first capability-gated service-account administration slice. Production authentication, shared sessions, and production mutation exposure remain blocked by the API-owned login exchange and session boundary.

| Area                                        | Status                                                                                                                                                                                           |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Runtime and server-only boundary            | Locally verified; production authentication and shared-session gates remain open.                                                                                                                |
| Read and discovery workspace                | Home continuation, global and project search, QR lookup, directory ownership scopes, cursor pagination, facets, grouped browsing, previews, and sibling navigation are implemented locally.      |
| Resource workspaces                         | Project, instrument, sample, and dataset routes with Overview, Data or Processing, Graph where applicable, and capability-gated Manage surfaces are implemented locally.                         |
| Controlled mutations                        | Descriptive and metadata edits, creation, relationships, access, membership, assignment, ownership, lifecycle, thumbnails, ingestion requests, and deletion requests are implemented locally.    |
| Account profile                             | Read-first identity editing, non-secret API credential status, and advertised account capabilities are implemented locally. Self-service key rotation waits for the production session contract. |
| Service-account administration              | Capability-gated directory, creation, profile and platform-role editing, credential status, one-time key display, and key rotation are implemented locally. Staging role mutation needs recheck. |
| Broader administration and account activity | Proposed in [administration workspace](administration-workspace.md); review queues, people administration, audit, pins, and account activity await API contracts.                                |
| Uploads                                     | Browser upload remains blocked by the secure exact-object capability, lifecycle, and CORS contract.                                                                                              |
| Production exposure                         | Blocked by the API-owned login exchange, shared server sessions, same-origin and CSRF evidence, and deployment decisions.                                                                        |

## Ordered work packages

### P0: production foundation

1. Finalize the API-owned web login exchange and Hub shared-session contract.
2. Implement and verify authenticated middleware, session rotation, revocation, account replacement, same-origin mutation protection, and CSRF enforcement.
3. Complete upload feasibility evidence for the direct object-storage boundary.
4. Run the production go or no-go review with container, path-prefix, authentication, and operational evidence.

Entry: accepted API login and session contract. Completion: production-shaped authentication, session, security, deployment, and recovery evidence is recorded in [foundation evidence](phase-0-evidence.md).

### P1: useful read workspace

The local workspace is complete enough for continued feature work: Home continuation with session-only recently viewed resources and bounded ownership sections, global and project Data collections with filters and API-backed grouped browsing, ownership-scoped project and instrument directories, grouped scoped datasets, resource and contextual inspection, bounded name and scientific metadata search, file-scoped dataset ingestion requests and history, explicit entity refresh, public-safe people, and on-demand single-file downloads are implemented. Production release remains subject to P0.

#### Grouped collection browsing

Implemented for local development. Type-specific global Data, Project Data, and Instrument Datasets can switch between the existing list and an API-backed group directory. Facet counts, canonical labels, configurable label or count ordering, null buckets, and bucket pagination remain server-owned; selecting one group lazily starts the normal filtered resource cursor chain. Browse state is URL-backed and uses one shared presentation and mapping model across scopes. Canonical detail pages expose a compact sibling control and can rebuild a two-sided sequence around the current resource by supported scope and sort through anchored API reads. Cross-device saved views remain deferred to the contracts in [Crucible API handoff](crucible-api-handoff.md).

#### Resource inspector slice

Implemented and fixture/browser verified. It provides bounded in-place relationship inspection, native history, local failure recovery, and canonical promotion. See [information architecture](information-architecture.md#resource-inspector-navigation) and decisions 0008 and 0009.

#### Project collection inspection

Implemented and fixture/browser verified. It reuses the inspector without altering project collection filters, cursors, geometry, or scroll. See decision 0010.

#### Global Data collection inspection

Implemented and fixture/browser verified. It preserves applied global Data filters and cursor state while preview navigation remains independent of collection reads. See decision 0012.

#### Single-file downloads

Implemented and fixture/browser verified. Links are generated only after activation and remain outside client caches, route state, and logs. The typed response and attachment behavior remain API follow-ups.

#### Resource graph traversal

Implemented for local development. Canonical sample and dataset Graph tabs load an identity-scoped graph only on entry from the typed `GET /resources/{resource_mfid}/graph` operation and use separate lineage depth-three upstream and downstream requests so traversal follows direct ancestor and descendant paths without changing direction into sibling branches. Those paths merge with the current resource's direct associations. React Flow with ELK Layered provides collision-free directional lineage placement that adapts to compact screens, draggable nodes, reset and native fullscreen controls, neighborhood emphasis, semantic node and edge styling, loading and arrangement feedback, reduced-motion-aware animated updates, and direct node expansion while retaining the existing inspector and canonical rerooting. Nodes with confirmed additional readable topology support independently cached ancestor, descendant, and association expansion from React node controls and the equivalent accessible relationship card. Completed directions are removed from the available actions. The Hub merges responses by node MFID and stable edge ID, preserves API-provided relationship semantics, and reports truncation without requesting neighbour detail. See decision 0026 and [resource graph API handoff](resource-graph-api-handoff.md).

#### Dataset thumbnails

Implemented for local development. Dataset Overview loads an independent, browser-initiated thumbnail gallery after hydration. Exact `can_edit` guidance exposes an explicit edit state for add, rename, and confirmed delete operations. Graph relationship lists request first previews in a separate bounded batch. Image payloads remain outside detail, collection, loader, URL, and persistent state. Production mutation exposure remains gated on P0, while the OpenAPI documentation gaps are recorded in [Crucible API handoff](crucible-api-handoff.md).

### P2: controlled self-service management

Completed local slices are descriptive project and instrument Overview editing, sample and dataset summary editing, scientific metadata editing, reviewed resource deletion requests, a consolidated Project Overview, direct project membership, and resource relationship management. Project navigation uses Data and Overview plus capability-gated Manage for route-backed Members and Ownership operations.

Direct membership uses the accepted contract: add an existing user, change an allowed non-owner role, remove a member, or let a non-owner leave. It is separate from resource ACLs, ownership transfer, and future join requests. No invitation workflow is planned. See decisions 0020 and 0021.

#### Resource relationship management

Implemented and fixture/browser verified for local development. Canonical sample and dataset pages provide capability-guided parent, child, and cross-type link management with bounded target search, confirmed unlink, retained failure state, exact source and target rereads, and no resource deletion. Production exposure remains gated on the API relationship contract described in [Crucible API handoff](crucible-api-handoff.md) and the Hub session boundary.

#### Resource management

Implemented and fixture/browser verified for local development. Route-backed sample and dataset Manage pages reuse the canonical parent shell, load ACLs only on Manage entry with preload disabled, gate access controls on exact `can_manage_access`, cap user and project grants with `max_grant_role`, keep non-manageable principals read-only, contain ownership and reviewed deletion actions, confirm consequential mutations, and apply server-confirmed non-optimistic state. The API shape and production session gate remain the authoritative deployment constraints.

#### Deferred: join requests

Join submission and review remain deferred pending the API-owned workflow described in [Crucible API handoff](crucible-api-handoff.md). Hub must not scan an account-wide request history or issue N+1 identity lookups to construct project-level state and review queues.

#### Instrument lifecycle

Implemented for local development. Instrument Manage places capability-gated lifecycle controls in its unified Resource management card using the dedicated status operation and authoritative instrument response. Hub offers active, maintenance, and decommissioned, confirms decommissioning, preserves local failure state, keeps lifecycle separate from descriptive Overview editing, and provides API-filtered directory views for every state. The API's untyped status parameter and response, transition rules, and error outcomes remain documented in [Crucible API handoff](crucible-api-handoff.md).

#### Instrument operators, registration, ownership, and resource assignment

Implemented for local development. Instrument Manage places operators in Access management and ownership in Resource management on one page. Operators resolve an exact service-account username or MFID, replace the API's complete returned list, and confirm removal. Project Manage similarly separates member and role controls from ownership transfer and leaving. Ownership for projects, instruments, samples, and datasets uses server preview before explicit confirmation. Sample and dataset Manage offers the equivalent preview-confirm project move without implying any project-to-instrument relationship. Dataset Manage also offers locally confirmed acquisition-instrument reassignment through the dedicated atomic API operation, updates the canonical instrument identity from the response, and refreshes derived access and dependent collections. Instrument registration is a dedicated route for human accounts, validates the API's instrument ID rule, omits owner, and opens the returned canonical MFID.

Browser upload orchestration remains blocked by proposed decision 0005 and the API requirements in [Crucible API handoff](crucible-api-handoff.md); Hub does not expose a misleading or insecure upload control.

#### Project, sample, and dataset creation

Implemented and fixture/browser verified for local development without file upload. Dedicated routes validate contract fields, use bounded project, instrument, sample, and lead selectors, omit caller-assigned MFIDs, and navigate from API-assigned canonical identities. Confirmed rejections retain correctable drafts. Uncertain sample and dataset creates do not retry without API idempotency and direct the user to check Data before resubmitting. Dataset sample associations begin only after confirmed creation and retry only incomplete links. File attachment remains a later stage until the upload contract is safe for browsers.

#### Next action: production boundary and administration verification

Keep the implemented local workspace stable while the API-owned web login exchange and shared-session contract remain the release-critical path. Recheck service-account platform-role mutation against the deployed API revision, then implement broader Administration routes only as their capability, queue, mutation, and audit contracts become available. Browser upload, production mutations, and deployment remain blocked by P0.

### P3: Explorer convergence

The bounded graph workspace now owns typed topology, ELK layout, direct expansion, inspection, accessible table parity, and URL-backed canvas display preferences. Migrate specialized viewers individually behind the build-time registry and typed representation boundary in decision 0030. Establish the shared viewer route and shell with one browser-suitable viewer before moving server-heavy formats. Do not add new runtime handoffs to Explorer.

### P4: high-scale management and administration

The first service-account administration slice is implemented locally. Add broader review queues, people administration, audit, pins, activity, API-backed bulk operations, saved views, and exports only with the corresponding API, privacy, and operational contracts. The proposed route and capability model is in [administration workspace](administration-workspace.md).

## External dependencies

| Dependency                      | Required outcome                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Web login exchange              | One-time, server-to-server credential exchange suitable for opaque Hub sessions.                                                                                                                                                                                                                                                                 |
| Session infrastructure          | Shared storage, encryption and rotation approach, revocation behavior, and multi-replica verification.                                                                                                                                                                                                                                           |
| Upload contract                 | Authorized direct upload lifecycle, CORS, retry, resume, expiry, cleanup, and non-production feasibility evidence.                                                                                                                                                                                                                               |
| Collection and search contracts | Owned-resource filtering, stable sorting and grouping, scalable facets, and bounded summaries where requested.                                                                                                                                                                                                                                   |
| Resource graph contract         | Typed nodes and edges, relationship semantics, bounded depth, truncation, permission behavior, and stable error outcomes.                                                                                                                                                                                                                        |
| Mutation contracts              | Operation-specific capability guidance, conditional-write safety, complete authoritative responses, and clear-field semantics. The proposed pins, activity, join-review, administration, collection-summary, and processing contracts are prioritized in the [dynamic Hub capability plan](crucible-api-handoff.md#dynamic-hub-capability-plan). |

## Completion gates

- Every included route or mutation has usable loading, empty, failure, authorization, and narrow-layout behavior.
- Tests prove request scope, cache isolation, cancellation, keyboard behavior, and recovery appropriate to the package.
- Browser-visible data and telemetry never receive credentials, signed links, or secrets.
- Production work additionally proves the accepted session and mutation boundary. Fixture success alone does not clear this gate.
- API-dependent gaps are omitted or labeled, never simulated with unbounded client work.
