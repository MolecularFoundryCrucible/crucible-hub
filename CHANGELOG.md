# Changelog

This file records notable changes to Crucible Hub for users, operators, contributors, security and privacy reviewers, and downstream integrations.

The format follows Keep a Changelog principles. Versioning policy will be selected before the first release.

## Unreleased

- Sorted the users directory alphabetically by account name by default, with the Account column shown as the active ascending sort until another column is chosen, and moved the Email column before the Platform role column.

- Throttled sign-in starts to 30 per 10 minutes per client address and capped pending sign-in transactions, answering throttled requests with HTTP 429.

- Derived the legacy administrator-view cookie `Secure` flag from the configured Hub origin instead of the incoming request URL so the cookie stays `Secure` behind a TLS-terminating proxy.

- Gated the footer system readiness probe behind Hub authentication in authenticated deployments, reported an explicit unreachable state instead of a synthetic healthy status when Hub sign-in is not configured, announced status transitions to assistive technology, and disabled status retry while a refresh is in flight.

- Stopped quick search from blurring the active page control when collection pages update their URL, made repeated result selection idempotent, removed duplicate live availability requests caused by unstable form closures, and rendered the instrument access-grants loading state instead of a transient owner-only list.

- Moved platform user detail from a dedicated administration route into the shared people detail page for eligible administrators, displayed platform roles in the user directory and detail views, and added live email availability checking to user creation and profile editing alongside username checks.

- Added platform administration capabilities including user directory management with account creation, profile editing, and API key provisioning, and programmatic service account management.

- Improved quick search keyboard and dropdown behavior by submitting searches on Enter when no suggestion is highlighted, navigating directly and closing search with input blur on highlighted suggestions, showing an animated progress spinner during search queries, sizing results comfortably, and dynamically displaying the search query and shortcut badge in the results footer.

- Restored the Crucible Hub logo on the application sidebar with smooth collapse transitions and retained the theme-aware icon variant for compact badges and footer attribution.

- Added direct member access management alongside service account operator management in instrument settings, allowing viewing, adding, role changing, and revoking for direct user and project access grants.

- Unified instrument and project lifecycle status presentation with a shared ResourceStatusBadge across overview, resource summary, inspector, and settings management screens, and updated instrument status management in settings to use a modal dialog action matching other resource management actions.

- Prevented route loader re-execution and promise cancellation during client hydration by configuring default router stale time and trailing-slash normalization, and preserved visible layout during query cancellation recovery.

- Standardized Project Overview cards to follow the two-column header pattern with Summary, Identity, QR code, and full-width metadata and members, aligned the instrument landing page to Data with Overview at `/overview`, and added compatibility redirects for `/instruments/:instrumentMfid/datasets`.

- Unified project, instrument, and username slug validation and live availability checks across creation and settings forms, and enabled instrument ID renaming in instrument management settings.

- Refined resource graph node styling with flush top-left corner kind badges, expanded card height to eliminate multi-line text clipping, hover border transitions, centered association edge routing below cards, root resource drawer inspection, and progressive disclosure for node expansion controls on hover and focus.

- Improved resource graph layout resilience and stability by configuring ELK port constraints and edge routing priorities for lineage and lateral associations, preserving mental maps with semi-interactive positioning during incremental expansion, resetting orientation hints cleanly on direction toggles, adding a worker watchdog with engine recovery, and decoupling node transitions from layout interpolation.

- Removed link underlines in the application footer and vertically aligned the Crucible brand mark and API status indicator dot with adjacent text.

- Replaced the static Crucible logo with theme-aware light and dark Crucible icons across the workspace shell and authentication views without corner clipping.

- Replaced the static API health link in the application footer with an interactive status popover providing on-demand readiness probe diagnostics, Hub health links, close controls, and WCAG-compliant footer touch targets.

- Truncated long resource and person names with ellipses in collection and directory tables to prevent column overflow.

