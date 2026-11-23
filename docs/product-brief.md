# Crucible Hub product brief

Crucible Hub is the authenticated browser workspace where scientists find, organize, understand, share, and manage the Crucible resources they can access. It brings the approachable, capability-aware experience of Crucible Lens to dense desktop research work.

## Boundaries

| System                    | Relationship                                                                                                       |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `crucible-api`            | Hub consumes its contract. The API owns authorization, persistence, lifecycle, uploads, and scientific processing. |
| `crucible-lens`           | Hub follows compatible interaction principles, designed for the browser.                                           |
| `crucible_graph_explorer` | Hub replaces proven generic workflows with native ones; specialized scientific viewers stay in Explorer.           |
| `nano-crucible`           | Hub mirrors user workflows that suit a browser, without adopting Python or CLI architecture.                       |

Hub uses MFIDs for routes, links, cache identity, and relationships; editable slugs are labels and lookup input. Capability guidance from the API only shapes presentation: the API authorizes every operation. Accessible and owned resources are distinct sets, and Hub never emulates missing server-side filtering with partial client-side scans.

## Principles

1. Make scientific context clear: resource, project, instrument, provenance, owner, access, and next action read as one story.
2. Make mutations trustworthy: validate intent, keep failed drafts, show partial progress, retry only incomplete work, and preview consequential operations.
3. Keep large workspaces responsive: load collections before detail, paginate, keep readable data during refresh, and never cache credentials or signed URLs.
4. Keep view state shareable: filters, tabs, selections, and graph options live in validated URLs.
5. Design for keyboard and screen-reader use, visible focus, contrast, reduced motion, and narrow layouts from the start.

## Users and jobs

| User                   | Primary jobs                                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Researcher             | Find resources, inspect data and provenance, create records, upload files, edit metadata, recover incomplete work. |
| Project manager        | Understand project data, manage members and roles, review join requests, organize resources and access.            |
| Instrument manager     | Maintain instrument identity and lifecycle, manage members and operators, inspect produced datasets.               |
| Platform administrator | Manage people, service accounts, and credentials in Administrator view.                                            |

## Product surfaces

Routes, shell, and section structure are owned by [information architecture](information-architecture.md); planned work is in the [roadmap](roadmap.md).

- Home: recently added data, recently viewed resources, your projects, and your instruments.
- Data, project Data, and instrument Data: cursor-paginated sample and dataset collections with filters, API-backed grouping, server-side sorting, and the resource inspector.
- Search: grouped cross-resource search, scientific metadata search, MFID lookup, QR scanning, and project-scoped search.
- Resource pages: identity, descriptive and scientific metadata, files, thumbnails, relationships, processing, graph, access, and lifecycle actions, with Previous and Next through sibling resources.
- Project and instrument pages: data, overview, members, and capability-gated management.
- Requests: deletion requests and join requests, each with your submissions and the requests you can review.
- Account: profile, sign-in methods, sessions, API keys, sign-in history, and preferences.
- Administration: users, accounts awaiting approval, and service accounts, available only in Administrator view.

## Workflows

### Find and understand

People reach canonical resource pages from Home, collections, search, an MFID link, or a QR code. QR scanning starts only after an explicit action, decodes locally, and resolves every MFID through the API. The graph is an alternate view of provenance; the Relationships card and the inspector carry the same information without it.

### Create and upload

Projects, samples, datasets, and instruments have dedicated creation routes. The API assigns MFIDs ([decision 0025](../decisions/0025-let-api-assign-creation-mfids.md)). Structural creation completes first; relationships, metadata, and files follow as later stages, and each completed stage stays visible so a retry never repeats successful work. File bytes go directly to object storage with per-file progress and confirmed cancellation ([decision 0005](../decisions/0005-direct-object-storage-uploads.md)).

### Manage resources and access

Descriptive edits, scientific metadata, relationships, files, access, project assignment, ownership transfer, instrument lifecycle, and deletion are separate operations, confirmed where consequential and never optimistic. Project membership is separate from resource access: members are added directly, and people outside a project can ask to join. Deletion of samples and datasets goes through review ([decision 0019](../decisions/0019-request-resource-deletion-through-review.md)). Administrator authority is explicit and temporary ([decision 0031](../decisions/0031-scope-administrator-authority.md)). One-time credentials are shown once and never stored in Query state, URLs, or browser storage.

## Release requirements

- User credentials stay server-side behind opaque browser sessions ([authentication](authentication.md)).
- Every release pins an API contract and verifies the browser, server boundary, accessibility, and error recovery in scope ([releases](releases.md)).
- Hub never uses a platform-administrator credential for normal user work.
- Explorer workflows move to Hub only after feature, performance, accessibility, and usage parity.
