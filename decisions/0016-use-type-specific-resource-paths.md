# 0016: Use Type-Specific Resource Paths

Status: Accepted

Date: 2026-09-05

## Context

The first resource detail implementation used `/resources/$resourceMfid` for both samples and datasets. The shared screen and generic API detail representation remain useful, but the pathname hides the resource type from people, browser history, copied links, and future type-specific navigation.

## Decision

The canonical Hub paths are `/samples/$sampleMfid` and `/datasets/$datasetMfid`. Both routes render the same owned resource-detail feature and continue to use the generic identity-scoped detail Query keyed by MFID. Preview state stays on the typed origin pathname.

`/resources/$resourceMfid` remains a compatibility resolver. It performs the existing bounded detail read and redirects samples, datasets, projects, and instruments to their canonical Hub paths while preserving applicable resource preview state. A missing or unsupported resource remains not found. This compatibility path does not become a second detail presentation or cache.

This is a Hub navigation decision only. It does not change the API's generic `GET /resources/{resource_id}` endpoint, generated types, or stable MFID identity.

## Consequences

- Copied URLs state whether the primary page is a sample or dataset.
- Shared rendering, Query ownership, files, editing, and inspection behavior do not fork by route.
- Existing generic Hub links continue to resolve through one server-side redirect.
- Known resource links should target the typed path directly and avoid the compatibility read and redirect.

## Alternatives considered

- Keep the generic route canonical. This is technically smaller but gives less useful URLs and makes future type-specific sections harder to express.
- Duplicate sample and dataset detail pages. This exposes the type but creates avoidable presentation and behavior drift.

## Privacy review

The typed path reveals only the resource category already present in the authorized page and link. It adds no storage, telemetry, third-party host, credential handling, or additional API request for canonical links.

## Validation

- Verify known sample and dataset links use typed canonical paths.
- Verify the shared page, inspector, editing, files, search state, and browser history behave on both typed paths.
- Verify generic resource paths redirect to the correct canonical entity path.
- Verify unknown resource identifiers remain not found.