- Added a global application footer to the workspace shell displaying Crucible Dev Team attribution, links to Crucible, Molecular Foundry, and issues, API health status, and the current build revision.

- Added Hub-only response headers that prevent framing, restrict base URLs and object content, disable MIME sniffing, and limit referrers to the same origin while preserving private OAuth redirects.

- Directed sign-in callback success and error redirects to the configured public Hub origin behind the Cloud Run proxy.

- Pinned the Hub OpenAPI contract to deployed API revision `8e4d0ef`, prepared a dedicated Cloud Run image repository and runtime identity for the single-instance pilot, and excluded Hub callback request URLs from the default Cloud Logging sink.

- Added named local development scenarios for fixtures, API-key access, and ORCID against local or staging APIs, with separate gitignored credentials and no inherited settings from other scenarios.

- Prepared a separate Cloud Build image workflow and a reviewable internal Cloud Run and Nginx `/hub/` route for the single-instance pilot, with callback-safe proxy logging and activation kept separate from building.

- Added an explicit single-instance production ORCID session mode with server-side token expiry and fail-closed refresh, and documented the limited Cloud Run pilot and planned shared-session transition.

- Kept profile Save disabled for unchanged or taken usernames, moved availability feedback into accessible field-end icons, show a save-time username conflict as a toast with a persistent invalid field state, and removed duplicate focus outlines from styled controls.

- Added a standalone account-completion step after ORCID sign-in when email or username is missing, kept names optional, added debounced username lookup and specific taken-name feedback to both profile forms, and centered the ORCID sign-in action at its content width.

- Prevented caching of redirects from private Hub pages to sign-in when a session is absent.

- Made Sign out highlight the full account-menu row on hover and keyboard focus, matching My profile.

- Refined the ORCID sign-in page with the Hub mark inside the card, a quieter outlined action, tighter footer, and a faint Explorer logo background.

- Added an opt-in encrypted Redis session path for multi-replica ORCID sign-in, atomic refresh and logout, server-held administrator mode, session expiry and rotation, and broader CSRF coverage; production activation still requires deployment and browser validation.

- Completed the local sign-out handoff with a dedicated sign-in confirmation, an explicit warning when API revocation cannot be confirmed, and cross-tab cleanup of in-memory workspace data.

- Styled Sign out as an icon-bearing destructive menu action, kept the account menu enabled during page hydration, and fixed sign-out behind the configured HTTPS Hub proxy with a cookie-compatible redirect.

- Refined the standalone ORCID sign-in and sign-in error pages with shared Hub branding, clearer hierarchy, responsive spacing, and consistent light and dark styling.

- Added safe server-side sign-in callback failure reasons so failed ORCID exchanges can be diagnosed without logging credentials or callback codes.

- Allowed local ORCID login to use a browser-reachable API URL and HTTPS Hub callback separate from the private API transport, supporting a Tailscale browser once its API route and ORCID redirect are configured.

- Redirected signed-out visitors from protected Hub routes to the dedicated ORCID sign-in page while preserving their intended destination.

- Documented the gitignored local ORCID environment file and startup command so server credentials and the trusted API certificate are available before Node starts.

- Added a local API-owned ORCID sign-in flow with a dedicated sign-in page, return-to navigation, state and PKCE validation, opaque server-side sessions, bearer-token refresh and revocation, and an updated pinned OpenAPI client; production sign-in remains gated on shared session storage.

- Standardized missing resource names across Home, collections, search, previews, graphs, sibling navigation, and resource pages: samples and datasets use Untitled labels, while projects and instruments fall back to their IDs and then MFIDs. Stored names remain unchanged for editing.

- Added a Data toolbar Refresh action that reloads the active group directory and selected resource list without clearing filters or readable rows.

- Fixed account-menu readiness and scientific metadata disclosure hydration, and made bounded browser CI deterministic by updating search coverage, serializing fixture-backed checks, removing retries, and accepting normal SIGTERM production shutdown.

