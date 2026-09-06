# 0022: Manage resource relationships from canonical pages

Status: Accepted

Date: 2026-09-06

## Context

Samples and datasets need a bounded way to maintain parent-child links and cross-type associations without requiring a graph view or changing canonical resource identity. Relationship edits are consequential mutations: both resources must be authorized, the target must be valid, and the result must remain understandable after refresh or failure.

## Decision

Hub manages supported sample and dataset relationships from the canonical resource page. The relationship direction is explicit in the UI, with parent-child and cross-type association wording derived from the API representation. Adding a relationship uses a compact icon action and an accessible dialog with a bounded, type-specific search. Normal relationship rows reserve their trailing action for canonical navigation. A separate management mode replaces those navigation actions with unlink controls until the user finishes managing. Unlinking requires confirmation and removes only the relationship; neither resource is deleted.

Relationship controls do not appear in the resource inspector. The inspector remains a read-only contextual surface with canonical navigation. The exact `can_edit` capability from the source resource guides local presentation, but the API authorizes both resources and every mutation.

The server confirms the exact source and target representation after each add or unlink operation. Hub does not optimistically update relationship state. It replaces both exact detail cache entries and leaves lightweight collections unchanged because their representations do not contain relationships. Self-links and invalid or duplicate pairs are rejected before mutation where possible and remain recoverable local errors.

## Consequences

- Canonical resource pages provide one discoverable management location while relationship inspection remains available in context.
- The UI can support parent-child and cross-type relationships without inventing graph semantics or client-side authorization.
- Failed searches, validation, confirmation, and mutations retain the page and readable resource data.
- Cache coordination stays bounded to the exact source and target rather than refreshing unrelated collections.
- Local API-key development may exercise the workflow, but it does not clear the production authentication and Hub session gate.

## API prerequisites

Before production exposure, the API must define a relationship-specific capability, error semantics for authorization, missing resources, invalid or duplicate pairs, self-links, and cycles, target validation rules, and typed authoritative responses for add and unlink operations. The API must also document direction and whether the operation replaces or appends relationships. Until those details are published in the API-owned contract, Hub may display the decision and use local fixtures or development-only adapters, but must not expose an assumed production mutation.

## Validation

Implementation must cover accessible dialog behavior, bounded type search, explicit direction, confirmation, self and invalid pair rejection, local failure recovery, exact source and target cache replacement, no unrelated collection refresh, no resource deletion, and production-session gating.

## Alternatives considered

- Put relationship controls in the inspector: rejected because the inspector is contextual and must not become a mutation surface.
- Optimistically update both resources: rejected because relationship authority, validation, and concurrent state are API-owned.
- Use a graph editor: rejected because this slice needs a bounded canonical workflow and does not require graph navigation.
