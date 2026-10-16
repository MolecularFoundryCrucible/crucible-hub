# Crucible Hub Information Architecture

Status: Active route and navigation contract

Date: 2026-09-16

## Purpose and authority

This document owns Hub routes, navigation, shell behavior, page archetypes, and URL-backed workflow structure. [Product brief](product-brief.md) owns user intent and workflows; [design system](design-system.md) owns visual tokens, component presentation, and responsive layout rules; [architecture](architecture.md) owns runtime and data boundaries; [roadmap](roadmap.md) owns delivery order and evidence. The cross-workspace Administration and contextual project or instrument management specification is in [`administration-workspace.md`](administration-workspace.md).

## Navigation principles

- Use stable MFIDs in canonical paths and preserve validated URL state for collection views.
- Keep global navigation, entity context, and local section navigation visibly distinct.
- Preserve collection context when opening a canonical resource and when using the optional resource inspector.
- Show authorized public-safe representations as valid content, not as failed loading.
- Use direct links for navigation and native browser history, new-tab, and modifier-key behavior.

## Application shell

### Global destinations

| Destination | Purpose                                                                     |
| ----------- | --------------------------------------------------------------------------- |
| Home        | Continuation, bounded summaries, and actions available to the current user. |
| Data        | Cross-project samples and datasets with direct sub-navigation.              |
| Projects    | Project discovery, project workspaces, and quick creation action.           |
| Instruments | Instrument discovery, workspaces, and quick registration action.            |
| Search      | Cross-resource search and MFID lookup.                                      |
| Requests    | Account submission history and authorized deletion review with count badge. |
| Activity    | Proposed account-relevant activity when the API contract is available.      |
| Account     | Profile, preferences, and session controls.                                 |
| Admin       | Capability-gated administration for users and service accounts.             |

Wide layouts use a persistent sidebar and top utility bar; narrow layouts use a drawer with the same destinations and route structure. Home sits at the top of the sidebar, followed by core entities in order: Data (with nested sub-navigation for Samples and Datasets), Projects (with a direct creation action), and Instruments (with a direct registration action). The Administration group follows with Deletion requests (displaying a badge count of submitted requests awaiting review) and, when an eligible human administrator has Administrator view active, Users and Service accounts. A bounded Recent group follows Administration, and Shortcuts, Theme, and the sidebar expand/collapse control form a utility group in the footer.

The top utility bar provides the global search field (`Ctrl K` for global scope, `Ctrl Shift K` for project scope when inside a project context), a QR scanner action that resolves scanned MFIDs or trusted Crucible links through `/resources/:resourceMfid`, one global Create menu linking to dedicated project, sample, dataset, and eligible instrument or service-account creation routes without inferred context, and the account avatar menu. Contextual creation actions remain on project and instrument surfaces because they carry explicit preselection. Entity pages expose their current name in the browser title and place an explicit `RefreshButton` at the right edge of their section-navigation row to refresh the canonical entity representation while preserving independent section-local recovery for Graph, Processing, file, thumbnail, and access queries.

Home presents Recently added data (toggling between All and Mine by authenticated creator, merging bounded sample and dataset results into a stable snapshot) followed by Recently viewed in the primary column, while Your projects (up to seven projects with role badges) and Your instruments (up to seven active managed instruments with `affiliation=owner`) share the adjacent column on wide screens and offer capability-gated creation links when empty plus View all links to their directories. Recently viewed uses server-and-account-scoped React state owned above route error boundaries, retains at most eight project, instrument, sample, or dataset identities (displaying up to five on Home and the newest four in the sidebar), never enters URLs or persistent browser storage, and resets on reload or account replacement.

## Route hierarchy