- Added debounced, keyboard-navigable quick results to global and project-scoped application-bar search, with bounded per-type queries and a path to complete search results.
- Kept collection view, filter, grouping, sorting, status, and ownership controls available while scrolling long data, project, instrument, and deletion-request lists on non-compact screens.
- Added visible removable filter chips and compact Clear all controls to global, project, and instrument data collections while preserving URL-backed filter and pagination behavior.

- Simplified repository agent guidance and skill routing around durable invariants, authoritative documents, focused validation, and installer-owned external skills.

- Standardized username presentation so identity and search contexts use `@username`, while account titles, labelled fields, credential workflows, copied values, and accessible names use canonical raw usernames.

- Kept searchable resource pickers open through loading and failure states, surfaced add-member failures inside the active dialog, and repaired the Theme menu grouping required by Base UI.

- Replaced the stale browser and screenshot corpus with a bounded screenshot-free functional gate, reduced CI to parallel static and browser-runtime jobs, removed duplicate dependency and browser installation and production builds, capped browser concurrency, retained failure artifacts for diagnosis, repaired pending-list semantics, and resolved the OpenAPI toolchain dependency advisory.

- Varied the Home greeting by browser-local hour between time-aware messages, “Welcome to Crucible,” and the rare “Welcome to the Crux.”

- Standardized name-only navigation across Home, resource tables, directories, search, relationships, deletion requests, and person identities while keeping supporting identifiers and metadata selectable and suppressing navigation after pointer text selection.

- Added stable Open, Graph, and Delete actions to resource previews, included compact downloadable files in dataset previews, and limited long project names to two lines in inspector context.

- Made bulk deletion review responsive while editing comments, processed requests sequentially with visible progress, added a safe stop-between-requests action, and identified review timeouts in server logs.

- Clarified resource graphs with neutral node surfaces and kept graph tooltips and options visible in native fullscreen.

- Expanded approved deletion history to every human user with personal or administrator-wide API scope, opaque cursor continuation, embedded actor identities, canonical project links where retained, and non-clickable deleted resources; eligible administrators now use one contextual elevated scope throughout the deletion destination without changing the global Administrator view.

- Added page-scoped selection and partial-success bulk approval or rejection to the reviewable deletion-request queue, with a shared reviewer comment, an in-place contextual table header, compact controls, approved-request history, and shape-matched row skeletons during loading.

- Added API-backed sorting by resource, project, requester, request time, and status to the deletion-request queue.

- Added deletion-queue resource previews and visible deletion-request status to resource pages and inspector headers.

- Fixed the Service accounts loading route so stable header and search controls remain available while only the API-backed collection renders a pending table.

- Standardized date and person column widths across resource tables and rebalanced deletion-request Resource and Project columns for denser scanning.

- Unified sortable and static column-header typography while retaining visible sort icons and interaction states.

- Standardized MFID presentation with compact muted monospace identifiers in supporting contexts while retaining full-size identifiers for primary identity fields and dedicated table columns.

- Moved deletion-request navigation into an Administration sidebar group with a trash icon, made it available to every authenticated account, and removed duplicate links from the account menu and profile page.

- Updated deletion-request queues to use stable API cursor continuation, newest-first submitted history, oldest-first pending review, reversible request-time sorting, embedded requester and reviewer identities, a linked Project column outside project-scoped views, and the shared compact responsive collection table pattern.

- Aligned deletion requests with collection-page hierarchy by moving its scope control below the page header, removing repeated headings and explanatory prose, presenting project context as a compact filter, and limiting Administration selection to review work.

- Fixed collection loading routes so global Data, Project Data, and Instrument Datasets render independent pending shells without relying on route components removed by automatic code splitting.

- Added account-visible deletion-request history and capability-guided review queues with project-scoped review, normal or explicitly elevated authority, responsive request details, confirmed approval or rejection, and complete discovery cache refresh.

- Added a direct Home recovery action to route errors and missing-page states so inaccessible elevated resources do not trap navigation after Administrator view is disabled.

