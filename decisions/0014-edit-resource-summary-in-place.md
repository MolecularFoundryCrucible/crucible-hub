# 0014: Edit Resource Summary in Place

Status: Accepted

Date: 2026-09-05

## Context

The controlled sample mutation proof used a dedicated edit route to isolate capability checks, validation, failure retention, cache updates, and unsaved-navigation protection. Once those boundaries were proven, navigating to another page for a small set of descriptive fields added interaction cost without adding meaningful safety. Dataset editing has the same bounded shape and belongs beside the values being changed.

Dedicated routes remain useful for long, resumable, multi-stage, or consequential workflows. Descriptive sample and dataset edits do not meet those conditions.

## Decision

Samples and datasets expose capability-gated editing directly in the Summary card on their canonical resource page. Exact `ResourceCapabilities.can_edit` guidance controls whether Hub presents Edit, while the API independently authorizes every mutation.

Edit switches only the Summary card into form mode. The resource title and surrounding detail remain stable until a successful server response updates Query data. Sample editing contains name, sample type, and description. Dataset editing contains name, measurement, data format, data type, and session. Empty optional text is sent as `null`. Visibility, scientific metadata, project and instrument context, relationships, access, ownership, lifecycle, timestamps, files, and deletion remain outside these forms.

Both forms use the same Summary card composition, pending action geometry, local failure area, and discard-confirmation behavior. Save and Cancel stay in a stable footer. Inputs are disabled while a save is pending. Failed saves retain the draft. Dirty forms block route navigation and browser unload, while Cancel uses the same explicit discard decision without changing the canonical URL.

Mutations remain server-confirmed. Each strict POST server function sends only changed fields to the corresponding API PATCH operation. Hub merges only the normalized response fields into the exact detail cache, refreshes the affected resource-family lists and search results in API mode, and updates existing in-memory fixture list entries during fixture development. Drafts remain in memory and do not enter URL state, persisted Query data, logs, or telemetry.

The unpublished dedicated sample edit route is removed. Dedicated routes remain the default for creation, uploads, project moves, ownership transfer, access management, deletion, and other multi-stage or consequential operations.

## Consequences

- Scientists edit the values in their existing context without a page transition.
- Sample and dataset descriptive forms share interaction mechanics while retaining resource-specific schemas and payloads.
- The canonical resource URL does not encode transient edit mode or drafts.
- Refreshing an unsaved form relies on native unload protection and does not resume the draft afterward.
- Future descriptive resource editors may reuse the interaction shell only when their scope and safety properties match.

## Alternatives considered

- Keep one dedicated edit route per resource type. This preserves a shareable edit URL but adds navigation for short edits and separates the form from the values it changes.
- Put edit mode in route search state. This makes edit mode linkable but creates URL and history behavior for transient state without making drafts resumable.
- Use a modal dialog. This isolates focus but covers useful resource context and is unnecessary for a bounded card-level edit.

## Privacy review

This decision adds no persistence, telemetry, third-party host, cookie, credential handling, or retention mechanism. Drafts and validation errors remain in component memory. API credentials stay behind the existing server boundary, and fixture browser tests do not call live services.

## Validation

- Verify true and false exact capability guidance for both resource types.
- Verify successful and failed sample and dataset mutations, strict excluded-field rejection, confirmed detail and list updates, and narrow API-mode invalidation.
- Verify the canonical URL remains unchanged while editing, saving, cancelling, and discarding.
- Verify dirty route navigation, browser unload protection, local Cancel confirmation, focus entry, pending input state, and stable action geometry.
- Verify compact layout, keyboard behavior, accessible labels, theme parity, and automated accessibility without requiring screenshots for implementation acceptance.
