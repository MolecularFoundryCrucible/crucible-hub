# Changelog

This file records notable changes to Crucible Hub for users, operators, contributors, security and privacy reviewers, and downstream integrations.

The format follows Keep a Changelog principles. Versioning policy will be selected before the first release.

## Unreleased

### Added

- Added a dedicated dataset Processing page with file MFIDs, latest ingestion state, request history, dynamic ingestor selection, partial-success multi-file ingestion requests, and retained quick downloads on Overview.
- Added a dedicated application-bar action for local camera-based MFID QR scanning, with API-backed canonical resource resolution, camera switching, retry and text-entry fallback, and immediate stream cleanup without uploading or storing camera content.
- Added resource-aware browser titles and keyboard navigation, explicit entity refresh timestamps, full-text scientific metadata search, and account-isolated session-only recent resources.
- Added lazy dataset thumbnail galleries, capability-guided add and rename controls, confirmed deletion, and bounded first-thumbnail previews in graph relationship lists.
- Added self-service profile management for name, email, and username through the top-right account menu and identity-scoped account API operations.
- Added route-backed one-hop relationship graphs for samples and datasets, with lazy loading, resource inspection, canonical rerooting, and an equivalent accessible relationship table.
- Added global and contextual entry points for dedicated project, sample, dataset, and eligible instrument creation, with bounded identity selectors, local-time timestamps, API-assigned canonical navigation, retained failure state, explicit uncertain-outcome handling, and separately recoverable dataset relationships without file upload.
- Added instrument registration for human accounts, service-account operator management, and separate ownership transfer settings with server-resolved confirmation and authoritative cache refresh.
- Added preview-confirm ownership transfer for projects, instruments, samples, and datasets, plus atomic sample and dataset project moves from resource Context.
- Added capability-gated instrument lifecycle management with URL-backed status-filtered directories, active, maintenance, and decommissioned states, explicit decommission confirmation, retained failure state, and authoritative non-optimistic updates.
- Added route-backed resource Manage pages for samples and datasets with lazy ACL loading, capability-gated access controls, bounded user and project grants, read-only ownership and system principals, confirmed public and revoke actions, and server-confirmed non-optimistic updates.
- Added capability-guided relationship management to canonical sample and dataset pages, with compact add and manage actions, navigation-only normal rows, explicit unlink mode, bounded target search, confirmed unlink without resource deletion, retained failure state, and authoritative source and target refresh.
- Added capability-guided project member management with direct member addition, bounded role changes, confirmed removal, and voluntary project leave.
- Added reviewed deletion requests to canonical sample and dataset pages with an optional reason, retained failure state, active-request status, and no direct permanent-deletion path.
- Combined project identity and members in Overview with expanded lead identity, hierarchy-ordered members, semantic role badges, service-account labels, and a compatibility redirect from the former Members section.
- Added capability-gated, type-preserving scientific metadata editing for samples and datasets, using changed-field merges for ordinary edits and explicit confirmation before deletion-driven full replacement.
- Added capability-gated project and instrument Settings for bounded descriptive fields, with dedicated routes, retained failed drafts, unsaved-change protection, and server-confirmed cache updates.
- Added capability-gated in-place Summary editing for sample name, type, description, and timestamp and dataset name, measurement, format, type, session, and timestamp, with browser-local timestamp entry, UTC API writes, legacy-string preservation, unsaved-change protection, retained failed drafts, and server-confirmed cache updates.
- Added bounded project and instrument previews from sample and dataset context, reusing inspector history and canonical navigation without loading related collections or files.
- Added in-place sample and dataset previews to global Data, preserving applied filters, independent cursors, table layout, and canonical full-page navigation while exploring immediate relationships.
- Added API-backed global Data filters for project relationship, visibility, resource creation dates, and dataset acquisition instrument, with bounded selectors, explicit Apply/Clear, shareable URLs, and filtering before pagination.
- Added recognizable icon actions for full-page navigation and on-demand dataset file downloads, with fixed geometry across ready, pending, retry, and unavailable states, accessible tooltips, and fresh transient links generated only after activation.
- Added project Data filters for visibility, resource creation dates in UTC, and dataset acquisition instrument, with explicit Apply/Clear and shareable filter URLs.
- Added explicit resource previews in project Data tables, preserving collection context while exploring relationships in the existing overlay. Shared detail reads now omit unused embedded datasets.
- Added Data-first project workspaces with paginated Samples and Datasets, All/Assigned/Shared scopes, persistent project navigation, and shared-resource assignment context. Live project queries require the project-scope API contract exported from revision `9a14b28` or a compatible deployment.
- Added sample and dataset inspection in a dismissible right-side overlay with grouped relationships, bounded preview history, full-page navigation, and local recovery without resizing the original working page.
- Added an instrument Datasets view with scoped pagination, persistent instrument navigation, direct dataset links, and local loading and recovery states.
- Added an authentication transition contract that separates read-only Hub development from the API-owned login exchange and defines the stable credential seam, cutover evidence, rollback, and removal of the temporary API-key bridge.
- Added public-safe people search, canonical person detail routes, and project-member profile links without exposing privileged account fields.
- Added canonical instrument detail with directory and search navigation, public-safe owner identity, lifecycle context, and scientific metadata.
- Added validation for local Markdown link targets so missing agent and development documents fail the canonical repository check.
- Added server-generated per-request Hub correlation IDs through global TanStack Start middleware, browser-visible response headers, and serializable browser-safe API error envelopes carrying the same request reference, while explicitly retaining native same-origin CSRF protection.
- Preferred expanded dataset project and instrument references over their flat identifier fallbacks without introducing a direct project-to-instrument assignment.
- Added native dataset context and immediate-resource navigation between canonical Hub routes, and removed planned Explorer handoffs from the product direction.
- Added identity-scoped global search across projects, instruments, samples, and datasets with a keyboard dialog, URL-backed type filtering, grouped partial-failure results, and direct MFID lookup.
- Added production Node and browser checks for `/hub` assets, deep links, server functions, health output, forwarded-header resistance, and graceful shutdown, plus a repeatable non-root container verification procedure.
- Added development-only empty, restricted, dense, partial, and degraded scenarios through real application routes, identity-isolated Query caching, route visual baselines, compact theme baselines, scenario-retention coverage, and text-spacing reflow checks.
- Added an unlinked design-system fixture surface with deterministic interface states, reviewed light and dark laptop and desktop baselines, keyboard and reduced-motion checks, and automated accessibility coverage.
- Replaced the broad API dashboard aggregation with parallel first-page project, instrument, sample, and dataset Queries, while retaining fixture-only project resource previews until the API exposes a correct paginated assignment filter.

