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

Wide layouts use a persistent sidebar and top utility bar. A collapsed sidebar retains accessible names through tooltips. Narrow layouts use a drawer or bottom navigation with the same destinations and route structure. Global navigation never duplicates entity-local sections.

## Route hierarchy

| Route                                     | Page or behavior                                            |
| ----------------------------------------- | ----------------------------------------------------------- |
| `/`                                       | Home dashboard.                                             |
| `/data`                                   | Global sample and dataset collection.                       |
| `/search`                                 | Cross-resource search.                                      |
| `/projects`                               | Project collection.                                         |
| `/projects/:projectMfid`                  | Project Data index.                                         |
| `/projects/:projectMfid/overview`         | Project details, scientific metadata, and readable members. |
| `/projects/:projectMfid/settings`         | Capability-gated General project settings.                  |
| `/projects/:projectMfid/settings/members` | Capability-gated direct member management.                  |
| `/projects/:projectMfid/members`          | Replacement redirect to project Overview.                   |
| `/instruments`                            | Instrument collection.                                      |
| `/instruments/:instrumentMfid`            | Instrument Overview.                                        |
| `/instruments/:instrumentMfid/datasets`   | Instrument-scoped dataset collection.                       |
| `/instruments/:instrumentMfid/settings`   | Capability-gated instrument settings.                       |
| `/samples/:sampleMfid`                    | Canonical sample detail.                                    |
| `/datasets/:datasetMfid`                  | Canonical dataset detail.                                   |
| `/samples/:sampleMfid/access`             | Canonical sample access management.                         |
| `/datasets/:datasetMfid/access`           | Canonical dataset access management.                        |
| `/resources/:resourceMfid`                | Legacy type-resolving redirect to a canonical entity.       |
| `/people/:userId`                         | Public-safe person profile.                                 |
| `/activity`, `/account`, `/admin/*`       | Activity, account, and separate administrative workflows.   |

## Entity scopes

### Project

Project routes retain project identity, breadcrumbs, and local navigation while a child section loads. Data is the index and has Samples, Datasets, and All type views; All, Assigned, and Shared are collection filters rather than separate project identities. Rows show their actual primary project and resource detail remains canonical.

Project navigation has exactly three local destinations: Data, Overview, and Settings. The persistent project header owns title and status. Overview contains one Project details section with project ID, organization, lead, MFID, Created, and Updated; a separate scientific metadata section; and a read-only People section. It may link authorized users to Settings for member management. Settings is capability-gated and has route-backed General and Members subsections. General owns editable title, organization, and project ID. Members owns direct member addition, allowed role changes, removal, and self-leave. These actions remain distinct from resource ACLs, ownership transfer, and future join requests. No invitation workflow or top-level Members destination exists. A non-member can receive a public-safe project representation without membership-only fields.

The exact project endpoint returns `ProjectWithLead`: `unique_id`, `project_id`, `title`, `organization`, `project_lead_orcid`, resolved `lead`, `status`, `creation_time`, `modification_time`, `members`, `scientific_metadata`, and nullable `capabilities`. Hub renders the resolved public-safe lead in preference to its identifier, uses capabilities only to expose valid actions, and displays every other useful field in the persistent header or Overview. Optional values remain absent or use the standard empty presentation rather than being fabricated.

### Instrument

Instrument routes retain identity and local Overview, Datasets, and Settings navigation. Dataset scope is the API-defined acquisition instrument across readable projects. Hub does not imply a direct project-to-instrument relationship.

### Resource

Resource detail has a persistent identity header and type-specific content for summary, scientific metadata, files, relationships, access, activity, and allowed actions. Project and instrument references link to their canonical pages. Actions stay local to the affected section and preserve readable content during refresh or recovery.

Sample and dataset Access routes use a shared parent shell with the persistent resource header and route-backed Overview and Access navigation. The Access route loads ACL data only when entered and disables preload for that data. A manager-only control surface appears only with the exact `can_manage_access` capability. Public controls are shown when supported; user and project grants are bounded by `max_grant_role`. Owner, service-account, instrument, system, and unknown grants are displayed read-only. Publish, unpublish, and revoke require confirmation, and access failures remain local to Access.

The Relationships section is the canonical management surface for supported sample and dataset links. It states direction explicitly for parent-child and cross-type associations. Add uses an accessible dialog with bounded search constrained to the supported target type. Unlink requires confirmation and removes only the relationship. The section uses the source resource's exact `can_edit` guidance for local controls, while the API authorizes both resources and validates the pair. Relationship controls are absent from the inspector.

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
