# Crucible Hub Information Architecture

Status: Draft 0.1

Date: 2026-09-06

## Purpose and authority

This document owns Hub routes, navigation, shell behavior, page archetypes, and responsive interaction. [Product brief](product-brief.md) owns user intent and workflows; [architecture](architecture.md) owns runtime and data boundaries; [roadmap](roadmap.md) owns delivery order and evidence.

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
| Projects    | Project discovery and project workspaces.                                   |
| Data        | Cross-project samples and datasets.                                         |
| Instruments | Instrument discovery and workspaces.                                        |
| Search      | Cross-resource search and MFID lookup.                                      |
| Activity    | Relevant upload, ingestion, and review status when supported.               |
| Account     | Profile, preferences, and session controls.                                 |
| Admin       | Separate platform-administrator workflows.                                  |

Wide layouts use a persistent sidebar and top utility bar. The top utility bar provides one global Create menu linking to dedicated project, sample, dataset, and eligible instrument creation routes without inferred context. Contextual creation actions remain on project and instrument surfaces because they carry explicit project or instrument preselection. Shortcuts, Theme, and the expand or collapse action form a utility group at the bottom of the sidebar. Expanded navigation shows their labels; collapsed navigation keeps vertically stacked icons with named tooltips. Keyboard navigation includes global destinations plus contextual Overview, Graph, and Manage destinations where those sections exist. Narrow layouts use a drawer or bottom navigation with the same destinations and route structure. Global navigation never duplicates entity-local sections. Entity pages expose their current name in the browser title and place an explicit primary-detail refresh action at the right edge of their section-navigation row. Its tooltip presents the browser-local time of the last successful read.

Home presents recently added data and accessible projects from bounded server collections. A separate Recently viewed card follows recently added data in the primary Home column while accessible projects occupy the adjacent column on wide screens. Recently added and Recently viewed use one resource-row structure with the resource icon and name, icon-labelled project ID and monospaced MFID below, and a creation or last-viewed timestamp aligned opposite. Recently viewed uses only account-scoped React state owned by the persistent application shell. It retains at most eight project, instrument, sample, or dataset identities, displays five, never enters URLs or persistent browser storage, and resets on reload or account replacement.

## Route hierarchy

| Route                                             | Page or behavior                                            |
| ------------------------------------------------- | ----------------------------------------------------------- |
| `/`                                               | Home dashboard.                                             |
| `/data`                                           | Global sample and dataset collection.                       |
| `/search`                                         | Global or project-scoped resource search.                   |
| `/projects`                                       | Project collection.                                         |
| `/projects/new`                                   | Project creation.                                           |
| `/projects/:projectMfid`                          | Project Data index.                                         |
| `/projects/:projectMfid/overview`                 | Project details, scientific metadata, and readable members. |
| `/projects/:projectMfid/settings`                 | Unified project access and resource management.             |
| `/projects/:projectMfid/settings/members`         | Compatibility redirect to project Manage.                   |
| `/projects/:projectMfid/settings/ownership`       | Compatibility redirect to project Manage.                   |
| `/projects/:projectMfid/members`                  | Replacement redirect to project Overview.                   |
| `/instruments`                                    | Instrument collection.                                      |
| `/instruments/new`                                | Instrument registration.                                    |
| `/instruments/:instrumentMfid`                    | Instrument Overview.                                        |
| `/instruments/:instrumentMfid/datasets`           | Instrument-scoped dataset collection.                       |
| `/instruments/:instrumentMfid/settings`           | Unified instrument access and resource management.          |
| `/instruments/:instrumentMfid/settings/lifecycle` | Compatibility redirect to instrument Manage.                |
| `/instruments/:instrumentMfid/settings/operators` | Compatibility redirect to instrument Manage.                |
| `/instruments/:instrumentMfid/settings/ownership` | Compatibility redirect to instrument Manage.                |
| `/samples/:sampleMfid`                            | Canonical sample detail.                                    |
| `/datasets/:datasetMfid`                          | Canonical dataset detail.                                   |
| `/datasets/:datasetMfid/processing`               | Dataset files, ingestion, and processing requests.          |
| `/samples/:sampleMfid/graph`                      | Immediate sample relationship graph.                        |
| `/datasets/:datasetMfid/graph`                    | Immediate dataset relationship graph.                       |
| `/samples/new`                                    | Sample creation with optional project preselection.         |
| `/datasets/new`                                   | Dataset creation with optional context preselection.        |
| `/samples/:sampleMfid/manage`                     | Canonical sample management.                                |
| `/datasets/:datasetMfid/manage`                   | Canonical dataset management.                               |
| `/samples/:sampleMfid/access`                     | Compatibility redirect to sample Manage.                    |
| `/datasets/:datasetMfid/access`                   | Compatibility redirect to dataset Manage.                   |
| `/resources/:resourceMfid`                        | Legacy type-resolving redirect to a canonical entity.       |
| `/people/:userId`                                 | Public-safe person profile.                                 |
| `/account`                                        | Authenticated self-service profile management.              |
| `/activity`, `/admin/*`                           | Activity and separate administrative workflows.             |