| Route                                             | Page or behavior                                             |
| ------------------------------------------------- | ------------------------------------------------------------ |
| `/`                                               | Home dashboard.                                              |
| `/data`                                           | Global sample and dataset collection.                        |
| `/search`                                         | Global or project-scoped resource search.                    |
| `/projects`                                       | Project collection.                                          |
| `/projects/new`                                   | Project creation.                                            |
| `/projects/:projectMfid`                          | Project Data index.                                          |
| `/projects/:projectMfid/overview`                 | Project summary, identity, metadata, and members.            |
| `/projects/:projectMfid/settings`                 | Unified project access and resource management.              |
| `/projects/:projectMfid/settings/members`         | Compatibility redirect to project Manage.                    |
| `/projects/:projectMfid/settings/ownership`       | Compatibility redirect to project Manage.                    |
| `/projects/:projectMfid/members`                  | Replacement redirect to project Overview.                    |
| `/instruments`                                    | Instrument collection.                                       |
| `/instruments/new`                                | Instrument registration.                                     |
| `/instruments/:instrumentMfid`                    | Instrument Data index.                                       |
| `/instruments/:instrumentMfid/overview`           | Instrument summary, identity, and scientific metadata.       |
| `/instruments/:instrumentMfid/datasets`           | Compatibility redirect to instrument Data.                   |
| `/instruments/:instrumentMfid/settings`           | Unified instrument access and resource management.           |
| `/instruments/:instrumentMfid/settings/lifecycle` | Compatibility redirect to instrument Manage.                 |
| `/instruments/:instrumentMfid/settings/operators` | Compatibility redirect to instrument Manage.                 |
| `/instruments/:instrumentMfid/settings/ownership` | Compatibility redirect to instrument Manage.                 |
| `/samples/:sampleMfid`                            | Canonical sample detail.                                     |
| `/datasets/:datasetMfid`                          | Canonical dataset detail.                                    |
| `/datasets/:datasetMfid/processing`               | Dataset files, ingestion, and processing requests.           |
| `/samples/:sampleMfid/graph`                      | Immediate sample relationship graph.                         |
| `/datasets/:datasetMfid/graph`                    | Immediate dataset relationship graph.                        |
| `/samples/new`                                    | Sample creation with optional project preselection.          |
| `/datasets/new`                                   | Dataset creation with optional context preselection.         |
| `/samples/:sampleMfid/manage`                     | Canonical sample management.                                 |
| `/datasets/:datasetMfid/manage`                   | Canonical dataset management.                                |
| `/samples/:sampleMfid/access`                     | Compatibility redirect to sample Manage.                     |
| `/datasets/:datasetMfid/access`                   | Compatibility redirect to dataset Manage.                    |
| `/resources/:resourceMfid`                        | Legacy type-resolving redirect to a canonical entity.        |
| `/users/:userId`                                  | Public-safe user profile and administrative detail.          |
| `/account`                                        | Authenticated self-service profile management.               |
| `/account/setup`                                  | ORCID account completion.                                    |
| `/deletion-requests`                              | Submitted requests, review work, and approved audit history. |
| `/activity`                                       | Future account-relevant activity workflows.                  |
| `/admin/users`                                    | Capability-gated user directory and creation.                |
| `/admin/service-accounts`                         | Capability-gated service-account directory and creation.     |
| `/admin/service-accounts/:serviceAccountMfid`     | Service-account profile, role, and credential management.    |

## Entity scopes

### Account

The application-bar avatar menu links to My profile (`/account`), presenting authenticated account identity in a read-first view. Edit profile opens optional first and last name plus required email and username fields backed by the self-service account operation; email remains private to the authenticated account view and mutation. Account access presents assigned platform role, current privilege mode, and Administrator-view availability separately from effective API capability checks. API credential status sits below Profile on wide layouts and between Profile and Account access on compact layouts; self-service credential rotation remains unavailable until it can replace upstream authority and the active Hub session safely.

### Users and administration

The Administration sidebar switch exposes Administrator view only to eligible human accounts (`authorization.can_elevate` or platform role Admin). When active, routine collections, search, detail, and mutations use elevated authority, and a persistent warning action appears in the top bar.

Deletion requests (`/deletion-requests`) is visible to every authenticated account: `scope=submitted` keeps Your requests personal even under elevated authority, while Needs review becomes platform-wide under Administrator view. Approved history comes from the permanent deletion audit for human accounts (personal when standard, platform-wide under Administrator view; unavailable to service accounts), follows the audit endpoint's opaque cursor, links a captured project only when its canonical MFID is available, and opens retained audit details without linking to the deleted resource. Active request tables use API-backed cursor sorting for Resource, Project, Requested by, Requested, and Status (omitting Status in single-status tabs). Reviewable rows support multi-row selection across loaded cursor pages for bulk approval or rejection with a shared optional comment, submitting each request individually and preserving completed reviews on partial failure.

Users (`/admin/users`) and Service accounts (`/admin/service-accounts`) require an eligible human administrator with Administrator view turned on; visiting their routes with the view off renders an `Administrator view is off` prompt with a Turn on action for eligible people and redirects everyone else to Home, while their server functions refuse with `403`. Both directories use `GET /users` (`is_service_account=false` for users and `is_service_account=true` for service accounts) with server-side search, activity filtering (`active_since`, `inactive_since`, `never_active`), keyset cursor pagination, requested totals, and API-owned sorting on Account, Crucible ID, Email (users only), and Last active. Confirmed user or service-account creation invalidates the directory and dependent lists.

The user detail page (`/users/:userId`) shows a public-safe profile and memberships list (with resolved lead and standing role) to the user or administrators, and adds caller-relative capability-gated platform-role editing (None, Contributor, Admin with a one-minute propagation note) and destructive API credential revocation when viewed by an eligible administrator in Administrator view. Service-account detail (`/admin/service-accounts/:serviceAccountMfid`) provides the same profile, Last active timestamp, platform-role, and credential management (including Last used timestamp), plus one-time API key display on creation or confirmed rotation that clears when the dialog closes.

