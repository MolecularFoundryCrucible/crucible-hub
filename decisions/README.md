# Architecture Decisions

This directory records durable Crucible Hub architecture choices. Each record captures one decision, its context, consequences, validation needs, and alternatives.

Statuses:

- `Proposed`: preferred direction that still requires approval or external validation
- `Accepted`: selected direction for implementation
- `Superseded`: replaced by a later decision that links back to the original
- `Rejected`: considered and deliberately not selected

A decision record does not override a contract owned by another Crucible repository. If a Hub decision requires an API or ecosystem change, the authoritative repository must record and implement that change separately.

## Index

| Decision                                                     | Status   | Subject                                                                           |
| ------------------------------------------------------------ | -------- | --------------------------------------------------------------------------------- |
| [0001](0001-integrated-tanstack-stack.md)                    | Accepted | Integrated TanStack application stack                                             |
| [0002](0002-server-side-session-boundary.md)                 | Proposed | Server-side Hub session and API authentication boundary                           |
| [0003](0003-owned-design-system.md)                          | Accepted | Owned shadcn/ui design system with semantic tokens                                |
| [0004](0004-openapi-generated-client.md)                     | Accepted | OpenAPI-generated TypeScript client                                               |
| [0005](0005-direct-object-storage-uploads.md)                | Proposed | Direct browser-to-object-storage upload flow                                      |
| [0006](0006-use-base-ui-primitives.md)                       | Accepted | Base UI primitives for shadcn/ui                                                  |
| [0007](0007-coordinate-route-and-query-loading.md)           | Accepted | Route entry and in-page Query loading ownership                                   |
| [0008](0008-inspect-linked-resources-in-place.md)            | Accepted | In-place resource inspection with separate full-page navigation                   |
| [0009](0009-overlay-resource-inspection.md)                  | Accepted | Overlay-only inspection and native outside dismissal; partially supersedes 0008   |
| [0010](0010-inspect-project-data-in-place.md)                | Accepted | Shared resource inspection from project Data with host-scoped navigation history  |
| [0011](0011-generate-file-downloads-on-demand.md)            | Accepted | On-demand single-file download capability generation                              |
| [0012](0012-inspect-global-data-in-place.md)                 | Accepted | Shared resource inspection from global Data with isolated host navigation history |
| [0013](0013-use-resource-identity-for-collection-preview.md) | Accepted | Resource identity preview with a dedicated canonical full-page action             |
| [0014](0014-edit-resource-summary-in-place.md)               | Accepted | Capability-gated in-place sample and dataset Summary editing                      |
| [0015](0015-edit-resource-timestamps-in-local-time.md)       | Accepted | Local-time resource timestamp editing with UTC API storage                        |
| [0016](0016-use-type-specific-resource-paths.md)             | Accepted | Typed canonical Hub paths for sample and dataset detail                           |
| [0017](0017-use-dedicated-descriptive-settings.md)           | Accepted | Dedicated capability-gated project and instrument descriptive Settings            |
| [0018](0018-edit-scientific-metadata-as-json.md)             | Accepted | Type-preserving JSON metadata editing with merge and confirmed replacement writes |
| [0019](0019-request-resource-deletion-through-review.md)     | Accepted | Reviewed sample and dataset deletion requests without direct permanent deletion   |
| [0020](0020-consolidate-project-overview-and-people.md)      | Accepted | Combined project Overview and people                                              |
| [0021](0021-adopt-direct-project-membership-contract.md)     | Accepted | Direct project membership contract and cache coordination                         |
| [0022](0022-manage-resource-relationships.md)                | Accepted | Canonical-page relationship management with bounded, confirmed mutations          |
