# 0029: Separate Dataset Processing

Status: Accepted

Date: 2026-09-10

## Context

Dataset Overview combines stable scientific identity and context with file downloads and recent ingestion activity. Ingestion is operational, file-scoped, repeatable, and history-bearing. Future dataset-scoped processing needs a predictable location but the current API endpoints do not return durable request identity or advertise which processes apply to a dataset.

## Decision

Datasets add a route-backed Processing section at `/datasets/:datasetMfid/processing` between Overview and Graph. Overview retains a compact file list and on-demand downloads. Processing follows the single-page hierarchy used by Access management, with Files and ingestion followed by Dataset processes rather than nested tabs.

Files and ingestion joins dataset files with their newest reported ingestion requests, exposes file MFIDs and bounded request history, and allows one or more eligible GCS files to request ingestion. The dialog gets ingestion classes from the API when opened, defaults to server-side detection, and calls the current file-scoped ingestion operation once per selected file. Confirmed requests survive partial failure and failed files remain available for retry.

Dataset processes remains an explicit empty section until the API exposes dataset-specific availability and durable request records with status, outputs, and errors. Hub does not copy the Graph Explorer's measurement-based hardcoded process mapping.

## Consequences

- Overview remains focused on dataset meaning and quick file access.
- Operational status and repeatable ingestion actions have enough space for file identity and history.
- Processing data loads only after entering its route and does not add collection or sample requests.
- The API remains authoritative for ingestion authorization and scientific execution.
- Existing dataset processing endpoints need a stronger request contract before Hub exposes them.

## Validation

- Verify direct and contextual Processing navigation, active-tab presentation, browser history, and the dataset keyboard shortcut.
- Verify file identity, latest status selection, history, local timestamps, download behavior, empty data, unknown statuses, and narrow layouts.
- Verify auto-detected and selected ingestors, multi-file partial success, retained failed selections, dialog dismissal, and API-authorized failures.