- Added explicit normal and elevated API privilege modes, contextual elevation for platform Administration, a visible session-scoped Administrator view in the Administration sidebar, effective-capability and assigned-role context in Account access, and service-account creation through the shared Create menu.

- Aligned access management across projects, instruments, samples, and datasets with a shared visible management mode, compact pending indicators, and instrument manager and operator role presentation.

- Calibrated light and dark surface hierarchy, control boundaries, focus indicators, navigation selection, semantic status badges, visibility presentation, and graph resource colors through shared contrast-checked design roles.

- Aligned Scientific metadata with the wide resource-detail column and Relationships with the narrow column while using a compact reading order that places Identity and Thumbnails before Files and Relationships before metadata.

- Increased scientific metadata density with compact keys, tighter rows, and reduced nested indentation while preserving readable scalar values.

- Moved recently viewed sidebar resources below Administration when administrative navigation is available.

- Improved scientific metadata browsing with local field and value search, visible top-level fields, compact scalar arrays, collapsed nested structures, and incremental rendering for long arrays.

- Added capability-gated service-account administration with a searchable directory, service-account-specific identity and profile fields, platform-role editing, non-secret credential status, one-time creation keys, confirmed key rotation, service-account autocomplete for instrument operators, contributor-bounded project roles, and authorized management links from service-account profiles.

### Added

- Added URL-backed graph display options for canvas associations, opt-in batched dataset thumbnails, and vertical-default or horizontal ELK orientation while preserving the complete accessible relationship table, and grouped related viewport and recovery controls.
- Added the four most recently viewed resources as bounded sidebar shortcuts, with a single collapsed history menu that remains separate from Administration and preserves account-scoped history through recoverable route transitions.
- Added URL-backed sortable group headers for sample and dataset directories, with API-provided canonical facet labels, reversible Name and Count ordering, and count columns that remain visible beside truncated long labels.
- Added confirmed dataset acquisition-instrument reassignment with canonical instrument selection, API-authoritative identity updates, derived access refresh, dependent collection invalidation, and sibling-navigation reset.
- Added configurable anchored sibling navigation on canonical sample and dataset pages, with project, subtype, owner, and instrument scopes, API-backed ordering, and independent on-demand continuation in both directions.
- Added URL-backed, API-grouped browsing for type-specific global Data, Project Data, and Instrument Datasets, with reusable responsive group directories, server-owned counts and null buckets, lazy selected-group loading, paginated group values, compact owner identities, and name-ascending selected results; aligned Instrument Overview with shared Summary, Identity, MFID, QR, timestamp, and metadata patterns.
- Added route-backed ownership filtering across Data, Projects, and Instruments, API-owned sorting and bounded sample-type, measurement, session, data-format, resolved-owner, and resolved-instrument facets in global and project-scoped type-specific Data views, explicit collection totals, and cursor pagination for project and instrument directories.
- Show each sample and dataset MFID as a scannable QR code in its Identity card.
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

