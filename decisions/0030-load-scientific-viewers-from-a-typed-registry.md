# 0030: Load scientific viewers from a typed registry

Status: Accepted

Date: 2026-09-21

## Context

Crucible Graph Explorer contains useful scientific viewers, but its implementations mix Python parsing, server-rendered templates, browser code, and assumptions about local files. Hub needs to expose selected dataset views without inheriting another application runtime, making scientific libraries part of the Hub server, or coupling API responses to React component names. Viewers also need independent loading, failure containment, accessibility, and ownership because their formats and dependencies vary significantly.

## Decision

Hub will provide dataset viewers through a build-time TypeScript registry. Each registered viewer has a stable viewer ID, a lazy-loaded browser module, supported typed representation kinds and versions, a human-readable label, and an optional lightweight applicability predicate over API-advertised representations. A future canonical route at `/datasets/:datasetMfid/view/:viewerId` will own direct navigation and browser history while a dataset Viewer entry surface lists only API-advertised, readable options.

The API and ingestion systems own scientific parsing that requires Python, native libraries, large server-side reads, or durable derived artifacts. They expose versioned, typed representation descriptors and authorized data or artifact references. Descriptors identify scientific representation semantics rather than Hub component names. Hub owns the viewer shell, presentation, keyboard interaction, responsive behavior, and safe browser retrieval. Signed URLs and temporary read capabilities remain outside TanStack Query, browser storage, URLs, logs, and server-rendered state.

Browser-suitable formats may be parsed in a dedicated worker when the input and memory bounds are explicit. Viewer dependencies are pinned, bundled, and self-hosted. Hub does not load remote JavaScript, runtime plugins, module-federated components, or third-party viewer frames. The registry remains compile-time code so supported viewers pass the normal dependency, design, accessibility, and release checks.

Migration is viewer-specific. Graph Explorer remains the behavioral reference for a viewer until Hub reaches parity for that viewer. Reusable algorithms, schemas, and test fixtures may be extracted or ported when their license and runtime boundary permit it, but Graph Explorer UI components are not copied into Hub by default. A shared package is justified only after at least two maintained consumers need the same framework-independent implementation.

The first implementation should establish the registry, route shell, typed representation adapter, loading and error boundaries, and one browser-suitable viewer. Server-heavy viewers wait for API-owned derived representation contracts.

## Rejected alternatives

- Embedding Graph Explorer in an iframe or redirecting ordinary viewing into its runtime fragments navigation, authentication, styling, accessibility, and failure ownership.
- Loading remote viewer modules at runtime bypasses Hub's build, dependency, and security controls.
- Running Python scientific parsing in the Hub backend for frontend turns the presentation boundary into a second scientific processing service.
- Adding one permanent resource tab per viewer makes resource navigation grow with every scientific format and prevents direct stable viewer identity.
- A generic JSON-configured renderer cannot express the interaction and performance requirements of specialized scientific views without becoming an untyped plugin system.

## Consequences

- Viewer modules remain independently code-split and failures stay within the viewer route.
- The API needs a typed, versioned dataset representation discovery contract before Hub can select viewers reliably.
- Large or expensive conversions become ingestion or processing outputs with canonical provenance rather than transient Hub computation.
- Porting can proceed incrementally while Graph Explorer retains workflows that have not reached Hub parity.
- Viewer availability remains authorization-filtered and data-driven without giving the API control of Hub component implementation.

## Validation

- Verify direct navigation, unavailable and unsupported representations, lazy-module failures, browser history, compact layouts, keyboard behavior, and viewer-local recovery.
- Verify representation versions and content types before rendering and reject unsupported or oversized browser inputs locally.
- Verify temporary capabilities do not enter Query state, persistent storage, URLs, logs, hydration, or error reports.
- Compare migrated viewers with representative Graph Explorer fixtures for scientific meaning, units, axes, selection, and export behavior.
