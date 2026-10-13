# 0034: Open Stored Files Inline Through a Hub Redirect Route

Status: Accepted

Date: 2026-10-13

## Context

[Decision 0011](0011-generate-file-downloads-on-demand.md) gives each GCS-backed file a Download action that requests a signed link only after activation. Researchers also want to look at PDFs, images, text, JSON, and CSV without saving them first. Crucible API revision `6f227ca` (pull request 311) adds an optional `disposition=attachment|inline` query parameter to `GET /files/{file_id}/download_link`: `attachment` keeps the record filename as a download, and `inline` signs a content type derived from the filename so browser-displayable formats open in a tab, while HTML, SVG, XML, and XSL always download. Each call returns a fresh one-hour URL. The same revision returns `409` when a record's object lies outside its own dataset, the only `409` that route returns.

Opening a tab after an asynchronous server-function call loses the user activation that browsers require for new windows, so a button-driven flow would need a placeholder tab opened synchronously and navigated later, and it would not support middle-click, modifier-click, or the browser's own open-in-new-tab action.

## Decision

The Download icon action is unchanged and requests `attachment` without the parameter. In dataset file tables, the name of a GCS-backed file is a real link to the Hub server route `/hub/files/{file_mfid}/open`, opened with `target="_blank"` and `rel="noopener"`. Catalog-only files keep a plain name and no link.

The route validates the file MFID, runs inside the normal request middleware and session, calls `GET /files/{file_id}/download_link?disposition=inline` with the current user's API authority, and redirects with `302` to the signed URL, `Cache-Control: no-store`, and `Referrer-Policy: no-referrer`. It generates a new link on every visit and never stores, logs, or reuses it. When the API reports a catalog-only file, an invalid storage location (`409`), or any error, the route redirects with `303` to the standalone `/hub/files/unavailable` page with a coarse reason (`unavailable`, `not-found`, `forbidden`, `unauthenticated`, or a generic failure). The page explains the outcome and offers sign-in when relevant; it never shows API detail text. In fixture mode the route accepts a validated `scenario` parameter and returns deterministic non-production URLs.

The Download action maps the same `409` to its existing unavailable state instead of the retry error.

## Privacy review

The signed URL now reaches the browser as a redirect target rather than a server-function result, and it appears in the new tab's address bar and history, as any opened file does. It is still generated only after an explicit user action on a named file, never while rendering, hovering, or preloading: the link points to a Hub URL, and the Hub uses no router preloading for it. No new storage, telemetry, or third-party recipient is introduced beyond the object-storage host already accepted in decision 0011.

## Consequences

Opening a file needs no client script, works with every native way of opening a link, and keeps signed URLs out of Hub component state. The route is a private, data-bearing server route, a deliberate exception to the preference for server functions in [architecture](../docs/architecture.md); it must keep authenticating through the request session and must stay a read-only redirect. Same-origin CSRF checks do not apply to this `GET`, which is acceptable because it only issues a read capability for the signed-in user and the session cookie is `SameSite=Lax`.

## Alternatives

- A link-styled button that opens a placeholder tab synchronously and navigates it after a server-function call: rejected because it loses native link behavior and needs pop-up workarounds.
- Proxying file bytes through the Hub: rejected for the reasons in decision 0011.
