# Changelog

Notable changes to Crucible Hub for users, operators, contributors, and downstream integrations. Releases follow Semantic Versioning and deploy from `vX.Y.Z` Git tags.

The public surface that versions protect is shareable URLs and their search parameters, QR and MFID deep links, and deployment configuration (environment variables, container image, and health endpoints). A major release breaks that surface or requires manual migration, a minor release adds to it (a new route, linkable parameter, configuration option, or integration), and a patch release covers everything else, including new UI features within existing pages, visual changes, performance work, and fixes. This rule applies from 1.6.1; earlier releases counted UI features as minor.

## Unreleased

- Made switching Administrator view feel immediate: the switch and header badge change at once, the page stays in place instead of reloading and dims only if the switch takes longer than 200 ms, the Administration links slide in and out with the switch, the deletion requests badge changes once instead of flickering, and the sidebar's Recent list stays on screen and fades in new entries.
- Gave the Hub one consistent motion system: menus, popovers, tooltips, dialogs, sheets, and notifications now open and close with the same short timings, close slightly faster than they open, and finish their closing animation instead of being cut off. Pickers and menus opened inside a dialog or the inspector always appear above it.
- Loading feedback no longer flashes on fast responses: the route progress bar and the dimming of Data, project data, search, the directories, and the inspector appear only after 200 ms, and the progress bar finishes forward instead of shrinking back. Loading placeholders on Home, search, and sample and dataset pages now match the layout that loads, including the Manage tab, and rows added by Load more fade in.
- Changing a filter or sort order on Data, project data, and the projects, instruments, users, and service accounts lists now keeps the current results on screen until the new ones arrive, dimming them only if the wait passes 200 ms, instead of replacing them with a loading placeholder.
- Fixed Show all lists not animating in production, collapsing a long list inside the inspector scrolling the page behind it, Save becoming available after whitespace-only summary edits, the upload area jumping away while files upload, and copy buttons staying on Copied indefinitely.
- With reduced motion turned on, overlays no longer scale or slide and buttons no longer shift when pressed.

## 1.6.2 - 2026-10-21

- Restored the `no-referrer` policy on the sign-in callback and other routes that set their own, which the site-wide `same-origin` header had been overriding.
- Fixed a page error on Home when one recent data source failed to load, where the browser replaced the server-rendered list with a loading state.
- Updated dependencies within their current major versions, including React 19.3, Base UI 1.9, TanStack Query 5.104, Zod 4.6, Playwright 1.64, ESLint 10.12, and Vitest 4.1.12, which fixes a code-injection advisory in its test runner.
- Licensed Crucible Hub under the BSD 3-Clause License, added a security policy for private vulnerability reports, and removed internal deployment details, personal data, and outdated internal reviews from the repository.

## 1.6.1 - 2026-10-21

- Restyled role badges as three neutral levels instead of one color per role, so roles no longer look like statuses (Contributor read like Valid, Owner like a warning): a filled badge for Owner and Admin, with a crown on Owner, Lead, and Manager, an outline for Editor, Contributor, and Support, and a muted outline for Viewer and None.
- Sized the project, instrument, and MFID icons on secondary lines (Recently viewed, Recently added, search results, and resource lists) at 14 px to match their 12 px text, keeping 16 px beside names, with both sizes defined once as design tokens.
- Added an API key column (Valid, Invalid, or No key) to the Users and Service accounts administration lists, read from the list itself without extra requests. Narrowed the API key and Last active columns there so account names get more room, and shortened the activity label Within the last hour to Last hour everywhere.
- Loaded a person's profile and their administration details at the same time for administrators, instead of one after the other.
- Showed the instrument identifier with an instrument icon under instruments in Home's Recently viewed, and the project slug with the project icon instead of the plain text added in 1.6.0, using the identifier the Crucible API now returns with recently viewed items.
- Updated to the Crucible API contract at `c51a5a6`, which returns people search results as `{ limit, items }`.

## 1.6.0 - 2026-10-21

- Accepted people search results from the Crucible API either as a list or as the upcoming paginated `{ limit, items }` response, so the API can switch shapes without breaking search or person pickers.
- Kept the MFID QR code in the top-right corner of the Identity card on most phones, shrinking it slightly where needed so the MFID stays on one line, and stacked it below the fields only on the narrowest screens.
- Rendered the theme, sidebar state, and local dates and times on the server, so pages no longer flash the default theme, an expanded sidebar, or UTC times while loading. Theme and sidebar choices now live in cookies; existing choices carry over.
- Widened the search results dropdown on phones to the full screen width (it previously matched the narrow search field and truncated every result), lined it up with the search field on all screens, widened it on desktop so long titles fit, and fixed View all results collapsing to a single letter on phones.
- Added a Filters button to the search page with Include public data, Project, and Ownership filters, showing only the filters each resource type tab supports, and removed the Include public data button that appeared next to results whenever no samples or datasets matched. The button now only appears when a search finds nothing.
- Showed the project slug and instrument identifier under project and instrument search results, in the search page and the top-bar search, instead of the organization or instrument type, and showed project slugs in Home's Recently viewed as plain text like Your projects.
- Kept the Home greeting stable while the page loads instead of switching from the generic text.
- Fixed a page error on Home and Data in API mode where the browser rendered without your saved preferences and replaced the server-rendered lists.

