# Crucible Hub information architecture

This document owns Hub routes, navigation, shell behavior, and URL-backed workflow structure. [Product brief](product-brief.md) owns user intent, [design system](design-system.md) owns presentation, [architecture](architecture.md) owns runtime and data boundaries, and [authentication](authentication.md) owns sign-in and session routes. Every path below is served under the `/hub` base path.

## Navigation principles

- Canonical paths use stable MFIDs; collection views keep validated state in the URL.
- Global navigation, entity context, and section navigation stay visibly distinct.
- Opening a resource from a collection or the inspector preserves the collection context.
- Authorized public-safe representations are valid content, not failed loads.
- Navigation uses real links, so browser history, new tabs, and modifier keys work natively.

## Application shell

The sidebar holds, in order:

| Group          | Items                                                                                                                                                                                                                                               |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Destinations   | Home; Data with Samples and Datasets sub-items and their create actions; Projects with a create action; Instruments with a register action.                                                                                                         |
| Administration | Administrator view switch (eligible human administrators only); Users, Service accounts and Ingestion workers (only while Administrator view is on); Deletion requests and Join requests, each with a count badge of requests awaiting your review. |
| Recent         | The newest four recently viewed projects, instruments, samples, and datasets.                                                                                                                                                                       |
| Footer         | Shortcuts, Theme, and the collapse control (not in the compact drawer).                                                                                                                                                                             |