- Stabilized Home's recently added data as one creation-time-ordered sample and dataset snapshot, retaining the previous list until independently loading sources settle.
- Preserved stable resource shells, navigation, collection controls, field labels, and table headings during loading with shared route-shaped, table-shaped, and compact-list skeleton presentations, while keeping refresh announcements out of page layout.
- Unified Home, search, relationship, and graph-table resource identities around shared flat list presentations with consistent spacing, separators, hover, focus, and responsive trailing content, and labelled instrument ownership as management in the directory.
- Allowed normal page scrolling over resource graphs, reserved modifier-scroll and pinch gestures for graph zoom, and added double-click or focused-node keyboard centering without changing zoom.
- Ordered relationship lists by natural resource name within Parents, Children, Associated, and Related groups across Overview and Graph.
- Smoothed graph expansion by anchoring the activated node through multi-stage requests, updating React Flow through one controlled node state, introducing new nodes from their expansion origin, fading in additions, and cancelling obsolete layout work.
- Centered graph-node identity groups while keeping wrapped names and their sample type or measurement left aligned within one shared copy column.
- Refined graph expansion actions and relationship paths with shared circular controls, directional more icons, controls offset from connection anchors, rounded lineage routing, center-to-center curved dashed associations, compact open arrowheads, and synchronized highlight states.
- Aligned graph node expansion controls with the selected layout direction, including vertical ancestor and descendant arrows and a separate association position.
- Strengthened the resource inspector hierarchy by applying the shared semibold section-title typography to wrapping resource names.
- Limited Browse nearby configuration, sibling controls, and keyboard navigation to resource Overview, replaced inactive boundary arrows with one clear entry action, and retained active sequences across other resource sections with an explicit Clear sequence action.
- Unified project and instrument directories with 100-row cursor pages, appended automatic continuation, explicit Load more recovery, loaded progress, and Back to top.
- Kept breadcrumbs to one line with naturally sized bounded project labels and predictable truncation for long project and resource names.
- Made project assignment optional when creating samples and datasets while retaining project-context preselection.
- Marked primary-project access grants as structural read-only entries and preserved unrelated project grants while project reassignment refreshes authoritative access.
- Simplified page headers by removing redundant section eyebrows, retaining distinct project and instrument IDs as secondary metadata, and using the correct person or service-account icon on public profiles.
- Moved ELK graph layout to a browser worker, reduced graph rerenders and repeated initial arrangements, made dragging immediate, deferred relationship thumbnails until near the viewport, preserved in-place node-to-node inspector switching, and recovered routine Query cancellation through route invalidation without trapping navigation in an error-boundary retry loop.
- Recovered stale lazy-loaded application modules with Vite's native preload-error event and a full-page error-boundary fallback.
- Kept dataset Processing failures inside the resource workspace and added correlation-safe browser and server diagnostics for route, API, and response-contract failures.
- Kept resource identity headers and section navigation mounted while Overview and Manage load, added shape-matched tab skeletons and local recovery, and retained the readable graph while its bounded topology refreshes.
- Adopted ELK Layered for collision-free resource graphs, made deeper automatic traversal lineage-focused with only the current resource's direct associations, and added node-local expansion with retained content, loading and arrangement feedback, and reduced-motion-aware animated updates.
- Replaced the legacy inferred resource graph adapter with the typed bounded resource graph operation, preserving stable edge identity, explicit lineage and association semantics, relationship types, completeness and truncation metadata, and independently cached depth-one node expansion.
- Added a focus-restoring Back to top control to long cursor-backed resource collections and standardized short successful edit confirmations as polite application toasts while retaining actionable feedback inline.
- Expanded My profile with API credential validity and dates, icon-labelled account capabilities, a wide-screen Profile and Account access row with the matching-width credential card directly beneath Profile, and the shared credential-status presentation used by service-account administration, while standardizing success, warning, and destructive badge colors.
- Simplified sample and dataset collections by keeping a text-only Project column in global Data and replacing the redundant project-scoped column with Sample type or Measurement on wide screens.
- Unified project-scoped search and collection ownership switches with the shared segmented-control presentation.
- Redesigned sample and dataset graphs around React Flow and ELK with a centered current resource, collision-safe directional placement, shared type icons, two-line names, type-specific context, neighborhood emphasis, graph controls and legend, and a responsive accessible relationship card. Graphs use independent three-level ancestor and descendant paths plus direct associations, support fullscreen viewing, draggable nodes, and layout reset, remove redundant canvas depth and expansion menus, and remove completed expansion directions from each node's available actions.
- Adopted API-provided per-node expansion availability so graph nodes directly expose only confirmed upstream, downstream, and association expansion actions across merged graph reads.
- Kept graph-node resource previews open by treating the interactive graph canvas as a preview trigger during outside-interaction dismissal.
- Improved compact layouts with inline utility actions and field labels, contained full-label resource tabs, natural scientific-name wrapping, single-line MFID identity where space permits, touch-sized directory navigation, and stable administration hydration.
- Made the service-account directory and search controls reflow cleanly on compact screens while retaining natural desktop column spacing, aligned credential creation and expiration dates, standardized collection page navigation, and unified browser-safe API mutation error formatting with retained request references.
- Replaced person-type prose in shared stacked and avatar identities with accessible person or service-account icons across service-account directories, search results, member lists, pickers, and account presentations.

