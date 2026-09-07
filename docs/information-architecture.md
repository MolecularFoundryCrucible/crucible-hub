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

Wide layouts use a persistent sidebar and top utility bar. The top utility bar provides one global Create menu linking to dedicated project, sample, dataset, and eligible instrument creation routes without inferred context. Contextual creation actions remain on project and instrument surfaces because they carry explicit project or instrument preselection. A collapsed sidebar retains accessible names through tooltips. Narrow layouts use a drawer or bottom navigation with the same destinations and route structure. Global navigation never duplicates entity-local sections.

## Route hierarchy

| Route                                             | Page or behavior                                            |
| ------------------------------------------------- | ----------------------------------------------------------- |
| `/`                                               | Home dashboard.                                             |
| `/data`                                           | Global sample and dataset collection.                       |
| `/search`                                         | Cross-resource search.                                      |
| `/projects`                                       | Project collection.                                         |
| `/projects/new`                                   | Project creation.                                           |
| `/projects/:projectMfid`                          | Project Data index.                                         |
| `/projects/:projectMfid/overview`                 | Project details, scientific metadata, and readable members. |
| `/projects/:projectMfid/settings`                 | Redirect to available project management or Overview.       |
| `/projects/:projectMfid/settings/members`         | Capability-gated direct member management.                  |
| `/projects/:projectMfid/settings/ownership`       | Capability-gated ownership transfer.                        |
| `/projects/:projectMfid/members`                  | Replacement redirect to project Overview.                   |
| `/instruments`                                    | Instrument collection.                                      |
| `/instruments/new`                                | Instrument registration.                                    |
| `/instruments/:instrumentMfid`                    | Instrument Overview.                                        |
| `/instruments/:instrumentMfid/datasets`           | Instrument-scoped dataset collection.                       |
| `/instruments/:instrumentMfid/settings`           | Redirect to available instrument management or Overview.    |
| `/instruments/:instrumentMfid/settings/lifecycle` | Capability-gated instrument lifecycle management.           |
| `/instruments/:instrumentMfid/settings/operators` | Capability-gated service-account operator management.       |
| `/instruments/:instrumentMfid/settings/ownership` | Capability-gated ownership transfer.                        |
| `/samples/:sampleMfid`                            | Canonical sample detail.                                    |
| `/datasets/:datasetMfid`                          | Canonical dataset detail.                                   |
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

Project navigation has Data and Overview plus capability-gated Manage when membership or ownership operations are available. The persistent project header owns title and status. Overview contains one read-first Project details section with project ID, organization, lead, MFID, Created, and Updated; authorized people can explicitly replace that card with descriptive editing for title, organization, and project ID. A separate scientific metadata section and read-only People section follow. People may link authorized users directly to member management. Manage has route-backed Members and Ownership subsections. Members owns direct member addition, allowed role changes, removal, and self-leave. Ownership uses the API preview and a separate explicit confirmation. These actions remain distinct from resource ACLs and future join requests. No invitation workflow or top-level Members destination exists. A non-member can receive a public-safe project representation without membership-only fields.

The exact project endpoint returns `ProjectWithLead`: `unique_id`, `project_id`, `title`, `organization`, `project_lead_orcid`, resolved `lead`, `status`, `creation_time`, `modification_time`, `members`, `scientific_metadata`, and nullable `capabilities`. Hub renders the resolved public-safe lead in preference to its identifier, uses capabilities only to expose valid actions, and displays every other useful field in the persistent header or Overview. Optional values remain absent or use the standard empty presentation rather than being fabricated.

Project creation is a dedicated route linked from the project collection. It requires a project title, validated project ID, organization, and an existing lead. The current account is the initial lead and bounded people search can replace it. New projects start active and open by returned canonical MFID.

### Instrument

The instrument directory provides URL-backed Active, Maintenance, and Decommissioned views using API-side status filtering before pagination and links authenticated human accounts to a dedicated registration form. Registration requires name, a valid instrument ID, and location, omits owner so the API applies the authenticated human, and opens the returned canonical MFID route. Instrument routes retain identity and local Overview and Datasets navigation plus capability-gated Manage when a lifecycle, operator, or ownership operation is available. Overview presents a read-first Summary with an explicit descriptive edit action for authorized people. Manage has independent Lifecycle, Operators, and Ownership subsections according to exact capabilities. Operators binds service accounts by exact username or MFID and confirms removal. Ownership uses the API preview and explicit confirmation. Lifecycle offers active, maintenance, and decommissioned states through the dedicated API operation, with explicit confirmation before decommissioning. Dataset scope is the API-defined acquisition instrument across readable projects. Hub does not imply a direct project-to-instrument relationship.