### Project

Project routes retain project identity, breadcrumbs, and local navigation (`Data`, `Overview`, and capability-gated `Manage`) while child sections load. Data (`/projects/:projectMfid`) is the index and switches between Samples and Datasets, with `All`, `Assigned`, and `Shared` as collection filters rather than separate project identities. The project directory (`/projects`) provides URL-backed search, sorting, a right-aligned filter sheet (role or lead affiliation and active-since date), and refresh action, starts a fresh cursor chain on filter or sort change, and displays linked project identity, Lead, Last active, Created, Updated, and a trailing full-page link without fabricating counts or repeating status badges.

Project Overview (`/projects/:projectMfid/overview`) presents the read-first Summary card (editable for title, organization, and project ID when authorized), Identity card (project ID, resolved public-safe lead from `ProjectWithLead`, MFID, Created, Updated), scientific metadata, and a read-only People section that presents the authorization owner as Lead and links authorized users to Manage. Project Manage (`/projects/:projectMfid/settings`) combines Access management (direct member addition, role changes, and confirmed removal), a bounded project-filtered deletion review card for project managers, and Resource management (preview-confirm ownership transfer, destructive confirmed self-leave, and capability-gated permanent deletion with `DELETE` confirmation for empty projects or local blocking-assignment details for non-empty projects). Project creation (`/projects/new`) requires a title, validated project ID, organization, and an existing lead (defaulting to the current account).

Project-scoped search uses the canonical project MFID to find related samples and datasets across assigned and shared relationships. The application-bar search adopts project scope across the project workspace, project search results, and sample or dataset routes reached with a validated `fromProject` parameter, offering an explicit `This project` or `All Crucible` toggle in its popup and returning to Project Data from search breadcrumbs. Global search (`/search`) also offers a URL-backed Scientific metadata mode that queries API full-text metadata results grouped by resource type.

### Instrument

The instrument directory (`/instruments`) provides URL-backed search, sorting, a right-aligned filter sheet (`Active`, `Maintenance`, `Decommissioned`, or `All` lifecycle status, `All` / `Managed by me` management scope, manager person, instrument type, location, and manufacturer), and refresh action, displaying linked instrument identity, Location, Owner, Last active, Created, Updated, and a trailing full-page link. Registration (`/instruments/new`) requires a name, validated instrument ID, and location, omits owner so the API assigns the authenticated person, and navigates to the created canonical MFID.

Instrument routes provide `Data` (the index at `/instruments/:instrumentMfid`, scoping datasets by acquisition instrument across readable projects), `Overview` (read-first Summary with description and location editing, Identity card with instrument ID, MFID, QR code, owner, and timestamps, and scientific metadata), and capability-gated `Manage` (`/instruments/:instrumentMfid/settings`). Manage contains independent Operators (service-account autocomplete and confirmed removal), Lifecycle (`active`, `maintenance`, and confirmed `decommissioned` state changes), Ownership (preview-confirm transfer), and capability-gated permanent deletion for empty instruments.

### Resource

Sample (`/samples/:sampleMfid`) and dataset (`/datasets/:datasetMfid`) routes share a persistent header, primary-project breadcrumb, optional `fromProject` context parameter, and route-backed `Overview`, `Processing` (datasets only), `Graph`, and `Manage` tabs. Processing, Graph, and Manage load their data only when entered.

On Resource Overview, wide screens place Summary, Files (datasets), and Scientific metadata in the leading column and Identity, Thumbnails (datasets), and Relationships in the trailing aside stack; compact screens stack Summary, Identity, Thumbnails, Files, Relationships, and Scientific metadata in order. Thumbnail editing (`can_edit`) provides add, rename, and confirmed delete actions; the Files card (`can_edit` plus upload availability) provides a staged multi-file upload dialog with editable filenames, per-file hashing and progress, reserved-name recovery, and confirmed cancellation. The Relationships section is the canonical editing surface for parent, child, and cross-type links (governed by `can_edit` on the source resource and validated by the API across both endpoints).

Sample (`/samples/new`) and dataset (`/datasets/new`) creation routes accept optional project or instrument preselection, omit caller-assigned MFIDs, initialize the editable timestamp after hydration, and arrange primary/type-specific details in the leading card with `Relationships`, `Scientific metadata`, and dataset `Files` in the trailing column. Structural creation completes before queued relationship mutations and file uploads; if a follow-up stage fails, the form locks the created resource and retries only incomplete stages before navigating to the canonical MFID.

