# Crucible Hub Product Brief

Status: Draft 0.1

Date: 2026-09-06

## Product statement

Crucible Hub is the authenticated browser workspace for scientists to find, organize, understand, share, and manage the Crucible resources they can access. It extends the approachable, capability-aware experience of Crucible Lens to dense desktop research workflows.

## Product boundaries

| Authority                 | Hub responsibility                                                                                                                                                      |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `crucible-api`            | Hub consumes its contract and presents API-authorized resources and operations. The API owns authorization, persistence, lifecycle, uploads, and scientific processing. |
| `crucible-lens`           | Hub follows compatible interaction principles while designing for the browser.                                                                                          |
| `crucible_graph_explorer` | Hub incrementally replaces proven generic workflows with native experiences. Specialized viewers move only when individually ready.                                     |
| `nano-crucible`           | Hub mirrors supported user workflows where they suit a browser, without adopting Python or CLI architecture.                                                            |

Hub uses stable MFIDs for routes, links, cache identity, and relationships. Editable slugs are labels and lookup input, not canonical identity. Hub capability guidance affects presentation only: the API always authorizes the operation.

## Product principles

1. Make scientific context clear: resource, project, instrument, provenance, owner, access, and next action belong in one understandable story.
2. Make mutations trustworthy: validate intent, preserve failed drafts, show partial progress, retry only incomplete work, and preview consequential operations.
3. Keep large workspaces responsive: load collections before detail, paginate, retain readable data during refresh, and never cache credentials or signed download URLs.
4. Keep view state shareable: filters, tabs, selections, and graph focus belong in useful, validated URLs.
5. Design for accessible keyboard and screen-reader use, visible focus, contrast, reduced motion, and narrow layouts from the start.

## Users and jobs

| User                   | Primary jobs                                                                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Researcher             | Find resources, inspect data and provenance, create records, upload files, edit allowed metadata, and recover from incomplete work.        |
| Project manager        | Understand project data, manage direct members and roles, review future join requests, organize resources, and manage authorized access.   |
| Instrument manager     | Maintain instrument identity and lifecycle, manage operators, and inspect produced datasets.                                               |
| Platform administrator | Handle exceptional review and account workflows in a separate administrative area. This is not required for the first user-facing release. |

## Product destinations

Hub provides Home, Projects, Data, Instruments, Search, Activity, Account, and a capability-gated Admin area. The detailed route hierarchy, shell, entity sections, and responsive behavior are authoritative in [information architecture](information-architecture.md).

The core product surfaces are:

- Home for immediate research continuation through recently added data, accessible projects, and account-isolated resources viewed during the current browser session.
- Data for cross-project sample and dataset discovery, ownership and type-specific facet filtering, API-backed grouped browsing, server-owned sorting, collection preview, and canonical detail navigation.
- Project and instrument workspaces for scoped list and grouped data browsing, context, and capability-gated management.
- Resource detail for identity, descriptive and scientific metadata, dataset thumbnails, files, relationships, access, activity, and lifecycle-aware actions.
- Search, scientific metadata search, direct MFID lookup, and local QR scanning for bounded cross-resource discovery, with project-scoped sample and dataset search available from an active project.
- Account for reviewing and updating the authenticated person's own name, email, and username from the application-bar profile menu.

Accessible and owned resources are distinct sets. Hub must not invent a personal-project model or emulate unavailable server-side filtering with incomplete client-side scans.

## High-value workflows

### Find and understand

Scientists navigate from Home, Projects, Data, Instruments, Search, an MFID link, or an MFID QR code to canonical resource detail. QR scanning starts only after an explicit application-bar action, decodes camera frames locally, and passes every extracted MFID through API-backed canonical resource resolution. Home keeps an account-isolated, memory-only list of resources viewed during the current application session and clears it on reload or account replacement. Global search groups readable resource types and offers a separate full-text scientific metadata scope, while project-scoped search limits results to related samples and datasets, names the active project in the application bar, and preserves a direct return to Project Data. Sample and dataset collections request bounded 100-row cursor pages and append the next page as the person approaches the collection boundary while retaining explicit load and retry controls. Opening a canonical sample or dataset from a collection retains a session-only sibling sequence on its detail page. Canonical detail also exposes a compact Browse nearby control for rebuilding the sequence around the current resource by primary project, measurement or sample type, owner, or dataset instrument and ordering it by name, creation time, or update time. Previous and Next actions and Left and Right Arrow keys continue each direction only when its loaded boundary is reached. Sample and dataset Graph tabs provide a bounded visual traversal from one resource to its readable neighbours, with the same information available as a relationship table. Graphs are an alternate representation, never the only way to understand provenance.

