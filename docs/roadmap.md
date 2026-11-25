# Roadmap

This document owns the order of remaining Hub work and the external dependencies it waits on. Product intent is in the [product brief](product-brief.md), routes in [information architecture](information-architecture.md), open API requests in the [Crucible API handoff](crucible-api-handoff.md), and shipped changes in the [CHANGELOG](../CHANGELOG.md).

## Current position

Hub 1.8.2 consumes the Crucible API 4.1.1 contract recorded in `contracts/crucible-api.lock.json`. It is released as a container image, signs people in through the API's standard OAuth routes, and keeps sessions in Postgres. Discovery, resource workspaces, management, account security, people and service-account administration, deletion and join-request review, uploads, ingestion, and post-processing are in place.

## Delivery rules

- The API authorizes every operation; Hub follows capabilities and never recreates authorization.
- Finish one recoverable workflow at a time and keep mutation state local.
- Record API-owned blockers in the [Crucible API handoff](crucible-api-handoff.md) instead of working around them in Hub.
- Work is complete when its tests and the documents that own its behavior are current.
- Keep the blocking browser suite bounded, representative, and screenshot-free; cover deterministic logic with fixture and unit tests.

## Ordered work

1. **Filters and counts.** Adopt facet value search, instrument facets, the creation-date histogram, relationship-aware project facets, repeatable facet values, and project and instrument counts as the API delivers them ([requests](crucible-api-handoff.md#collections-facets-and-counts)), replacing the current client-side limits.
2. **Administration.** Add a pending-work summary, an administrative audit view, and a processing-operations queue with ingestion retry and cancel once their contracts exist ([requests](crucible-api-handoff.md#administration)). Keep actions next to their subject (project, instrument, dataset) and use the broad view only to aggregate work the caller may already do.
3. **Pins and activity.** Add durable pins and an account activity feed on top of the [pins](crucible-api-handoff.md#account-pins) and [activity](crucible-api-handoff.md#account-activity) contracts.
4. **Safer concurrent editing.** Send preconditions on resource, metadata, access, membership, and deletion-review writes once the API accepts them, and offer field clearing only where its meaning is defined.
5. **Scientific viewers.** Load dataset viewers through the typed build-time registry in [decision 0030](../decisions/0030-load-scientific-viewers-from-a-typed-registry.md), starting with one browser-suitable viewer before server-heavy formats. Add no new runtime handoffs to Graph Explorer.
6. **Saved views, bulk operations, and exports**, each only with an API-backed contract and a privacy and operational review.
7. **Session security evidence.** Close the open validation items of [decision 0002](../decisions/0002-server-side-session-boundary.md#required-validation): a short threat model in [authentication](authentication.md) mapping each threat to its defense and code, and a browser test proving account and cache isolation between two concurrent users.

## External dependencies

| Dependency                | Needed outcome                                                                                                              | Blocks                                     |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Collection contracts      | Facet search, instrument facets, date histogram, relationship project facets, repeatable values, counts, unified collection | Item 1 and a Global Data "All" mode        |
| Administration contracts  | Navigation capabilities, pending-work summary, audit log, typed processing operations                                       | Item 2                                     |
| Account pins and activity | Durable pins and a permission-filtered event feed                                                                           | Item 3                                     |
| Mutation safety           | Preconditions, clear-field semantics, creation idempotency, documented error outcomes                                       | Item 4 and safe retry of uncertain creates |
| Correlation               | API logs a caller-supplied request identifier                                                                               | End-to-end request tracing                 |

Details for each are in the [Crucible API handoff](crucible-api-handoff.md).

## Completion gates

- Every new route or mutation has usable loading, empty, failure, authorization, and narrow-layout states.
- Tests cover request scope, cache isolation, cancellation, keyboard behavior, and recovery for the work.
- Credentials, signed links, and secrets never reach browser-visible data or telemetry.
- Gaps that depend on the API are hidden or labelled, never simulated with unbounded client work.