Sidebar create actions appear on hover or focus; touch devices use the top-bar Create menu instead. Wide and expanded windows show the saved sidebar choice, medium windows an icon rail, and compact windows a drawer with the same items (window classes are in [design-system-reference.md](design-system-reference.md#responsive-layout)).

The top bar holds the search field (`Ctrl K` for global scope, `Ctrl Shift K` for project scope inside a project) with the QR scanner inside it, the Create menu, the preview pane toggle on wide windows, the Administrator view status while it is on, and the account menu (My profile, Preferences when account preferences are on, Sign out). The QR scanner resolves scanned MFIDs and trusted Crucible links through `/resources/:resourceMfid`.

Entity pages put their name in the browser title and a `RefreshButton` at the right of their section tabs.

## Routes

### Workspace

| Route                                                          | Page                                                                                      |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `/`                                                            | Home                                                                                      |
| `/data`                                                        | Global sample and dataset collection                                                      |
| `/search`                                                      | Global or project-scoped search                                                           |
| `/projects`, `/projects/new`                                   | Project directory and creation                                                            |
| `/projects/:projectMfid`                                       | Project Data                                                                              |
| `/projects/:projectMfid/overview`                              | Summary, Identity, scientific metadata, and People                                        |
| `/projects/:projectMfid/settings`                              | Project Manage                                                                            |
| `/instruments`, `/instruments/new`                             | Instrument directory and registration                                                     |
| `/instruments/:instrumentMfid`                                 | Instrument Data                                                                           |
| `/instruments/:instrumentMfid/overview`                        | Summary, Identity, scientific metadata, and People                                        |
| `/instruments/:instrumentMfid/settings`                        | Instrument Manage                                                                         |
| `/samples/new`, `/datasets/new`                                | Sample and dataset creation with optional project or instrument preselection              |
| `/samples/:sampleMfid`, `/datasets/:datasetMfid`               | Resource Overview                                                                         |
| `/datasets/:datasetMfid/processing`                            | Files, ingestion, and post-processing runs                                                |
| `/samples/:sampleMfid/graph`, `/datasets/:datasetMfid/graph`   | Resource graph                                                                            |
| `/samples/:sampleMfid/manage`, `/datasets/:datasetMfid/manage` | Resource Manage                                                                           |
| `/deletion-requests`                                           | Deletion requests: `view=submitted`, `reviewable`, or `approved`                          |
| `/join-requests`                                               | Join requests: `view=submitted` or `reviewable`                                           |
| `/account`, `/account/security`                                | My profile: Overview, and Security (sign-in methods, sessions, API keys, sign-in history) |
| `/preferences`                                                 | Preferences: General, Browsing (`tab=browsing`), and History (`tab=history`)              |
| `/users/:userId`, `/users/:userId/security`                    | A person's profile, and their Security tab for administrators                             |
| `/admin/users`                                                 | User directory, accounts awaiting approval, and user creation                             |
| `/admin/service-accounts`                                      | Service-account directory and creation                                                    |
| `/admin/service-accounts/:serviceAccountMfid`, `.../security`  | Service-account profile, and its API keys, key creation and rotation, and sign-in history |
| `/admin/workers`                                               | Ingestion workers registered in the last day, with status, versions, stores and ingestors |

### Redirects

| Route                                                                               | Redirects to                   |
| ----------------------------------------------------------------------------------- | ------------------------------ |
| `/resources/:resourceMfid`                                                          | The resource's canonical route |
| `/projects/:projectMfid/members`                                                    | Project Overview               |
| `/projects/:projectMfid/settings/members`, `.../settings/ownership`                 | Project Manage                 |
| `/instruments/:instrumentMfid/datasets`                                             | Instrument Data                |
| `/instruments/:instrumentMfid/settings/lifecycle`, `.../operators`, `.../ownership` | Instrument Manage              |
| `/samples/:sampleMfid/access`, `/datasets/:datasetMfid/access`                      | Resource Manage                |

### Outside the shell

| Route                                                                  | Purpose                                                                                                                   |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `/auth/sign-in`, `/auth/error`                                         | Sign-in page and sign-in error page                                                                                       |
| `/auth/login`, `/auth/callback`, `/auth/link/callback`, `/auth/logout` | Server routes for sign-in, linking a sign-in method, and sign-out ([authentication](authentication.md))                   |
| `/account/setup`                                                       | Completes a new account before it enters the workspace                                                                    |
| `/reauthenticated`                                                     | Closes the window opened to confirm a sign-in and tells the original tab                                                  |
| `/files/:fileMfid/open`                                                | Redirects to a short-lived inline link for a stored file ([decision 0034](../decisions/0034-open-stored-files-inline.md)) |
| `/files/unavailable`                                                   | Explains why a file could not be opened                                                                                   |
| `/health`                                                              | Health check                                                                                                              |
| `/fixtures/design-system`, `/fixtures/scenarios`                       | Unlinked fixture pages ([design fixtures](design-fixtures.md))                                                            |

## Home

Recently added data (All or Mine) and Recently viewed fill the main column; Your projects (up to seven, with role badges) and Your instruments (up to seven active instruments you manage) share the side column on wide screens, with creation links when empty and View all links to their directories.

Recently viewed is scoped to the server and account. When account preferences are on (`HUB_ACCOUNT_PREFERENCES_ENABLED`), it comes from the account's history in the API (Preferences > History can turn recording off or clear it); otherwise it is held in memory for up to eight resources and clears on reload or account change. It never enters URLs or browser storage. Home shows five and the sidebar four.

## Collections

Data (`/data`), project Data, and instrument Data share one URL-backed collection toolbar: resource type, filters, `Group by` (owner, sample type, measurement, session, data format, instrument, or primary project where not redundant), and Refresh; table headers sort, defaulting to newest created. Choosing a group loads the API-backed group directory and fetches resources only after a group is chosen. Rows load in cursor pages as the person scrolls, with Load more and retry fallbacks.

Lists, group counts, Home Recently added, and sample and dataset search hide records readable only because they are public. Include public data in Filters (or in an empty state) brings them back, shown as a **Public** pill; Clear returns to the saved default in Preferences. The choice is in the URL as `publicData` only when it differs from the default. Owned by me and Home's Mine turn it off, Administrator view always shows everything, and direct links, MFIDs, QR codes, the graph, and relationships are unaffected.

Project Data switches between Samples and Datasets with All, Assigned, and Shared filters. Instrument Data lists datasets acquired on the instrument; instrument members choose All (every dataset recorded on the instrument, the default) or Personal (only datasets reached through their own access), kept as `access=personal`.

The project and instrument directories have URL-backed search, sorting, a Filters sheet, and Refresh. The search page has its own Filters panel (Include public data, Project, and Ownership, offered only on tabs that can use them) kept as `publicData`, `projectMfid`, and `affiliation=owner`, plus a Scientific metadata mode (`mode=metadata`). Choosing a project switches to project-scoped search, which the top-bar search also adopts inside a project and on resource pages opened with a validated `fromProject` parameter.

## Entity pages

### Project

Tabs: Data, Overview, and capability-gated Manage. A non-member sees Request to join. Overview holds Summary (editable when authorized), Identity, scientific metadata, and People, with the owner shown as Lead. Manage holds Access management (direct members and roles), pending join requests, a bounded deletion-request preview linking to the shared queue, and Resource management (ownership transfer, leaving, and permanent deletion of an empty project).

### Instrument

Tabs: Data, Overview, and capability-gated Manage. Overview holds Summary, Identity (with QR code), scientific metadata, and People (members and projects with a role). Manage holds Access management (Members: the manager plus admins, editors, and viewers; and service-account Operators) and Resource management (lifecycle status, ownership transfer, and permanent deletion of an empty instrument).

### Sample and dataset

Tabs: Overview, Processing (datasets only), Graph, and Manage, under a persistent header with a primary-project breadcrumb. Processing, Graph, and Manage load their data only when entered.

- Overview: Summary, Identity, Relationships (the canonical place to edit links), scientific metadata, and for datasets Files and Thumbnails.
- Processing: files with their latest ingestion request and history, and post-processing runs.
- Manage: Access (direct grants and public access, when `can_manage_access` allows) and Resource management (primary project, dataset instrument, ownership transfer, and deletion request).
- Graph: a bounded provenance graph ([decision 0026](../decisions/0026-explore-bounded-resource-graphs.md)). The first read loads three levels of ancestors and descendants plus the resource's direct associations; nodes with more readable topology offer one-level expansion. A Filters menu hides samples, datasets, each lineage type, or associations (`hide`, `associations`); the navigation group holds zoom, fit, and center; Display options set direction (`orientation`), thumbnails (`thumbnails`), and Reset graph; fullscreen is separate.

### People and service accounts

`/users/:userId` shows a public-safe profile; administrators in Administrator view also see projects, a Security tab, platform-role editing, and account disabling. Service-account pages use the same layout. Users, Service accounts and Ingestion workers require an eligible human administrator with Administrator view on; otherwise the route offers to turn it on or redirects to Home, and their server functions refuse with `403`.

### Deletion and join requests

Both queues share one layout with Your requests and Needs review views. Deletion requests adds Approved history from the deletion audit for human accounts. Needs review uses the API's review capability; under Administrator view it becomes platform-wide. Review supports multi-row selection for bulk approval or rejection, submitting each request separately and keeping completed reviews on partial failure.

## Resource inspector

An optional `preview` search parameter opens a resource in the inspector above the current page without unmounting it. Its modality follows the window class ([decision 0037](../decisions/0037-adapt-resource-inspector-to-viewport.md)): modal on compact and medium windows, a non-modal overlay on expanded windows, and a docked pane on wide windows that keeps the last preview across pages. A plain click on a preview link opens the inspector (pushing one history entry from closed, replacing it while following in-panel links, with an in-panel Back trail); `Ctrl+Click` (`Cmd+Click` on macOS) navigates to the canonical route, and middle-click opens it in a new tab. History and data ownership are in [decision 0008](../decisions/0008-inspect-linked-resources-in-place.md).

## Sibling navigation

Opening a sample or dataset from a loaded collection starts a session-only sibling sequence; opening one any other way builds the person's default sequence (same primary project and measurement or sample type, oldest first), which Preferences > Browsing can change or turn off. Overview shows Previous and Next (also Left and Right Arrow) and a dialog to change the scope (all readable resources, primary project, type, owner, or dataset instrument) and order (name, created, or updated) and save it as the default; Browse nearby appears when no sequence applies. Other tabs keep the sequence without showing it, and reloads or account changes clear it.

## Responsive and accessible behavior

- Routes and headings stay the same at every width.
- Prefer stacked controls, contained data regions, and list fallbacks over page-level horizontal scroll.
- Status, permission, lifecycle, and resource type are readable as text, not only color or icons.
- Local loading, failure, and mutation state is announced without replacing stable page context.