### Resource

Resource detail has a persistent identity header and type-specific content for summary, identity, dataset thumbnails, files, relationships, scientific metadata, access, activity, and allowed actions. Overview uses that semantic document order for both resource types, omitting Thumbnails and Files for samples, so compact and single-column layouts always end with Scientific metadata. Summary includes descriptive fields followed by the current linked project and, for datasets, acquisition instrument. Dataset thumbnails load in a separate browser-initiated representation and expose explicit add, rename, and confirmed delete controls only when `can_edit` is true. Actions stay local to the affected section and preserve readable content during refresh or recovery.

Sample and dataset creation use dedicated routes reachable globally and from project context; instrument context may preselect dataset acquisition. Both require a project, omit caller-assigned MFIDs, and keep descriptive values in place after validation or request failure. Dataset instrument selection is optional. Canonical navigation uses only the API-assigned MFID. An uncertain structural create disables repeat submission and directs the user to check Data because the API has no idempotency contract. Dataset creation can collect optional sample associations, but structural creation completes first. If an association fails, the form locks the confirmed dataset stage and offers recovery for only the incomplete links before canonical navigation.

Sample and dataset routes use a shared parent shell with the persistent resource header and route-backed Overview, Graph, and Manage navigation. Graph and Manage data load only when their tab is entered and are not intent-preloaded. Manage remains available because deletion eligibility has no capability guidance. Public, direct-grant, and project-assignment controls require `can_manage_access`; user and project grants are bounded by `max_grant_role`. Owner, service-account, instrument, system, and unknown grants are displayed read-only. Publish, unpublish, and revoke require confirmation, and access failures remain local to their section. Ownership transfer is a distinct Manage action gated by `can_transfer`, with server preview before explicit confirmation. Reviewed deletion is a destructive Manage action that remains available without inferring eligibility from unrelated capabilities. Compact management actions share an adaptive row when space permits and stack in DOM order when they do not.

Project assignment appears in sample and dataset Manage when `can_manage_access` is available. Overview Summary shows the current primary project without presenting an authority-changing control. Assignment selects a project by stable MFID, resolves its current project ID at the server boundary, previews the atomic grant and assignment move, and requires explicit confirmation. Dataset instrument context remains read-only because the API has no reassignment operation.

The Relationships section is the canonical management surface for supported sample and dataset links. It states direction explicitly for parent-child and cross-type associations. Add uses an accessible dialog with bounded search constrained to the supported target type. Unlink requires confirmation and removes only the relationship. The section uses the source resource's exact `can_edit` guidance for local controls, while the API authorizes both resources and validates the pair. Relationship controls are absent from the inspector.

The Graph tab is a read-only alternate representation of a sample or dataset's immediate readable relationships. It keeps the resource header and tab navigation mounted while loading locally. Selecting a node opens the existing overlay inspector without resizing the graph; Open navigates to the canonical detail and Explore from here reroots the Graph route on that resource. A collapsed relationship table provides the same identities, types, directions, inspection, canonical navigation, and bounded dataset thumbnail previews without requiring pointer interaction or graph interpretation. Thumbnail failure does not block the graph. Relationship changes remain on Overview rather than turning the visualization into an editor. The bounded prototype is defined by [decision 0026](../decisions/0026-explore-bounded-resource-graphs.md).

### Resource inspector navigation

An optional `preview` search parameter opens a sample or dataset in a right-side overlay above the current resource, project Data, or global Data page. The host page remains mounted, retains its geometry and scroll, and owns collection filters and cursors.

Opening from a closed panel creates one browser-history entry. Following another preview replaces that entry while a bounded in-preview trail supports Back in preview. Close returns safely to the host state. Direct preview entry and reload have no trusted trail. Canonical Open links navigate to the full resource page without leaking unrelated host search state. Invalid, unavailable, denied, loading, and failed previews remain local to the overlay.

The overlay is modal at every viewport: focus enters it, Escape and outside dismissal close it safely, and focus returns to the trigger when possible. It does not reserve persistent layout space or fetch collection rows, files, or speculative related detail.

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
