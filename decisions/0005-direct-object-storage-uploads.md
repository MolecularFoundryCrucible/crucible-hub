# 0005: Upload File Bytes Directly to Object Storage

Status: Proposed

Date: 2026-09-02

## Context

Scientific datasets may contain large files. Proxying those bytes through the Hub Node process would add bandwidth, memory pressure, timeout risk, and an unnecessary failure boundary.

Crucible API V3 exposes upload initiation and completion operations, including multipart initiation. The exact supported browser behavior and object-storage CORS policy require validation.

## Proposed decision

Use a coordinated direct-upload flow:

1. The browser sends file metadata to an authenticated Hub server function.
2. Hub calls the API to initiate an upload using the signed-in user's credential.
3. Hub returns only the temporary, scoped upload capability needed by the browser.
4. The browser transfers file bytes directly to object storage.
5. Hub calls API completion, file registration, ingestion, and optional thumbnail operations.
6. The workflow records non-secret checkpoints and retries only incomplete stages.

The general API key remains server-side. Temporary upload sessions remain in browser memory, are excluded from Query persistence and telemetry, and are reacquired after expiry.

## Consequences

- Hub avoids becoming the data-transfer bottleneck.
- Upload progress and cancellation reflect the actual browser-to-storage transfer.
- Object-storage CORS and resumable-upload behavior become production dependencies.
- Multi-stage partial success must be represented explicitly.
- The browser needs a robust checkpoint state machine.
- A resource may exist before all files, metadata, relationships, ingestion requests, or thumbnails succeed.
- Retry must never duplicate the created resource or repeat completed stages.

## Alternatives considered

### Proxy uploads through Hub

Simplifies the browser's storage interaction but creates avoidable resource use, timeout limits, and scaling risk in the Hub service.

### Upload directly to Crucible API as a single request

Would require API support for streaming large bodies and would still make the API a byte-transfer proxy.

### Defer all uploads to Nano or instrument-specific tools

Avoids web complexity but fails the core self-service portal goal.

## Required validation

- Confirm API initiation and completion contracts against the current OpenAPI and implementation.
- Verify allowed browser origins and required request headers in object-storage CORS.
- Test small, large, interrupted, expired, cancelled, and resumed uploads.
- Define multipart thresholds and maximum supported file size.
- Confirm checksum and completion semantics.
- Define safe checkpoint persistence and cleanup.
- Verify that upload capabilities cannot write outside the intended object and cannot be reused after completion or expiry.

## Ownership impact

Hub owns browser orchestration and user-visible recovery. `crucible-api` owns upload authorization, session lifecycle, file registration, and completion semantics. Object-storage configuration owns CORS and temporary capability enforcement.
