# 0011: Generate File Downloads on Demand

Status: Accepted

Date: 2026-09-04

## Context

Dataset detail already lists authorized file metadata without requesting download capabilities. Crucible API exposes a single-file operation that generates a signed object-storage URL with a one-hour lifetime and returns no URL for catalog-only files. The current OpenAPI response is untyped even though the implementation returns `url` and `expires_in`.

Signed URLs grant temporary access to file content. Generating them while rendering, prefetching, inspecting relationships, or loading all files would create unused capabilities and expand their exposure. Hub also must not proxy potentially large scientific files through its application server.

## Decision

Full dataset detail presents a conventional Download icon action beside each GCS-backed file, with a visible tooltip and a file-specific accessible name. Hub requests a signed link only after the user activates that file's action. Rendering, hovering, preloading, inspecting a dataset, and loading file metadata do not generate links. Catalog-only files remain visible with an explicit unavailable state and never invoke the link endpoint.

The browser calls a validated `POST` TanStack Start server function for one file MFID. The Hub function applies same-origin CSRF handling, authenticates independently after the production session cutover, sets `Cache-Control: no-store`, and calls only `GET /files/{file_id}/download_link` with the current user's API authority. Using a Hub `POST` models capability generation as an explicit action even though the API operation is currently `GET` and may backfill missing storage-path bookkeeping.

Until the API publishes a response model, the server-only adapter strictly validates the complete response as either an absolute HTTPS URL with a positive integer expiry or the catalog-only `null` pair. Malformed or inconsistent output fails safely as an upstream contract error rather than reaching the browser. This guard is temporary API compatibility code, not a replacement contract; Hub should consume the generated response type once the API owns it.

The signed URL is a transient action result. It does not enter TanStack Query or Mutation state, hydration, Hub route state, component state, DOM attributes before activation, application storage, logs, telemetry, or error reports. After a successful response, the event handler immediately hands the URL to same-tab native browser navigation with referrer isolation and then discards its reference. Each row owns independent pending and failure feedback so the file list remains usable. A pending response is discarded if its row unmounts or the active file or identity changes.

The API remains responsible for authorization and object-storage response behavior. Guaranteed attachment handling for browser-displayable formats requires the API to sign an appropriate content-disposition response parameter; Hub does not proxy file bytes or alter signed query parameters to compensate.

## Privacy review

Activation introduces the API-authorized object-storage host as a direct browser recipient and transfers a short-lived capability to the browser. This occurs only following an explicit action for a named file. Hub introduces no persistent application storage, background generation, cross-file aggregation, or telemetry field.

The capability may remain visible in browser-managed network and download history and in the object-storage provider's access logs. Hub cannot revoke browser history after navigation, so expiry remains API-owned. Tests use deterministic non-production URLs, intercept navigation before external access, and do not record capability values in snapshots or traces.

## Consequences

- Link freshness is tied to the click rather than page-load time.
- No unused link is generated for another file or dataset.
- Repeated clicks intentionally request fresh capabilities; Hub does not reuse an earlier result.
- The UI can recover locally from authorization, missing-object, rate-limit, timeout, and malformed-response failures.
- Bulk downloads, archives, upload orchestration, and file-byte proxying remain out of scope.
- The API needs a typed download-link response and content-disposition contract for full generated-client coverage and guaranteed attachment behavior.

## Validation

- Prove zero link requests on render, hover, metadata refresh, relationship preview, and catalog-only rows.
- Prove one request for the activated file, independent row pending state, repeat activation, and no sibling request.
- Validate ready, unavailable, malformed, insecure-URL, unauthorized, missing, retryable, and cancelled outcomes.
- Verify that signed URLs do not appear in Query or Mutation caches, hydration, route state, DOM before activation, logs, telemetry, screenshots, or committed artifacts.
- Verify native browser handoff, keyboard activation, referrer isolation, compact table behavior, theme parity, and automated accessibility.
- Retain production boundary checks proving that the server-only API adapter and credentials cannot enter browser bundles.

The [roadmap](../docs/roadmap.md#single-file-downloads) owns implementation status and completion evidence.