## Entity scopes

### Account

The application-bar avatar opens the account menu and links to My profile. The profile route presents the authenticated account identity in a read-first view. Edit profile opens first name, last name, email, and username controls backed by the self-service account operation. Email remains private to the authenticated account view and profile mutation.

### Project

Project routes retain project identity, breadcrumbs, and local navigation while a child section loads. Data is the index and has Samples, Datasets, and All type views; All, Assigned, and Shared are collection filters rather than separate project identities. Rows show their actual primary project and resource detail remains canonical.

The project collection is a compact responsive directory with linked project identity, Lead, Updated, and a trailing full-page action. A missing title falls back to project ID. Minimal API rows present unavailable Lead and Updated values as `-`; Hub does not fabricate sample or dataset counts when the collection contract does not provide them. Lifecycle state is omitted because it does not help distinguish rows in this collection.

Project navigation has Data and Overview plus capability-gated Manage when membership or ownership operations are available. The persistent project header owns the title and project-prefilled sample and dataset creation actions. Overview contains one read-first Project details section with project ID, organization, lead, MFID, Created, and Updated; authorized people can explicitly replace that card with descriptive editing for title, organization, and project ID. A separate scientific metadata section and read-only People section follow. The People section links authorized users directly to Manage and presents the authorization owner as Lead. Manage is one page with direct member addition, allowed role changes, and confirmed removal in Access management. Resource management contains preview-confirm ownership transfer followed by destructive confirmed self-leave. These actions remain distinct from resource ACLs and future join requests. Former Members and Ownership URLs redirect to Manage. No invitation workflow or top-level Members destination exists. A non-member can receive a public-safe project representation without membership-only fields.

The exact project endpoint returns `ProjectWithLead`: `unique_id`, `project_id`, `title`, `organization`, `project_lead_orcid`, resolved `lead`, `status`, `creation_time`, `modification_time`, `members`, `scientific_metadata`, and nullable `capabilities`. Hub renders the resolved public-safe lead in preference to its identifier, uses capabilities only to expose valid actions, and omits the project status badge from the project header. Optional values remain absent or use the standard empty presentation rather than being fabricated.

Project creation is a dedicated route linked from the project collection. It requires a project title, validated project ID, organization, and an existing lead. The current account is the initial lead and bounded people search can replace it. New projects start active and open by returned canonical MFID.

Project-scoped search uses the canonical project MFID to find related samples and datasets across assigned and shared relationships. Its breadcrumb and Back to project action return directly to Project Data, and canonical resource links retain the project for contextual return navigation. Global search remains available without losing its cross-resource scope. A dedicated application-bar QR action scans a valid raw MFID or trusted Crucible resource link, passes the extracted MFID through the API-backed type-resolving resource route, and then opens the canonical entity page. Global search also offers a URL-backed Scientific metadata mode that searches API-provided full-text metadata results and groups supported resource types without presenting loaded-page filtering as complete search.

