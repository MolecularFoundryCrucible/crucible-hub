# 0025: Let the API assign creation MFIDs

Status: Accepted

Date: 2026-09-06

## Context

Canonical MFIDs are API-owned identities. Supplying them from Hub would duplicate identifier policy in the browser-facing application and widen the input accepted for resource creation. Sample and dataset names are not unique, and their create operations do not currently accept an idempotency key, so Hub cannot safely repeat a request whose outcome is uncertain. Dataset-to-sample association is a separate operation, so later relationship failure must not repeat dataset creation.

## Decision

Hub omits `unique_id` from project, sample, and dataset creation input. The API assigns the canonical MFID, and Hub navigates and caches only from the confirmed creation response.

A validation, authorization, conflict, or other confirmed rejection keeps the draft available for correction and resubmission. A cancellation, timeout, upstream failure, unexpected response, or transport failure can occur after the API has accepted the create. Hub retains the draft, warns the user to check Data before resubmitting, and does not automatically retry or present another create action while that route remains mounted. Safe retry requires an API-owned idempotency contract.

The confirmed resource response is the creation checkpoint. Dataset-to-sample links run only after this checkpoint, use the confirmed dataset MFID and selected sample MFIDs, and retry only incomplete pairs. Link failure keeps the created dataset available and never re-enables its create operation. The API link operation is duplicate-resistant for the same pair.

Draft field values remain in memory while the dedicated creation route is mounted and are protected from accidental navigation. Hub does not persist descriptive draft content in browser storage in this package. Any future persisted draft or checkpoint store requires a separate privacy and retention decision.

## Consequences

- The API remains the single authority for canonical resource identity.
- Hub sends no caller-selected or generated MFID in creation bodies.
- An uncertain sample or dataset creation cannot be safely retried until the API provides idempotency support.
- Dataset relationship recovery is visibly separate from structural creation.
- Reloading an unconfirmed form discards the in-memory draft; durable cross-reload draft recovery remains future work.
- File upload can later extend the same confirmed-resource checkpoint without changing structural creation semantics.

## Validation

- Verify project, sample, and dataset creation bodies omit `unique_id`.
- Verify canonical navigation uses only the MFID returned by the API.
- Verify confirmed rejections retain editable drafts and allow correction.
- Verify uncertain outcomes retain the draft, prevent automatic or accidental repeat creation, and direct the user to check Data.
- Verify a relationship failure cannot call the dataset create operation again.
- Verify no draft values or credentials enter browser storage, URLs, logs, analytics, or persisted Query caches.
