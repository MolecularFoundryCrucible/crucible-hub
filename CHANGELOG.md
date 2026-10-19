# Changelog

Notable changes to Crucible Hub for users, operators, contributors, and downstream integrations. Releases follow Semantic Versioning and deploy from `vX.Y.Z` Git tags.

## Unreleased

- Renamed the API credential card to Activity and API key and moved account Last active into it on My profile, user administration, and service account pages.

## 1.4.0 - 2026-10-19

- Docked the resource preview beside the content on wide screens (1440px and up) instead of covering the table, kept it open until closed there, strengthened its edge shadow when it overlays narrower layouts, and highlighted the previewed row.
- Gave primary table columns such as Name and Account more width than secondary text columns, capped secondary columns on wide screens, and standardized column widths by content type.
- Switched tables to cards based on the space each table actually has instead of the window width, so names and IDs no longer collapse or overlap next to the sidebar, added a Sort by control to card layouts (including Users, Service accounts, and Deletion requests), and showed full long project IDs and Crucible IDs on hover.
- Applied Created and Active since date filters to the viewer's local calendar day instead of the UTC day, read offset-free API timestamps as UTC, and showed activity time tooltips in local time.
- Extended Hub sign-in sessions to 7 days idle and 30 days absolute with a persistent session cookie, so closing the browser or switching devices no longer signs people out early, and returned administrator mode to standard access 12 hours after it is turned on.

## 1.3.3 - 2026-10-16

- Added default sort field and direction preferences for Data, Projects, and Instruments.
- Added right-aligned filter sheets, removable filter pills, and refresh actions to Projects (role or lead affiliation, active-since date, and sort order) and Instruments (lifecycle status, management scope, manager, instrument type, location, manufacturer, and sort order), and stopped search parameters from leaking across sidebar and workspace tab navigation.
- Aligned the right-side resource inspector with canonical detail cards (Back navigation, resource-colored top accent bar, abbreviated owner names, icon-paired context fields with record, creation, and update timestamps, and bounded file lists), refined the resource Graph tab (taller recessed canvas, accented node cards, thicker connectors, two-tap mobile selection, and no duplicate bottom table), and unified the Crucible Foundry resource palette, entity icon wells, group-by headers, filter pills, visibility badges, and Crucible brand icons across the workspace.
- Aligned the Crucible ID column in Service accounts administration with the Users directory.

## 1.3.2 - 2026-10-15

- Added last-active timestamps, activity filtering, and sorting to Service accounts administration.
- Redesigned the resource Graph tab with horizontal node cards, dataset thumbnails, perimeter association routing, and table-canvas sync.
- Added side-by-side dataset thumbnail previews with arrow navigation to the right-side resource inspector.
- Fixed the sticky header clipping the left sidebar hover rail along the top row.
- Streamlined releases and Cloud Build image builds with an Artifact Registry dependency cache and `npm run release`.

## 1.3.1 - 2026-10-15

- Added searchable autocomplete dropdowns for sample type and dataset measurement, session, and data format fields.
- Supported Ctrl/Cmd-clicking resource rows to open the full page directly instead of the side preview.
- Standardized destructive buttons, icon sizing, and theme-aware footer brand marks.

## 1.3.0 - 2026-10-15

- Added self-service API key regeneration on My profile with step-up ORCID re-authentication when required.
- Added last-active timestamps and sorting across Projects, Instruments, Home, Users administration, and API key cards.
- Added a scientific metadata card to sample and dataset creation with field, JSON, and file-upload entry modes.
- Ranked sample type and dataset measurement suggestions by usage within the selected project.
- Rejected unsupported characters such as NUL in metadata before saving and surfaced field-specific API errors.
- Deferred loading the Add relationship resource list until the search field is focused.
- Shortened creation submit labels to Create (Register for instruments).
- Refreshed footer API status every minute while visible without extending idle session activity.
- Fixed creation retries dropping entered relationships after initial record creation.
- Fixed the default grouping preference not applying to project and instrument dataset views.

## 1.2.1 - 2026-10-14

- Fixed preference saves failing when the API returns weak ETags (`W/"..."`).
- Made toast titles and messages selectable for copying error references.

## 1.2.0 - 2026-10-14

- Persisted recently viewed resources on the Crucible account across devices, with Preferences controls to pause or clear history.
- Split sample and dataset creation into a two-column layout separating details from relationships and files.
- Added the community Discord link and GitHub Issues icon to the footer and removed the duplicate sidebar Preferences link.

## 1.1.0 - 2026-10-14

- Required the Administrator view switch for all administrative pages, profile panels, and elevated server calls.
- Added an account-synced Preferences page for theme, default Data view, default groupings, and Home scope.
- Added a shared Postgres session store (`HUB_AUTH_SESSION_MODE=postgres`) so deployments and restarts preserve sessions.
- Displayed the release version in the deployed footer and the version plus short commit in the system status popover.

## 1.0.1 - 2026-10-14

- Accelerated uploads under 512 MiB using API-selected part sizes and a rolling concurrency pool.
- Automated Cloud Build release builds and Cloud Run digest deployments from `vX.Y.Z` tags.
- Improved narrow-viewport layouts across tables, headers, scalar field grids, and touch gestures on the resource graph.

## 1.0.0 - 2026-10-13

First versioned release, activating the production pilot at `https://crucible.lbl.gov/hub/` against Crucible API 3.1.0.

- Added API-owned ORCID sign-in, server-side sessions, rate-limit-tolerant token refresh, and step-up re-authentication for credential operations.
- Added global, project-scoped, and instrument-scoped Sample and Dataset collections with cursor pagination, server sorting, faceting, and `Group by` browsing.
- Added canonical Sample, Dataset, Project, and Instrument workspaces with in-place Summary editing, type-preserving Scientific metadata editing, and QR code MFIDs.
- Added direct-to-storage multipart dataset file uploads with streaming checksums, file replacement, inline browser file opening, and on-demand downloads.
- Added a dataset Processing tab with file ingestion status, request history, and multi-file ingestion requests.
- Added interactive React Flow and ELK resource relationship graphs with directional node expansion, keyboard inspection, and an accessible relationships table.
- Added a non-modal right-side resource inspector with preview history, sibling sequence navigation, and quick actions.
- Added global and project-scoped application-bar search and local camera-based MFID QR scanning.
- Added resource creation workflows for projects, instruments, samples, and datasets with partial-failure stage recovery.
- Added access and lifecycle management across projects, instruments, samples, and datasets, including staged multi-member grants, batch removal, ownership transfer, and empty-resource deletion.
- Added reviewed deletion-request submission, history, and bulk approval or rejection queues.
- Added platform administration for users and service accounts, including account creation, platform-role management, and API key provisioning, rotation, and revocation.
- Added brotli and gzip static asset pre-compression, `vendor` and `shared` bundle splitting, lazy route chunks, and a footer system readiness popover.
