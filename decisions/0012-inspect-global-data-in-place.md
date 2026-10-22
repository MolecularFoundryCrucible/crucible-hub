# 0012: Inspect Global Data in Place

Status: Accepted

Date: 2026-09-05

Updated: 2026-10-22

Extends: [decision 0008](0008-inspect-linked-resources-in-place.md) and [decision 0010](0010-inspect-project-data-in-place.md) to the global Data collection. [Decision 0037](0037-adapt-resource-inspector-to-viewport.md) owns inspector modality and dismissal.

## Context

Global Data is the cross-project collection for samples and datasets accessible to the current account. Its API-backed project, relationship, visibility, date, instrument, type, and cursor state should remain intact while a scientist inspects one result and explores its immediate relationships. Project Data already proves the interaction, but its project MFID is not an appropriate global host identity.

## Decision

Provide the same explicit Preview action beside every sample or dataset canonical name in global Data. Preview opens the shared modal Sheet above the unchanged collection. The Data route owns the validated `preview` search parameter without adding it to collection loader dependencies or Query keys.

Extend the shared preview controller with a distinct global Data host. Its trusted history identity uses the host kind and one stable non-resource origin marker. Opening pushes one preview entry, relationship exploration replaces that entry with the bounded MFID trail, and safe close follows the existing owned-entry rules. Direct entry, reload, malformed state, identity replacement, and mismatched host history remain untrusted and close by replacing only `preview`.

Preview navigation preserves applied filters, independent cursors, hash, and scroll. Applying or clearing filters, changing resource kind, paginating, or navigating elsewhere clears preview history. Canonical full-page links and the inspector footer do not carry Data filters, cursors, preview selection, or trail into the resource route. Browser Back may restore the exact global collection and preview entry.

Reuse the authoritative resource-detail Query and existing inspector. Collection rows remain lightweight and never seed detail. Hovering, following, or closing a preview must not trigger sample, dataset, file, project-directory, or instrument-directory reads. Opening a preview reads the one selected detail Query and any user-requested relationship detail; opening a dataset preview also reads its file list and thumbnails for the inspector's quick actions. Download links are still generated only on request.

The repeated resource identity cell is promoted into one shared domain component for global and project Data. It owns the semantic resource icon, canonical resource link, explicit Preview link, and supporting type text. Each collection retains its own table columns, supporting-text visibility, filters, pagination, and error behavior.

## Privacy review

The URL and browser-managed history add only the already accepted selected resource MFID and bounded MFID trail. The global host marker contains no project, resource snapshot, display name, grant, personal data, or credential. A copied URL transfers no authority and every detail read remains independently authorized by the API.

No new persistence, telemetry, third-party host, browser storage, cookie, credential handling, or retention mechanism is introduced. Existing identity-scoped Query replacement and trail ownership checks apply unchanged.

## Validation

- Verify collection geometry, scroll, filters, kind, cursors, and readable rows remain unchanged through preview navigation.
- Verify one selected detail read (plus the file list and thumbnails for a dataset), Query reuse, and no preview-driven collection reads.
- Verify relationship follow, Back in preview, browser Back and Forward, safe close, outside dismissal, focus restoration, malformed preview handling, and canonical full-page promotion.
- Verify global, project, and resource hosts reject each other's trusted trails.
- Verify compact and laptop layouts with automated accessibility and overflow checks without requiring a new visual baseline for implementation acceptance.

The [roadmap](../docs/roadmap.md#global-data-collection-inspection) owns implementation status and evidence.
