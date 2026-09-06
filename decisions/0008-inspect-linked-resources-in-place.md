# 0008: Inspect Linked Resources in Place

Status: Accepted

Partially superseded by [decision 0009](0009-overlay-resource-inspection.md) for modality and desktop layout only.

Date: 2026-09-04

Implementation: Local read-only workflow implemented. Shared resource-detail reads now omit unused embedded datasets. [Decision 0010](0010-inspect-project-data-in-place.md) extends inspection to project Data; validation evidence is recorded in the roadmap.

## Context

Scientists need to explore a sample or dataset's immediate relationships without repeatedly leaving their working page. The API's `include_links` expansion supplies lightweight, permission-filtered parent, child, and associated references. Those references identify neighbours but are not full detail records or a complete pedigree.

Lens demonstrates grouped relationship navigation from one enriched resource read. Explorer demonstrates a desktop relationship panel. TellingTree's `frontend/src/components/tree/GraphTab.tsx` separates inspecting a person, opening their full profile, and recentering the graph. Hub adopts that distinction without copying mobile layouts, loading whole projects or trees, or introducing a dependency on these applications.

## Decision

Provide one right-side resource inspector alongside the existing canonical resource page. The first slice supports sample and dataset relationships only. Inspecting another relationship changes the same panel, not the underlying resource or a stack of overlays. Opening the full resource is a separate canonical navigation action. Graph endpoints, recentering, pedigree visualization, and relationship mutations remain deferred.

Use the owned shadcn Sheet with Base UI's native non-modal behavior on wide screens and modal behavior on compact screens. Follow the [design-system contract](../docs/design-system.md#resource-inspector) for interaction and focus. This extends decisions 0006 and 0007 without replacing them.

### Route state and history

The resource route owns an optional, validated `preview` MFID search parameter. The pathname identifies the main resource; the parameter identifies the inspected resource. Preview selection is not a new critical route dependency and must not refetch or suspend the unchanged main page.

Use TanStack Router's native search, `state`, `replace`, and `resetScroll` options, not raw History API calls, a second router, or route masking. Opening a preview from a closed panel pushes one entry. Subsequent inspection replaces that entry. A bounded trail in typed router history state supports the separate Back in preview control. Detailed transitions belong in [information architecture](../docs/information-architecture.md#resource-inspector-navigation).

History metadata contains only up to 20 previous preview MFIDs, the origin resource MFID, and opaque navigation ownership markers tied to the current runtime identity scope. It contains no resource snapshots or display names. Selecting the current target is a no-op; exceeding the trail limit drops the oldest step. The trail records exploration, not scientific provenance. Its absence or rejection must not prevent a valid preview URL from working.

### Data ownership

The inspector observes the same identity-scoped resource-detail Query as the full page. There is no inspector-specific copy of resource state. The small relationship reference may supply a provisional heading outside that cache, but must not seed or overwrite authoritative detail. Preview requests and failures remain local; stale results for a different target must never appear under the newly selected identity. Endpoint flags, request limits, and null handling belong in [API integration](../docs/api-integration.md#resource-inspector-reads).

## Privacy decision

The selected preview MFID becomes browser URL/history data, like a canonical resource path. Anyone receiving the URL must still be independently authorized by the API. Sharing a preview URL shares the origin and selected MFIDs, not the exploration trail, resource contents, or access rights.

The MFID-only trail uses browser navigation state, not localStorage, sessionStorage, IndexedDB, server persistence, or analytics. Browsers may retain history state for session restoration, so it must not be described as guaranteed memory-only storage. Hub accepts navigation metadata only when its shape, origin, and current runtime identity ownership match; discard it after a reload, logout, server/account/credential change, or incompatible restoration. Browser Back may revisit an old URL, but never restores another identity's cached representation or trusted trail. Closing cannot erase browser-managed history and must not claim to do so.

No new third-party hosts, tracking, cookies, credentials, or personal-data fields are introduced. Preview URLs and trails must not be added to operational telemetry; use existing route templates and correlation IDs. Resource contents remain under the existing in-memory Query and authorized hydration policy. These limits are prerequisites for implementation and production review, not permission to enable Query persistence.

## Consequences and alternatives

- One inspector can later serve graph-node selection without coupling the first slice to graph loading.
- Direct preview URLs work without a navigation trail; Back in preview is then unavailable until another target is inspected.
- Browser Back exits the in-page preview session; Back in preview retraces neighbours. This deliberate distinction avoids a browser history entry for every inspection.
- Full-page navigation alone loses the original working context. Stacked drawers obscure that context and complicate keyboard recovery.
- An entirely component-local preview is simpler but cannot be restored from a copied URL. A second cache or custom navigation framework adds ownership problems without a demonstrated need.
- Expanded links are unpaginated. Rendering a short group or filtering it locally does not reduce API response size. Larger-scale browsing requires a separately planned API-backed collection or graph workflow.

## Validation and implementation gate

The [roadmap](../docs/roadmap.md#resource-inspector-slice) owns the ordered implementation and acceptance checks. A native navigation/focus proof must cover direct entry, refresh, Back/Forward, close, full-page promotion, and responsive mode changes before the feature is considered complete. Accepted here means selected for implementation, not implemented or browser-verified.

## References

- [TanStack navigation options](https://tanstack.com/router/latest/docs/api/router/NavigateOptionsType)
- [TanStack destination and history state options](https://tanstack.com/router/latest/docs/api/router/ToOptionsType)
- [shadcn Sheet](https://ui.shadcn.com/docs/components/base/sheet)
- [Base UI Dialog modality and dismissal](https://base-ui.com/react/components/dialog)
- [API-owned OpenAPI artifact](../../crucible-api/openapi/crucible-api.json)
