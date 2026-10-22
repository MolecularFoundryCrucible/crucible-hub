# 0005: Upload File Bytes Directly to Object Storage

Status: Accepted

Date: 2026-09-02

Updated: 2026-10-22

## Context

Scientific datasets may contain large files. Proxying those bytes through the Hub Node process would add bandwidth, memory pressure, timeout risk, and an unnecessary failure boundary.

Crucible API now exposes a signed multipart upload family (`POST /datasets/{dataset_mfid}/upload/multipart/initiate`, per-part signing, session status, completion, and abort), implemented in API PR #288 (commit `9549802`, merged to staging on 2026-10-09) and redesigned in PR #305 (merged to staging as `a831c2e`) to run initiation, completion, and abort inline without a background worker: initiation returns an uploading session immediately, completion joins and CRC32C-verifies parts within the request and returns the file record, and abort returns 204. The legacy resumable family remains in the contract and stays unused.

The multipart contract fixes the client rules: the API chooses the part size for each session (`part_size`, with 64 MiB parts except the final part as the fallback when it does not), a 500 GiB maximum, 1-64 parts per signing request, a canonical base64 CRC32C per part frozen at signing, lowercase SHA-256 and canonical base64 CRC32C of the whole object at completion, publication only after server-side CRC32C verification, at most 8 concurrent part transfers (raised from 4 on the API owner's recommendation), `Retry-After` and 15-minute URL expirations, `Cache-Control: no-store` responses, and relative filenames without empty or dot segments, backslashes, or control characters.

## Decision

Use a coordinated direct-upload flow through the signed multipart family:

1. The browser sends file metadata to an authenticated Hub server function.
2. Hub calls the API to initiate an upload session using the signed-in user's credential.
3. Hub returns only the temporary, scoped capability the browser needs, such as signed part URLs.
4. The browser transfers part bytes directly to object storage, at most 8 parts concurrently, forwarding every signed header except `Content-Length`.
5. Hub calls API completion once all parts transfer; the API verifies CRC32C before publication.
6. The workflow records non-secret checkpoints and retries only incomplete stages.

The general API key remains server-side. Signed URLs are bearer credentials: they stay in orchestrator memory for the life of a part transfer and never enter Query or Mutation state, hydration, route state, component state, application storage, logs, telemetry, or error reports. Upload sessions remain in browser memory, are excluded from persistence, and are reacquired after expiry. Hub integrates behind a default-off rollout flag and wires the live API only after the API team enables the endpoints.

## Privacy review

Activation introduces the API-authorized object-storage host as a direct browser recipient and transfers short-lived per-part capabilities to the browser. This occurs only after an explicit action for named files. Part checksums are computed locally before signing; no file content passes through Hub. Hub introduces no persistent application storage, background transfer, cross-file aggregation, or telemetry field. Tests use deterministic non-production URLs, intercept part transfers before external access, and do not record capability values in snapshots or traces.

## Consequences

- Hub avoids becoming the data-transfer bottleneck.
- Upload progress and cancellation reflect the actual browser-to-storage transfer.
- Object-storage CORS for browser PUT origins and request headers becomes a production dependency.
- Multi-stage partial success must be represented explicitly.
- The browser needs a robust checkpoint state machine and per-part retry with freshly signed URLs.
- A resource may exist before all files, metadata, relationships, ingestion requests, or thumbnails succeed.
- Retry must never duplicate the created resource or repeat completed stages.
- Incremental hashing of large files requires streaming checksum tooling in the browser.

## Validation

- Confirm the multipart contracts against the pinned OpenAPI and implementation once the artifact is published.
- Verify allowed browser origins and required request headers in object-storage CORS.
- Test small, large, interrupted, expired, cancelled, and resumed uploads against staging after the gate opens.
- Confirm completion idempotency, concurrent completion semantics, and reserved filename behavior.
- Verify that signed part URLs cannot write outside the intended object and cannot be reused after completion or expiry.

## Alternatives considered

### Proxy uploads through Hub

Simplifies the browser's storage interaction but creates avoidable resource use, timeout limits, and scaling risk in the Hub service.

### Upload directly to Crucible API as a single request

Would require API support for streaming large bodies and would still make the API a byte-transfer proxy.

### Use the legacy resumable upload family

Does not issue per-part signed capabilities and predates the CRC32C publication gate.

### Defer all uploads to Nano or instrument-specific tools

Avoids web complexity but fails the core self-service portal goal.

## Ownership impact

Hub owns browser orchestration and user-visible recovery. `crucible-api` owns upload authorization, session lifecycle, file registration, CRC32C verification, and completion semantics. Object-storage configuration owns CORS and temporary capability enforcement.