- Standardized semantic icon colors with Crucible brand blue for combined Data, a slate-blue file identity used in file workflows, stronger light-theme instrument contrast, colored capability identities, complete design fixtures, and an enforced feature-level icon catalog boundary.
- Split lightweight project and resource identity reads from metadata, relationship, and membership-heavy overview projections, and centralized mutation cache invalidation across every cached detail shape.
- Removed obsolete workspace collection hydration and unused transitional cache state so routes hydrate only query entries they can consume.
- Global Data now switches directly between separate API-backed Samples and Datasets collections and defaults to Samples, removing the weaker combined All mode that could not support equivalent filtering, sorting, grouping, or pagination.
- Sample and dataset browsing now defaults to newest creation time across global, project, instrument, grouped, paginated, and sibling-navigation contexts.
- Resource graphs now derive root labels from graph data so route refreshes cannot detach the graph from its workspace context.
- Browser-local timestamps now hydrate from a stable UTC fallback before switching to local time, preventing server and client timezone mismatches across collections and detail views.
- Sibling navigation links now declare anchor semantics to Base UI, removing the native-button accessibility warning.
- Home now separates Projects you lead from active Instruments you manage, and project and instrument directories use visible, route-backed All and ownership scope controls without requesting undisplayed totals.
- Recently added data on Home now uses API-backed newest-creation ordering across samples and datasets.
- Kept the resource inspector open when focus follows an underlying resource link, preventing a newly selected preview from immediately closing.
- Sibling navigation now omits sequence positions and partial loaded-row counts from its compact control.
- Kept search-result MFIDs and their copy actions separated at desktop widths.
- Streamlined Graph and picker copy, renamed the project directory to Your projects, refined semantic role badge colors, and added distinct Created and Updated columns with API-backed Created sorting and filtering where supported.
- Project-context search now names the resolved project in the application bar, resource previews retain known row identity while loading, and canonical sample and dataset pages opened from a collection provide a compact labeled sibling control through its loaded sequence with cursor continuation at the forward boundary; entity workspaces now place a clearly scoped Refresh action beside their section navigation.
- Resource collections now request up to 100 rows, automatically append the next cursor page near the collection boundary while retaining explicit load and retry controls, and make project search visible in the application bar with an explicit project or global scope choice that persists through contextual resource navigation.
- Replaced page-replacing sample and dataset continuation with shared cursor-backed Load more results across global, project, and instrument collections, and added collection-scoped Previous and Next navigation to resource previews with on-demand forward-page loading.

- Streamlined global, project, and instrument data collections with one responsive type, filter, and grouping toolbar; replaced separate List and Browse controls with `Group by`, moved filters into a scrollable side sheet with persistent actions, and aligned instrument navigation and header identity with project workspaces.

