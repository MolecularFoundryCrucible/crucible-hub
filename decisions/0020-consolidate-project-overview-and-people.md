# 0020: Consolidate Project Overview and People

Status: Accepted

Date: 2026-09-06

Updated: 2026-10-22

## Context

Project browsing is a primary Hub workflow. The initial workspace separated a small read-only member list from a sparse Overview, creating an extra navigation destination without giving either page enough independent purpose. Project administration includes descriptive editing, direct member addition, role changes, removal or self-leave, join-request review, and ownership transfer, but these operations have different authority and confirmation requirements. The API's direct membership contract seats an existing user immediately; it does not define an invitation workflow.

The API returns an expanded public-safe `lead` in `ProjectWithLead` and can return member profiles. The pinned contract and public staging OpenAPI checked on 2026-09-06 do not expose an `include_lead` parameter; the expanded lead is part of the response representation. Hub previously discarded it and displayed only the lead identifier.

## Decision

Project Overview combines identity, summary, expanded lead, and the readable member list. Instrument Overview uses the same layout and People card, listing the people and projects with a role on the instrument, so anyone working with it knows whom to ask; both pages place Summary and scientific metadata in the main column and Identity and People in the side column. Members are ordered by role hierarchy from owner through admin, editor, contributor, and viewer, then alphabetically by last name and first name with stable identity as the final tie-breaker. Every role keeps its text label on one of three neutral badge levels, so roles never read as statuses and hierarchy is not communicated by color: a filled badge for owner and admin, an outline for editor and contributor, and a muted outline for viewer, with a crown on the owner. Service accounts remain explicitly identified.

The visible project navigation becomes Data, Overview, and capability-gated Manage ([decision 0027](0027-edit-projects-and-instruments-from-overview.md)). The previous Members URL redirects with replacement semantics to Overview for compatibility.

Settings remains the project management destination. Descriptive fields continue to use their existing independent form. Direct member addition, role changes, removal, and self-leave compose as separate row or dialog operations in Settings rather than becoming fields in the descriptive form. Join requests and ownership transfer remain separate consequential workflows. No invitation workflow is planned.

At the time of this decision, Hub deferred exposing membership mutations from `can_manage_access` or `max_grant_role` until the API documented that these resource capabilities governed project membership, or provided operation-specific membership capabilities. The API contract is now confirmed. [Decision 0021](0021-adopt-direct-project-membership-contract.md) supersedes that deferral and defines the direct membership controls, capability guidance, full-list cache replacement, and related-query invalidation.

This decision supersedes decision 0017 only where that decision excluded project membership from the Settings destination. Membership operations remain separate from descriptive editing, resource ACLs, and ownership transfer.

## Consequences

- Project context and people can be understood without an extra section transition.
- Lead identity uses the public-safe expanded profile instead of presenting a raw identifier when available.
- Role hierarchy is consistent and reusable across read and future management surfaces.
- Settings can grow through independent capability-gated operations without becoming one broad form.
- At the time of this decision, member mutations were deferred pending the contract described above. Decision 0021 resolves that condition; implementation and production mutation exposure remain subject to the Hub session and same-origin mutation gates.

## Privacy review

The combined Overview uses only the public-safe lead and member representations already authorized by project detail. It introduces no browser persistence, telemetry, third-party hosts, credentials, or new retention.

## Validation

- Verify expanded lead presentation and identifier fallback.
- Verify role ordering, alphabetical tie-breaking, unknown-role fallback, service-account labeling, neutral badge levels, theme parity, and non-color role text.
- Verify unavailable versus empty membership states and compact horizontal containment.
- Verify direct add, role change, removal, and self-leave controls against `can_manage_access`, `max_grant_role`, `can_transfer`, current membership, and the API's returned full member list. See [decision 0021](0021-adopt-direct-project-membership-contract.md).
- Verify visible navigation removal and replacement redirect from the legacy Members URL.
- Verify Settings remains capability-gated and descriptive mutations remain independent.