### Instrument

The instrument directory provides URL-backed Active, Maintenance, and Decommissioned views using API-side status filtering before pagination and links authenticated human accounts to a dedicated registration form. Results use a compact responsive directory with linked instrument identity, Location, Owner, Updated, and a trailing full-page action. An absent name falls back to instrument ID and then MFID. The selected lifecycle view supplies status context, so individual rows do not repeat status badges. Registration requires name, a valid instrument ID, and location, omits owner so the API applies the authenticated human, and opens the returned canonical MFID route. Instrument routes retain identity and local Overview and Datasets navigation plus capability-gated Manage when a lifecycle, operator, or ownership operation is available. Overview presents a read-first Summary with an explicit descriptive edit action for authorized people. Manage has independent Lifecycle, Operators, and Ownership subsections according to exact capabilities. Operators binds service accounts by exact username or MFID and confirms removal. Ownership uses the API preview and explicit confirmation. Lifecycle offers active, maintenance, and decommissioned states through the dedicated API operation, with explicit confirmation before decommissioning. Dataset scope is the API-defined acquisition instrument across readable projects. Hub does not imply a direct project-to-instrument relationship.

### Resource

Resource detail has a persistent identity header and type-specific content for summary, identity, dataset thumbnails, files, relationships, scientific metadata, processing, access, and allowed actions. At wide widths, Overview uses independent vertical stacks: Summary and Files occupy the wider leading column, Identity and Thumbnails occupy the narrower trailing column with the standard section gap, and Relationships and Scientific metadata share an equal-width row below them. Narrow layouts keep each stack together and omit dataset-only sections for samples. Summary includes descriptive fields followed by the current linked project and, for datasets, acquisition instrument. Dataset thumbnails and the compact downloadable file list load as separate browser-initiated representations. Relationship groups use one vertical flow within the half-width card. Scientific metadata uses a row-based JSON tree with first-level collections expanded, deeper disclosures collapsed, types and nesting preserved, and one header control beside Edit for expanding or collapsing the complete tree. Thumbnail editing exposes explicit add, rename, and confirmed delete controls only when `can_edit` is true. Actions stay local to the affected section and preserve readable content during refresh or recovery.

Sample and dataset creation use dedicated routes reachable globally and from project context; instrument context may preselect dataset acquisition. Both require a project, omit caller-assigned MFIDs, and keep descriptive values in place after validation or request failure. Dataset instrument selection is optional. Canonical navigation uses only the API-assigned MFID. An uncertain structural create disables repeat submission and directs the user to check Data because the API has no idempotency contract. Dataset creation can collect optional sample associations, but structural creation completes first. If an association fails, the form locks the confirmed dataset stage and offers recovery for only the incomplete links before canonical navigation.

Sample and dataset routes use a shared parent shell with the persistent resource header and route-backed Overview, Graph, and Manage navigation. Datasets add Processing between Overview and Graph. The breadcrumb shows the resource's canonical primary project. A validated optional `fromProject` search parameter preserves project context across resource sections, while browser history provides chronological return navigation without a separate back action consuming header space. Collection resource previews use a non-modal right inspector at wider widths so the underlying page remains interactive, while compact full-page presentation retains modal behavior. The inspector presents type, name, MFID, and the full-page action as one identity block. Processing, Graph, and Manage data load only when their tab is entered and are not intent-preloaded. Dataset Processing follows the Access management pattern as one page with Files and ingestion followed by Dataset processes. Files and ingestion joins dataset files to their newest reported ingestion request, retains full request history, and submits selected eligible files independently so confirmed requests survive partial failure. Dataset processes remains empty until the API provides durable request identity, status, outputs, and dataset-specific availability. Manage remains available because deletion eligibility has no capability guidance. Public, direct-grant, and project-assignment controls require `can_manage_access`; direct grants and the public control share one access card, with direct access first. User and project grants are bounded by `max_grant_role`. Owner, service-account, instrument, system, and unknown grants are displayed read-only. Publish, unpublish, and revoke require confirmation, and access failures remain local to their section. Project transfer, capability-gated ownership transfer, and reviewed deletion share one resource management card while remaining distinct operations. Ownership transfer uses server preview before explicit confirmation. Reviewed deletion retains a destructive action and remains available without inferring eligibility from unrelated capabilities.