- Updated the pinned staging API contract and generated client for owned-resource affiliation, explicit totals, project and instrument cursors, preferred owner filtering, and authorization-scoped dataset and sample facets with explicit null buckets.
- Reorganized sample and dataset creation into visible, consistently labelled sections, prefilled new-resource timestamps from browser-local time, standardized inline optional labels across forms, and added shared parent, child, and cross-resource relationship selection with partial-failure recovery.
- Rebalanced sample and dataset Overview cards so Identity and Thumbnails share a column, Relationships and Scientific metadata share an equal-width row, relationship groups retain a single readable column, and nested metadata renders as an expandable row-based JSON tree with header-level expansion controls and compact empty-collection notation.
- Distinguished service-account owners on sample and dataset Identity cards with the semantic robot icon while keeping owner names free of trailing type icons.
- Distinguished service accounts from people across shared identity presentations with a violet robot icon and avatar border plus a service-account label, using the public account-type discriminator.
- Resolved sample and dataset owners in project data tables through the shared person identity presentation, including name fallback when no username is set, profile navigation, and hover details.
- Standardized person identity links and contextual project and instrument references within sample and dataset workflows on a shared keyboard-accessible hover preview, while keeping project and instrument directories and primary navigation as direct links.
- Added project ID context to sample and dataset search results alongside sample type or measurement, including autocomplete pickers and direct MFID results when project context is available.
- Standardized editable-card commit controls and bounded card and inspector loading, empty, initial-error, and refresh-error states through shared domain components.
- Standardized resource identity, MFID typography, and repeated project, owner, Updated, and Open collection cells through shared domain components with static enforcement for future MFID presentation.
- Standardized confirmation overlays and grouped resource-management entries through shared domain components with consistent pending, error, dismissal, action, and responsive layout behavior.
- Standardized resource and person pickers on debounced autocomplete with anchored suggestion overlays, keyboard selection, and compact text-only confirmation actions that do not move as results change; reversible public-access confirmations now support Close, Escape, and outside-click dismissal.
- Tightened the project Lead column and standardized every resource collection on a 12rem Updated column immediately before the trailing Open action.
- Standardized person identity across account, profile, directory, membership, ownership, access, operator, inspector, and search surfaces with shared inline, stacked, avatar, and three-line tooltip presentations plus consistent profile hover and click behavior.
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

- Replaced lagging resource-graph expansion overlays with React node controls aligned to the resource edges and separate ancestor, descendant, and association expansion choices with equivalent accessible menus.
- Fixed draggable graph nodes disappearing by using React Flow's native node-change state and persisting positions only after a drag completes.

- Kept public identity references and generic project resource details consistent after profile, ownership, and descriptive updates.
- Prevented terminal API errors from being retried and bounded retry timing for transient and rate-limited requests.
- Prevented desktop resource-preview dismissal from racing an underlying link or control navigation, and removed redundant detail requests from preview-link hover and focus.
- Prevented invalid dataset file or ingestion responses from crashing the Processing page by validating them at the server boundary and keeping failures local to the affected panel.
- Normalized timezone-aware PostgreSQL timestamps with space separators, microseconds, or compact UTC offsets into the shared browser-local date and time presentation.
- Standardized resource and access-principal icons with shared semantic colors, including cyan-teal person identity in Direct access, colored navigation icons, and field-specific Summary and Identity icons.
- Presented account profiles read-first behind an explicit Edit profile action, standardized Crucible IDs on the shared icon and quick-copy treatment across authenticated and public profiles, and restored readable Add member action contrast in light and dark project settings.
- Improved compact Data readability, creation validation and discard behavior, graph rendering and controls, visible management actions, field error associations, compact creation access, route titles, and fixture browser coverage for creation and consequential mutations.
- Restored the visible forward arrow inside Data table full-page actions while preserving their accessible labels, tooltips, and fixed geometry.
- Kept readable collections and dataset detail available during refresh or file-panel failures, limited Data requests to the selected resource types, and added focused retries.
- Distinguished unavailable project membership from an empty member list, linked Home's recent datasets to detail in creation order, and included public-safe person detail in SSR hydration.
- Preserved page headers and controls during collection pagination, retained identity-safe previous pages with local update feedback, and distinguished dashboard loading from empty or unavailable results.
- Kept the authenticated application shell mounted during navigation by moving critical route Queries into TanStack Router loaders with intent preloading and scoped skeleton fallbacks, including a results-only fallback that preserves search controls and context.
- Configured Nitro to serve generated assets beneath `/hub`, matching the application URLs emitted by Vite.
- Excluded generated Nitro build output from source linting so repeated validation remains deterministic.