- Added an identity-scoped, offset-paginated instrument directory Query and removed the redundant broad API instrument request from the transitional workspace loader.
- Added approved Query dehydration and hydration, collection-to-detail cache isolation, and end-to-end cancellation propagation from TanStack Query through server functions to bounded API requests.
- Added canonical resource detail routes with discriminated metadata, relationships, and dataset-scoped file queries, plus an accessible shared empty-state primitive.
- Added independently cursor-paginated sample and dataset queries with URL cursor state, bounded server-function validation, and contract-shaped fixture pagination.
- Added identity-scoped account, paginated project collection, and exact project detail queries with validated server functions and fixture coverage.
- Added a Phase 0 evidence register and moved the rendered workspace into an identity-scoped TanStack Query entry as the first step toward decomposed API reads.
- Added responsive data-table column priorities and more comfortable shared pill spacing while removing development-only indicators from the workspace chrome.
- Added an explicitly local, server-only API-key bridge for developing against a configured Crucible API before production login exchange support is available.
- Added enforceable semantic typography, container, page-gutter, and section-spacing tokens, plus shared page composition that prevents feature-level type-scale drift.
- Added the first fixture-backed desktop workspace with a persistent collapsible sidebar, compact navigation drawer, application bar, Home, Data, Projects, project overview, and Instruments routes.
- Added the detailed desktop information architecture and a deterministic, OpenAPI-typed demonstration workspace for UI development and validation.
- Added a source-controlled official shadcn/ui agent skill, documented optional browser-testing and security-review skills, and established reviewed skill-update triggers for contributors.
- Added the supported Phase 0 npm toolchain, desktop application shell, generated API contract boundary, validation commands, browser accessibility tests, and CI workflow.

### Changed

