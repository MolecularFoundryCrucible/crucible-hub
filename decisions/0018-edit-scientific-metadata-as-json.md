# 0018: Edit Scientific Metadata as Type-Preserving JSON

Status: Accepted

Date: 2026-09-05

## Context

Scientific metadata is an arbitrary JSON object that often contains nested objects, arrays, numbers, booleans, nulls, and strings. Flattening it into string key-value rows loses types and structure. The API provides a dedicated shallow-merge PATCH operation and a full-replacement POST operation, but it cannot remove a top-level key through PATCH and does not support conditional writes.

The existing resource page already presents metadata through a bounded recursive renderer. Editing should remain close to that context without allowing large metadata to dominate the normal read view.

## Decision

Sample and dataset detail pages expose capability-gated editing in the Scientific metadata card. Exact `ResourceCapabilities.can_edit` guidance controls whether Hub presents the icon-only Edit action, while the API independently authorizes every write. The canonical resource URL and surrounding page remain stable during editing.

The initial editor uses a bounded-height monospace textarea containing a pretty-printed root JSON object. It preserves JSON types and nested structure. Empty metadata is represented by `{}`. The browser and server boundary reject malformed JSON, non-object roots, non-finite numbers, blank or oversized keys, excessive nesting, excessive field counts, and serialized payloads above the named Hub safety limit. These safety limits are Hub-owned until the API publishes authoritative limits.

Hub compares the complete edited object with the loaded metadata. Additions and replacements use `PATCH /resources/{unique_id}/metadata` with only changed top-level keys. Nested changes replace their containing top-level value because the API merge is shallow. Any removed top-level key, including clearing all metadata, requires `POST /resources/{unique_id}/metadata?overwrite=true` with the complete edited object. Hub presents an explicit replacement confirmation because this operation can overwrite concurrent changes that occurred after the detail read.

Writes are server-confirmed and never optimistic. Hub merges only the returned `scientific_metadata` into the rich exact resource cache. API mode then invalidates exact detail to refresh modification time, the corresponding identity-scoped resource-family lists, and search results. Fixture mode updates only the exact in-memory detail record because fixture collections do not carry metadata. Failed saves retain the draft. Dirty Cancel, route navigation, and browser unload use the shared discard decision. Drafts remain component-local.

A future structured editor may be added as another view over the same typed object and write algorithm. It must preserve all JSON types and round-trip to the raw representation without loss. Hub does not copy Lens's flattened string-row editor.

## Consequences

- Scientists can correct arbitrary nested sample and dataset metadata without leaving resource context.
- Read mode retains the bounded recursive presentation, while edit mode provides a deliberately larger but bounded working area.
- Common additions and replacements minimize concurrent overwrite scope through PATCH.
- Deletion remains available but visibly uses an unconditional full replacement until the API supports conditional removal.
- Project and instrument metadata editing remain outside this first presentation slice even though the generic API can support them.

## Alternatives considered

- Flatten all values into string key-value rows. This is simpler for scalar metadata but destroys nested structure and JSON types.
- Use full replacement for every edit. This simplifies client logic but needlessly increases concurrent overwrite risk.
- Defer all deletion. This avoids replacement risk but prevents scientists from correcting obsolete fields.
- Build structured and raw modes together. This provides more guided input but expands the first slice before the type-preserving write and recovery boundary is proven.

## Privacy review

This decision adds no persistence, telemetry, third-party host, cookie, credential handling, or retention mechanism. Metadata drafts and validation errors remain in component memory. API credentials stay behind the existing server boundary, and fixture browser tests do not call live services.

## Validation

- Verify string, finite number, boolean, null, array, nested-object, empty-object, and deep-value round trips.
- Verify malformed JSON, non-object roots, unsafe values, blank and oversized keys, depth, field-count, and serialized-size limits at the browser and server boundaries.
- Verify semantic no-op detection, changed-top-level PATCH payloads, nested replacement, deletion confirmation, full overwrite, response identity validation, and exact-cache preservation.
- Verify true and false exact capability guidance, successful and failed saves, retained drafts, dirty Cancel and route navigation, browser unload protection, pending geometry, and no live API requests during fixture tests.
- Verify compact layout, bounded editor height, theme parity, keyboard operation, horizontal containment, and automated accessibility without requiring screenshots for implementation acceptance.