Project assignment appears in sample and dataset Manage when `can_manage_access` is available. Overview Summary shows the current primary project without presenting an authority-changing control. Assignment selects a project by stable MFID, resolves its current project ID at the server boundary, previews the atomic grant and assignment move, and requires explicit confirmation. Dataset instrument context remains read-only because the API has no reassignment operation.

The Relationships section is the canonical management surface for supported sample and dataset links. It states direction explicitly for parent-child and cross-type associations. Add uses an accessible dialog with bounded search constrained to the supported target type. Unlink requires confirmation and removes only the relationship. The section uses the source resource's exact `can_edit` guidance for local controls, while the API authorizes both resources and validates the pair. Relationship controls are absent from the inspector.

The Graph tab is a read-only alternate representation of a sample or dataset's immediate readable relationships. It keeps the resource header and tab navigation mounted while loading locally. Selecting a node opens the existing overlay inspector without resizing the graph; Open navigates to the canonical detail and Explore from here reroots the Graph route on that resource. A collapsed relationship table provides the same identities, types, directions, inspection, canonical navigation, and bounded dataset thumbnail previews without requiring pointer interaction or graph interpretation. Thumbnail failure does not block the graph. Relationship changes remain on Overview rather than turning the visualization into an editor. The bounded prototype is defined by [decision 0026](../decisions/0026-explore-bounded-resource-graphs.md).

### Resource inspector navigation

An optional `preview` search parameter opens a sample or dataset in a right-side overlay above the current resource, project Data, or global Data page. The host page remains mounted, retains its geometry and scroll, and owns collection filters and cursors.

Opening from a closed panel creates one browser-history entry. Following another preview replaces that entry while a bounded in-preview trail supports Previous preview from the inspector top bar. Previous preview returns to the host when the trail is empty. Close returns safely to the host state while preserving its current scroll position. Direct preview entry and reload have no trusted trail. Canonical Open links navigate to the full resource page without leaking unrelated host search state. Invalid, unavailable, denied, loading, and failed previews remain local to the overlay.

The inspector is non-modal without a backdrop when the underlying page remains visible and modal at compact widths where it covers the page. Escape and outside dismissal close it safely, and focus returns to the trigger when possible. It does not reserve persistent layout space or fetch collection rows, files, or speculative related detail.

## Page archetypes

| Archetype               | Required behavior                                                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard               | Bounded continuation data, local recovery, direct canonical navigation.                                                         |
| Collection              | Validated URL state, cursor pagination, lightweight rows, local loading and recovery, and responsive table-to-list containment. |
| Entity detail           | Persistent identity context with independently loading sections and local mutation feedback.                                    |
| Form or guided workflow | Explicit validation, retained drafts, cancellation and unsaved-change handling, and recoverable partial completion.             |
| Interstitial            | Clear permission, missing-resource, or service-recovery guidance without masquerading as empty content.                         |

Page composition assigns semantic width by responsibility. Forms and identity-management lists use the reading boundary, compact actions use capped adaptive tracks, entity detail cards use normal DOM order in the shared wide and narrow grid, and tables or graphs retain workspace width. Responsive layout changes columns without changing reading, focus, or screen-reader order. Optional cards collapse through normal grid placement rather than reserved rows.

Collection grouping and sorting require stable server-owned contracts. Hub must not sort, group, or filter only a loaded cursor page while presenting the result as complete.

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