Dataset Processing (`/datasets/:datasetMfid/processing`) presents Files and ingestion (joining dataset files to their newest ingestion request, retaining request history, and submitting selected eligible files independently) followed by Dataset processes. Resource Manage (`/samples/:sampleMfid/manage`, `/datasets/:datasetMfid/manage`) remains reachable because deletion eligibility has no capability guidance. When `can_manage_access` is true, an Access card presents direct grants (capped at `max_grant_role` for users and projects, read-only for owner, service-account, instrument, system, and primary-project grants) before the public-access publish/unpublish control. A Resource management card groups project assignment (`can_manage_access`, with server preview), dataset acquisition-instrument assignment (`can_manage_access`, atomic API update), capability-gated ownership transfer (with server preview), and reviewed deletion request submission.

The Graph tab (`/samples/:sampleMfid/graph`, `/datasets/:datasetMfid/graph`) renders a read-only bounded provenance graph using ELK Layered in a browser worker ([decision 0026](../decisions/0026-explore-bounded-resource-graphs.md), [resource graph API handoff](resource-graph-api-handoff.md)). Initial reads fetch depth-three ancestors, depth-three descendants, and immediate associations of the root resource. Selecting a related node opens the overlay inspector (`Open` navigates to canonical detail; `Explore from here` reroots the graph), and nodes with additional readable topology expose depth-one directional expansion controls on the canvas. URL search parameters persist canvas-only association visibility, dataset thumbnail previews, and Vertical/Horizontal orientation.

### Resource inspector and sibling navigation

An optional `preview` search parameter opens a resource in the right-side overlay inspector above the current resource, project Data, global Data, or deletion-request queue without unmounting or scrolling the host page. Plain clicks on preview links open the inspector (pushing one history entry when opening from closed, and replacing it when following in-panel previews while maintaining an in-panel `Back` trail that closes the inspector when empty); `Ctrl+Click` (`Cmd+Click` on macOS) navigates directly to the canonical route in the same tab, while middle-click and browser new-tab actions open the canonical route in a new tab. The inspector observes only its current detail (plus independent dataset thumbnail and file metadata, displaying up to two thumbnails side by side with arrow pagination when more exist and naturally sorted files bounded to 10 rows with expansion) and provides `Open` for all resources alongside `Graph` and `Delete` for samples and datasets.

Opening a canonical sample or dataset from a loaded collection starts an account-isolated, session-only sibling sequence on Overview (`Browse nearby` when inactive, or Previous/Next and sequence configuration controls when active, with Left and Right Arrow shortcuts while Overview is mounted). The configuration dialog can scope the sequence to all readable resources, primary project, measurement or sample type, owner, or dataset instrument and order by name, creation time, or update time through two-sided anchored reads. Graph, Processing, and Manage preserve the history token without showing sibling controls, and reloads or account changes clear the in-memory sequence.

## Page archetypes and collections

| Archetype               | Required behavior                                                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard               | Bounded continuation data, local recovery, direct canonical navigation.                                                         |
| Collection              | Validated URL state, cursor pagination, lightweight rows, local loading and recovery, and responsive table-to-list containment. |
| Entity detail           | Persistent identity context with independently loading sections and local mutation feedback.                                    |
| Form or guided workflow | Explicit validation, retained drafts, cancellation and unsaved-change handling, and recoverable partial completion.             |
| Interstitial            | Clear permission, missing-resource, or service-recovery guidance without masquerading as empty content.                         |

Sample and dataset collections (`/data`, `/projects/:projectMfid`, `/instruments/:instrumentMfid`) use one URL-backed collection toolbar for resource type, `Group by` facet directory browsing (`None` for the flat list, or sample type, measurement, session, data format, owner, instrument, and primary project where non-redundant), sorting (defaulting to newest-created), and filters. Selecting a facet loads the API-backed group directory and fetches resources only after a group bucket is chosen; wide screens place the group directory beside the selected group's resource table, while narrow screens stack them. Removing a committed filter chip resets collection cursors and preview state while preserving other filters. The global Data toolbar includes a `RefreshButton` that refreshes the active group directory and current cursor chain in place.

## Responsive and accessible behavior

- Keep routes and semantic headings unchanged across widths.
- Prefer stacked controls, horizontally contained data regions, and card or list fallbacks over page-level horizontal overflow.
- Use visible labels, semantic controls, keyboard-operable dialogs, and non-color state cues.
- Preserve focus and announce local loading, failure, and mutation state without replacing stable page context.
- Keep status, permission, lifecycle, and resource type understandable in text as well as color or icons.

## Route validation scenarios

- Deep-link, refresh, Back, Forward, and new-tab navigation preserve canonical identity and appropriate collection state.
- Parent entity identity remains visible while child sections load or recover.
- Collection filters and preview state do not cause unnecessary collection reads or cross-host state leakage.
- Public-safe, empty, denied, missing, loading, and failed states are distinguishable.
- Narrow layouts, keyboard navigation, focus restoration, and theme parity retain the same route behavior.
