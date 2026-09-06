# 0004: Generate the Hub API Client from OpenAPI

Status: Accepted

Date: 2026-09-02

## Context

Crucible API V3 exposes a large contract covering resources, projects, instruments, users, access, files, ingestion, deletion, graphs, and account workflows. Lens currently maintains a substantial handwritten endpoint and serialization surface, which creates runtime compatibility risk.

`crucible-api` defines its generated OpenAPI artifact as the authoritative HTTP contract. Hub is a new TypeScript client and should not create another handwritten copy.

## Decision

Generate TypeScript types from a pinned deterministic `crucible-api` OpenAPI artifact and use a thin `openapi-fetch` client in server-only code.

- Generated output is reproducible and never hand-edited.
- The source artifact digest and API commit are recorded.
- The transport client remains behind a small server-only adapter.
- CI regenerates types and fails on drift.
- CI checks consumed paths and models for incompatible changes.
- Application helpers may normalize stable domain concepts but must not invent or silently compensate for API behavior.

## Consequences

- Path names, parameters, request bodies, responses, enums, and nullability are type-checked.
- API changes become visible during CI rather than only at runtime.
- Hub remains coupled to the artifact it deliberately pins, not to an unrecorded live server.
- OpenAPI generation quality directly affects client quality.
- Error semantics, partial-success workflows, cache behavior, and identifier policy still require tested application code.
- Server-only placement prevents generated authentication middleware from leaking credentials into the browser bundle.

## Alternatives considered

### Handwritten TypeScript models and request functions

Offers local control but duplicates the API contract and recreates the compatibility risk already identified in other clients.

### Generate a large opinionated SDK

Can provide higher-level methods but adds generated runtime code and may obscure Fetch behavior. `openapi-fetch` keeps runtime behavior small and visible.

### Call `nano-crucible` from the Hub server

Reuses Python client behavior but requires a second runtime or bridge and makes a browser application depend on a client intended for Python and CLI users.

## Required validation

- Generate types from the current committed API artifact.
- Verify cursor and offset pagination types.
- Verify request and response unions for public-safe and privileged representations.
- Verify binary or raw response handling needed by files and uploads.
- Define artifact update and compatibility review workflow.

## References

- API-owned `crucible-api/openapi/crucible-api.json` artifact
- [OpenAPI TypeScript and openapi-fetch](https://openapi-ts.dev/openapi-fetch/)