## 1.5.2 - 2026-10-20

- Hid samples and datasets you can see only because they are public from Data, project and instrument data, group counts, Home, and search. An "Include public data" filter (a **Public** pill when on) brings them back, a Preferences setting chooses whether lists start with it on, empty searches and lists offer it, and direct links keep opening public records. Administrator view always shows everything.

## 1.5.1 - 2026-10-20

- Showed Request deletion on samples and datasets only to people the API allows to request it (contributor or above), instead of to every viewer including public visitors, while still showing an existing request's status.
- Enlarged the Copy and Print buttons under the MFID QR code to the standard icon button size.
- Drew the active Browse nearby sequence (Previous, sequence, Next) as one bordered button group.

## 1.5.0 - 2026-10-20

- Updated TanStack Start to 1.169.3 and Vite to 8.3.4 to fix a critical reflected XSS advisory in the Start server and a high-severity advisory in Vite's editor launcher.
- Fixed a page error when opening a project or data link with Created date filters on a first visit, which made the page re-render its data, and served the browser icon as a file again.
- Showed access-denied and other load errors right away instead of requesting the data a second time when the page opens, and removed the filter note and the Try again button from the project data access-denied message.
- Added scientific metadata editing to project and instrument overviews, using the same Fields and JSON editor, JSON upload, and merge or replace rules as samples and datasets.
- Fixed datasets on an instrument page opening their full page instead of the preview panel, matching project and Data pages.
- Labeled every card edit button just Edit (screen readers still hear what it edits) and removed the descriptive lines under Direct access, Direct members, and Operators.
- Refreshed the Hub's colors and buttons: primary actions use Crucible dark blue (light blue in dark mode), neutrals carry a cool tint, buttons follow three tiers (solid primary, outline secondary, plain tertiary for Edit, Refresh, copy, print, and row actions), and the top-bar Create menu no longer competes with each page's own primary action.
- Removed the decorative colored bars on the sign-in card, the resource preview, and graph nodes, and the glow behind the sign-in card; orange now only marks the current location and selection.
- Rebuilt color tokens as a palette plus semantic roles in both themes, disabled Tailwind's default colors, and split the design system docs into a quick reference and a detailed reference with a matching fixture page.
- Added Print next to Copy under the MFID QR code and in the enlarged QR code on sample, dataset, project, and instrument pages, listing reachable label printers, prefilling the resource name, and remembering the last printer used.
- Kept first and last names from being cleared once set on profiles, user administration, and service accounts, matching the API's rejection of empty names.
- Let project editors and admins change and remove members up to their own role, following per-member permissions from the API instead of owner-only removal.
- Unified the card layout of all directory and collection tables with the action beside the title, sized the dataset files and processing tables from their own width instead of the window, fixed file sizes and sample types disappearing at some widths, named every table for screen readers, and fixed the project data toolbar overflowing on phones.
- Showed optional table columns such as Created, Type, Role, and Owner as soon as each fits, with separate cutoffs per table layout, instead of hiding them until the widest layout fit.
- Fixed sample type and measurement disappearing from data tables at widths where neither the Type column nor the line under the name showed.
- Showed instruments you manage (owner, admin, or editor) in Home's Your instruments, and split the Instruments Management filter into Owned by me and Managed by me.
- Replaced the scientific metadata JSON text box with a CodeMirror editor that highlights syntax, marks errors at their line and column, flags duplicate keys, and offers a Format button, loading only when the JSON editor opens.
- Shortened card save buttons to Save and removed redundant helper text from the scientific metadata and timestamp editors.
- Edited scientific metadata with the same Fields and JSON editor and JSON upload (merge or replace) used when creating samples and datasets, opening records with more than 30 fields, nested values, or type-sensitive values in JSON.
- Made resource edit controls consistent with labeled Edit and Done buttons and outline add actions, showed access add and publish actions only while editing, removed the duplicate Graph button from Relationships, and grouped ownership transfer and deletion under a Danger zone.
- Renamed the API credential card to Security, kept its field layout when no key exists or its status cannot load, and moved account Last active into it on My profile, user administration, and service account pages.

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
