# 0010: Inspect Project Data in Place

Status: Accepted

Date: 2026-09-04

Updated: 2026-10-22

Extends: [decision 0008](0008-inspect-linked-resources-in-place.md) to project Data collections. [Decision 0037](0037-adapt-resource-inspector-to-viewport.md) owns inspector modality and dismissal.

## Context

Project browsing is a primary way scientists find Crucible data. Resource detail already supports relationship exploration in a right-side inspector, but project table rows currently require full-page navigation. The same inspector should support a project collection without introducing a second navigation or data cache.

## Decision

Provide an explicit Preview action beside each sample or dataset's canonical name link in project Data. The name remains a normal full-page link. Preview opens the existing modal Sheet above the unchanged collection and follows the existing close, relationship exploration, Back in preview, and Open full page behavior.

The project Data index owns the validated `preview` search parameter alongside kind, relationship scope, and cursors. Preview changes preserve collection search state, hash, and scroll. They are not collection loader dependencies and must not initiate collection reads. TanStack Query remains responsible for data freshness; the route retains the established native loader and search-state mechanisms.

One shared preview controller accepts an explicit resource or project-Data host. Trusted history must match the host kind, host MFID, and current Query-client identity ownership. Opening pushes one entry, following replaces it with a bounded exploration trail, and closing returns to the existing collection entry when that entry is trusted. Direct entry and reload close by replacing only preview state. Changing the collection filters, page, or project section ends the preview session. Canonical full-page navigation must not carry project filters, cursors, or the exploration trail into the destination.

The inspector observes the existing authoritative detail Query. Rows never seed detail cache entries. Neither displaying the table nor hovering a preview action requests detail, files, neighbours, thumbnails, or download links. Opening a dataset preview reads its file list and thumbnails for the inspector's quick actions; download links are generated only on request. The shared detail request opts out of unused embedded datasets and keeps `include_links` as the association source; its browser representation and cache key remain unchanged.

## Privacy review

This extends the accepted URL/history policy to a project MFID as the host and adds a host-kind discriminator. The URL contains the project, collection state, and selected resource MFID. The bounded browser history trail contains identifiers and ownership markers, not display names, resource contents, grants, or credentials. It does not establish that every inspected neighbour belongs to the project.

No new storage mechanism, retention period, telemetry field, third-party host, or personal-data projection is introduced. Browser-managed history may survive session restoration, but restored trail metadata is trusted only within the current runtime identity and matching host. Reload and Query-client replacement reject previous ownership. A copied URL requires independent API authorization and transfers no permissions.

## Validation

- Preserve existing resource-page inspector behavior and origin isolation.
- Verify explicit keyboard-operable preview actions, canonical links, full-page promotion, relationship exploration, browser Back/Forward, direct entry, reload, and close safety.
- Verify project heading, table geometry, scroll, filters, and cursors survive preview navigation, including local failure and retry.
- Assert bounded detail reads, no preview-driven collection reads, file and thumbnail reads only for an opened dataset preview, and cache reuse without row-to-detail seeding.
- Review wide-light and compact-dark presentation, accessibility, focus restoration, and horizontal overflow.

The [roadmap](../docs/roadmap.md#project-collection-inspection) owns implementation status and completion evidence.
