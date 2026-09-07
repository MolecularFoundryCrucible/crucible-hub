# 0017: Use Dedicated Descriptive Settings for Projects and Instruments

Status: Superseded by [decision 0027](0027-edit-projects-and-instruments-from-overview.md)

Date: 2026-09-05

## Context

Project and instrument management includes both ordinary descriptive changes and consequential operations. The small descriptive field sets benefit from a stable, URL-addressable surface, while ownership, access, membership, lifecycle, relationship, and deletion operations require distinct authorization, confirmation, and recovery behavior.

Unlike sample and dataset Summary editing, project and instrument values are distributed across persistent workspace headers, overview cards, and future management sections. A dedicated Settings section keeps these forms predictable without placing unrelated controls into resource summaries.

## Decision

Projects and instruments expose a Settings section only when exact detail reports `can_edit: true`. A direct Settings URL without that guidance renders an unavailable state and no form controls. Capability guidance controls presentation, while the API independently authorizes every mutation.

Project Settings edits only title, organization, and project ID. Title is optional and clearing it sends `null`; organization and project ID remain required. Instrument Settings edits only name, type, description, location, manufacturer, model, other ID, and other ID source. Empty optional instrument values send `null`; name and location remain required.

Status is excluded because instrument lifecycle has dedicated API operations and project lifecycle semantics are not yet documented as a safe descriptive mutation. Ownership, project membership, resource access, service-account operators, scientific metadata, relationships, deletion, and creation remain separate workflows.

Both settings forms use the established TanStack Form, Query, and Router mutation pattern. Strict POST server functions accept only changed fields and call the API PATCH operation behind the server boundary. Saves are server-confirmed. Hub merges confirmed fields into the richer exact cache entry, preserves fields omitted by the response, refreshes related identity-scoped lists and search results in API mode, and updates matching in-memory fixture rows during fixture development. Failed saves retain the draft. Dirty Cancel and route navigation use the shared discard decision, and drafts remain component-local.

## Consequences

- Project and instrument workspace headers and local navigation remain mounted while Settings content changes.
- Ordinary descriptive management has stable canonical URLs without mixing consequential operations into the same form.
- A successful rename updates the mounted header from the exact Query cache without a route transition.
- Current Settings routes do not imply support for ownership, access, lifecycle, operator, member, or deletion changes.
- Future management operations may share layout and discard primitives but require their own API and interaction decisions.

## Alternatives considered

- Edit every value in place wherever it appears. This scatters management state across headers and cards and becomes less predictable as project and instrument operations grow.
- Put all management operations into one Settings form. This combines low-risk descriptive changes with operations that need different authorization and confirmation boundaries.
- Show disabled Settings navigation without exact capability guidance. This advertises an operation that may not exist for the current representation and weakens capability-aware presentation.

## Privacy review

This decision adds no persistence, telemetry, third-party host, cookie, credential handling, or retention mechanism. Drafts and validation errors remain in component memory. API credentials stay behind the existing server boundary, and fixture browser tests do not call live services.

## Validation

- Verify true and false exact capability guidance and direct-route unavailable behavior for both entity types.
- Verify strict changed-field inputs, excluded-field rejection, successful and failed API and fixture mutations, rich exact-cache preservation, list updates, and narrow API-mode invalidation.
- Verify failed drafts, dirty Cancel, route navigation, browser unload protection, pending controls, stable action geometry, keyboard behavior, and accessible names.
- Verify compact layout, theme parity, horizontal containment, and automated accessibility without requiring screenshots for implementation acceptance.