- Rebalanced sample and dataset Overview cards so Identity and Thumbnails share a column, Relationships and Scientific metadata share an equal-width row, and nested metadata renders as an expandable row-based JSON tree with expand-all and collapse-all controls.
- Distinguished service-account owners on sample and dataset Identity cards with the semantic robot icon while keeping owner names free of trailing type icons.
- Distinguished service accounts from people across shared identity presentations with an orange avatar border and service-account label, using the public account-type discriminator.
- Resolved sample and dataset owners in project data tables through the shared person identity presentation, including name fallback when no username is set, profile navigation, and hover details.
- Standardized person identity links and contextual project and instrument references within sample and dataset workflows on a shared keyboard-accessible hover preview, while keeping project and instrument directories and primary navigation as direct links.
- Added project ID context to sample and dataset search results alongside sample type or measurement, including autocomplete pickers and direct MFID results when project context is available.
- Standardized editable-card commit controls and bounded card and inspector loading, empty, initial-error, and refresh-error states through shared domain components.
- Standardized resource identity, MFID typography, and repeated project, owner, Updated, and Open collection cells through shared domain components with static enforcement for future MFID presentation.
- Standardized confirmation overlays and grouped resource-management entries through shared domain components with consistent pending, error, dismissal, action, and responsive layout behavior.
- Standardized resource and person pickers on debounced autocomplete with anchored suggestion overlays, keyboard selection, and compact text-only confirmation actions that do not move as results change; reversible public-access confirmations now support Close, Escape, and outside-click dismissal.
- Tightened the project Lead column and standardized every resource collection on a 12rem Updated column immediately before the trailing Open action.
- Standardized person identity across account, profile, directory, membership, ownership, access, operator, inspector, and search surfaces with shared inline, stacked, and avatar presentations plus consistent profile hover and click behavior.
- Replaced oversized project and instrument collection cards with compact responsive directories using linked identity, relevant ownership and location context, normalized unavailable values, and stable trailing navigation.
- Kept stable graph and access-management headings visible during initial loading, limited collection update messages to readable refresh states, and prevented incompatible instrument and search results from appearing as pagination placeholders.
- Moved Recently viewed below recent data on Home and standardized both lists on resource rows with name, icon-labelled project ID and monospaced MFID, and browser-local creation or last-viewed time.
- Updated the pinned Crucible API contract for typed resource relationships, restored parent, child, and associated relationship lists by normalizing API direction fields at the Hub boundary, displayed available relationship types with direction-aware wording, added optional type selection when creating parent-child links, and grouped Graph with the other Relationships card actions.
- Standardized native buttons, button-styled links, chooser rows, and sidebar utilities on shared action variants, promoted contextual resource creation to the primary action style, and added static enforcement against feature-level visual overrides.
- Adopted the Hub-specific Crucible logo for the sidebar and browser favicon, with the standalone Hub icon available as managed brand artwork.
- Centered the Crucible mark on the collapsed sidebar icon column and matched its background to the hover target.
- Strengthened resource section tabs with stable semibold labels, foreground active text, a tighter header relationship, and right-aligned contextual creation actions for projects and instruments.
- Unified project and instrument Manage pages into capability-gated Access management and Resource management cards, with explicit edit modes, list-level add actions, destructive leaving, and compatibility redirects from former subsections.
- Simplified canonical resource headers to pair each name with its semantic resource icon, use the available header width before wrapping, and remove duplicate type and Summary labels.
- Increased top-level read-only field labels to the shared 14 px semibold label role while retaining the smaller supporting role for secondary content.
- Made compact dialogs viewport-bounded with persistent action footers, moved card actions below headings on narrow screens, reflowed member and access controls, and made member addition an explicit selection and confirmation workflow.
- Improved compact resource inspection with resource icons beside wrapping titles, dedicated MFID rows, wrapping relationship identities, fixed trailing navigation actions, and less redundant labels.
- Added project-scoped data search with contextual return navigation, keyboard navigation shortcuts with in-app help, and consistent Shortcuts, Theme, and navigation controls in the sidebar footer.
- Made resource inspectors non-modal at wider widths, added a stable preview-navigation and close top bar, preserved the host page's current scroll position on close, and refined the identity hierarchy with an icon-labeled, quick-copy MFID and the full-page action directly below the resource name.
- Standardized displayed timestamps in browser-local 24-hour time and labeled project owners as Lead in project membership surfaces.
- Updated the pinned staging API contract and sample and dataset creation requests to use canonical project and instrument MFIDs directly, removing identity lookup requests before creation.
- Preserved project context across sample and dataset sections opened from Project Data while relying on browser history for chronological return navigation.
- Refined sample and dataset Overview cards, resource navigation, Manage layout, project creation actions, and compact confirmation behavior with clearer field order, consistent action hierarchy, linked identity names with shared person previews, project-aware breadcrumbs, a combined access card, and a unified resource management card.
- Gave Identity cards slightly more space and kept full MFIDs on one line when the available viewport permits.
- Branded the application sidebar with the Crucible mark and blue surfaces, moved the desktop collapse control into the sidebar, applied orange current-location boundaries, and standardized resource section navigation typography and target sizing.
- Consolidated sample and dataset access, assignment, ownership, and reviewed deletion under canonical Manage routes with compatibility redirects.
- Distinguished outlined actions from their containing surfaces in both themes and standardized displayed MFIDs on a readable semantic identifier type role.
- Moved project and instrument descriptive editing into explicit read-first Overview actions, retained distinct administrative workflows under Manage, and standardized outlined actions with surface-independent visible borders.
- Coalesced sample and dataset project and instrument context into Summary and standardized semantic card widths and DOM order so compact actions can share rows, forms and management lists stay readable, and single-column resource layouts end with Scientific metadata.
- Moved sample and dataset project assignment from Overview context into the capability-gated Manage workflow.
- Pinned and self-hosted the interface font so typography and visual validation remain consistent across developer and CI environments.
- Made TanStack skill commands invoke the pinned Intent CLI unambiguously when dependencies expose competing `intent` executables.
- Clarified project navigation and page responsibilities: Overview owns project details, scientific metadata, and read-only people; capability-gated Settings owns General and direct member management; project status remains in the persistent header.
- Added typed canonical sample and dataset paths while retaining the generic resource path as a compatibility redirect.
- Made resource identity more compact and actionable with copyable MFIDs, visibility beside MFID, linked abbreviated owner names, and public-safe owner hover details.
- Aligned sample and dataset detail structure by moving project and visibility out of Summary, presenting shared project context and dataset instrument context together, and using compact accessible icon actions for Summary editing and saving.
- Made sample descriptions explicit in Summary, standardized absent optional Summary values as `-`, and removed aggregate dataset size while retaining file-level sizes.
- Reworked Home into a bounded research continuation view with recent samples and datasets, associated projects, canonical continuation links, and no low-value aggregate totals or redundant shortcut panel.
- Made sample and dataset identity the primary in-place preview action in project and global Data tables, with a stable trailing icon for canonical full-page navigation and the same labeled Open action in the inspector footer.
- Made project Data default browsing relationship-neutral, moved Assigned and Shared into ordinary filters, kept actual primary projects visible, bounded nested scientific metadata behind semantic disclosures, and moved the inspector Open action to its footer.
- Reduced generic page and card subtitles, placed resource creation and update dates side by side, and centered dataset file actions beneath an accessible unlabeled column.
- Allowed the development server's explicit Tailscale MagicDNS hostname while retaining loopback binding and Vite host-header protection.
- Replaced the placeholder browser favicon with the Crucible 16×16 icon.
- Agent guidance now recommends high-capability planning with bounded lower-cost implementation when useful, with coordinator review and final validation. Browser specs use a shared runtime-error check.
- Cancellation-sensitive search results now use TanStack Query's cancellable standard query state, with controlled browser and upstream timeout evidence, and local development now fails clearly instead of silently changing ports when port 3000 is occupied.
- Canonical validation now proves that TanStack Start rejects browser-reachable imports of the server-only Crucible adapter.
- Increased light-theme muted and semantic status contrast after the fixture surface exposed values below the WCAG AA threshold.

