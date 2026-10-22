# 0023: Manage Instrument Lifecycle Separately

Status: Accepted

Date: 2026-09-06

Updated: 2026-10-22

## Context

Instrument status affects whether an instrument is available for future acquisition work. The API exposes a dedicated `POST /instruments/{instrument_mfid}/status` operation and a `can_change_status` capability, while descriptive fields use the ordinary instrument PATCH operation. Decommissioning retires an instrument without deleting its existing identity or datasets.

## Decision

Hub exposes Lifecycle as its own card on the instrument Manage page ([decision 0027](0027-edit-projects-and-instruments-from-overview.md)), separate from descriptive fields, which are edited on Overview. Lifecycle is visible only when exact instrument detail reports `can_change_status: true`, while the API independently authorizes every mutation.

Hub offers the API-defined `active`, `maintenance`, and `decommissioned` states. Changing to maintenance or active is applied directly. Changing to decommissioned requires explicit confirmation that the instrument will be retired from future use while its existing datasets and details remain available.

The instrument directory exposes the same three states as URL-backed views and sends the selected status to the API before pagination. Active remains the default. This keeps maintenance and decommissioned instruments discoverable without mixing status-filtered pages in one client-side collection.

Every mutation uses the dedicated status operation and applies only the status and modification time confirmed by the authoritative response. There is no optimistic lifecycle state. Failures remain local and preserve the selected status for retry. Instrument lists and search results are invalidated after an API mutation because the default instrument collection includes only active instruments.

An unrecognized current status remains visible but is not presented as an invented Hub state. The user may select one of the API-defined statuses when permitted. The OpenAPI mismatch between the free-form endpoint parameter and response field and the existing `InstrumentStatus` enum remains an API-owned contract issue.

## Consequences

- Instrument managers can place an instrument into maintenance, return it to active service, or decommission it without mixing lifecycle into descriptive editing.
- Maintenance and decommissioned instruments remain discoverable through server-filtered directory views.
- Decommissioning never deletes the instrument or its datasets.
- Capability guidance controls presentation but does not replace API authorization.
- Service-account operators, ownership transfer, creation, and dataset assignment remain separate workflows.

## Privacy review

Lifecycle management adds no browser persistence, telemetry, third-party recipient, credential exposure, or new personal-data representation.

## Validation

- Verify that only the three API-defined status values pass the Hub server-function boundary.
- Verify that the dedicated status endpoint receives the selected value and that the confirmed response updates exact detail.
- Verify decommission confirmation, local failure recovery, capability-gated navigation, and collection invalidation.