Dataset Overview loads thumbnail previews and a compact downloadable file list independently after the browser hydrates. Dataset Processing combines file identity, latest ingestion state, ingestion request history, and authorized file-scoped ingestion requests without obscuring quick downloads on Overview. A separate Dataset processes section reserves a stable location for API-advertised post-processing requests when their durable request and capability contracts exist. Readable graph datasets may include a bounded first-thumbnail preview in the equivalent relationship list. People with edit capability can explicitly enter thumbnail editing to add, rename, or delete images; Overview remains read-first.

### Create and upload

Creation uses dedicated project, sample, and dataset routes. Sample and dataset creation selects a project, dataset creation may select a registered instrument, and both resource forms may queue supported parent-child or cross-type relationships. All selectors retain canonical MFIDs while the server resolves mutable API slugs. Hub omits canonical identity from creation input and navigates by the API-assigned MFID. Structural creation is confirmed before relationship, scientific metadata, or file operations become later stages. Each completed stage remains visible after a later failure so retry never duplicates successful work.

### Manage resources and access

Descriptive edits, scientific metadata, relationship changes, file workflows, direct resource access, project assignment, ownership transfer, instrument lifecycle, and deletion review are distinct operations. Consequential changes use API previews and explicit confirmation where supported.

Project membership is separate from resource ACLs. Directly adding an existing person, changing a non-owner role, removing a member, and leaving a project do not create invitation state. No invitation workflow is planned. Join requests remain a separate future workflow.

Relationship management is a separate resource workflow. Canonical sample and dataset pages may manage supported parent-child and cross-type associations with explicit direction, bounded type search, confirmed unlink, and no deletion of either resource. The API authorizes both resources; Hub capability guidance controls presentation only. Relationship controls do not appear in the inspector, and production exposure waits for the API relationship contract and Hub session gate.

Resource management is a separate canonical workflow at `/samples/:sampleMfid/manage` and `/datasets/:datasetMfid/manage`. It provides a persistent resource header with Overview, Graph, and Manage navigation, loads ACL data only on Manage entry, and presents access controls when the exact `can_manage_access` capability allows them. Public controls, bounded user or project grants, atomic primary-project assignment, dataset acquisition-instrument assignment, ownership transfer, and reviewed deletion requests remain distinct actions within Manage and are explicitly confirmed where consequential. Owner, service-account, instrument, system, and unknown grants remain read-only. Management mutations are server-confirmed and never optimistic.

Project and instrument Manage pages use the same unified card structure without nested navigation. Access management contains project members or instrument operators. Resource management contains project ownership and leaving, or instrument lifecycle and ownership. Each section and action remains gated by its exact API capability.

## Delivery direction

Phase 0 establishes the contract, security, design, and runtime foundation. Phase 1 delivers the useful read workspace. Phase 2 adds controlled self-service management, beginning with safe, independently recoverable operations. Phase 3 migrates generic Explorer workflows only after measured parity. Phase 4 adds high-scale capabilities such as bulk actions, saved views, richer audit history, and administration.

The ordered packages, gates, current implementation status, and next action are authoritative in [roadmap](roadmap.md). Current verification is authoritative in [Phase 0 evidence](phase-0-evidence.md). API-owned needs are maintained only in [Crucible API handoff](crucible-api-handoff.md).

## Release requirements

- Production authentication keeps user credentials server-side behind opaque browser sessions.
- Every release uses a pinned API contract and verifies the browser, server boundary, accessibility, and error-recovery behavior in scope.
- Hub never uses a platform-administrator credential for normal user work.
- Explorer routes retire only after measured feature, performance, accessibility, and usage parity.