### Fixed

- Normalized timezone-aware PostgreSQL timestamps with space separators, microseconds, or compact UTC offsets into the shared browser-local date and time presentation.
- Standardized resource and access-principal icons with shared semantic colors, including cyan-teal person identity in Direct access, colored navigation icons, and field-specific Summary and Identity icons.
- Presented account profiles read-first behind an explicit Edit profile action and restored readable Add member action contrast in light and dark project settings.
- Improved compact Data readability, creation validation and discard behavior, graph rendering and controls, visible management actions, field error associations, compact creation access, route titles, and fixture browser coverage for creation and consequential mutations.
- Restored the visible forward arrow inside Data table full-page actions while preserving their accessible labels, tooltips, and fixed geometry.
- Kept readable collections and dataset detail available during refresh or file-panel failures, limited Data requests to the selected resource types, and added focused retries.
- Distinguished unavailable project membership from an empty member list, linked Home's recent datasets to detail in creation order, and included public-safe person detail in SSR hydration.
- Preserved page headers and controls during collection pagination, retained identity-safe previous pages with local update feedback, and distinguished dashboard loading from empty or unavailable results.
- Kept the authenticated application shell mounted during navigation by moving critical route Queries into TanStack Router loaders with intent preloading and scoped skeleton fallbacks, including a results-only fallback that preserves search controls and context.
- Configured Nitro to serve generated assets beneath `/hub`, matching the application URLs emitted by Vite.
- Excluded generated Nitro build output from source linting so repeated validation remains deterministic.
