# 0027: Edit projects and instruments from Overview

Status: Accepted

Date: 2026-09-07

Supersedes [decision 0017](0017-use-dedicated-descriptive-settings.md) and supersedes [decision 0020](0020-consolidate-project-overview-and-people.md) only for the placement of project descriptive editing and visible Settings navigation.

## Context

Project and instrument Overview pages already present the descriptive values a person needs to review before changing them. A separate General Settings route repeats that context and makes a small descriptive update feel like a separate management workflow. The account profile and sample or dataset Summary use a clearer read-first pattern: stable values remain visible until an authorized person explicitly enters edit mode in the same card.

Membership, ownership, lifecycle, and operator changes have separate capabilities, mutation boundaries, and confirmation needs. Moving descriptive fields into Overview must not combine those operations into one form.

## Decision

Project details and instrument Summary expose an explicit edit action only when exact detail reports `can_edit: true`. Activating it replaces that read-only card with the existing validated form without changing route identity. Save returns to the updated read view. Cancel uses shared discard protection and returns to the read view only after a clean cancel or confirmed discard. Failed saves retain the inline draft.

The visible Settings destination becomes Manage and appears only when at least one independent management workflow is available. Project Manage contains Members and Ownership. Instrument Manage contains Lifecycle, Operators, and Ownership. Existing `/settings` index URLs redirect to the first available management workflow or back to Overview when only descriptive editing is available. Nested management URLs remain stable.

## Consequences

- People review descriptive values before choosing to edit them.
- Descriptive editing keeps the project or instrument route and surrounding context stable.
- Manage communicates that its child routes perform distinct administrative operations rather than ordinary field editing.
- Existing nested management links and external bookmarks remain valid.
- Descriptive forms retain their existing API, Query, validation, failure, and discard behavior.

## Validation

- Verify exact `can_edit` guidance controls the Overview edit action and the API still authorizes every mutation.
- Verify save, failed save, clean cancel, confirmed discard, and blocked navigation from both project and instrument Overview.
- Verify Manage visibility and direct `/settings` redirects for each capability combination.
- Verify Members, Ownership, Lifecycle, and Operators remain independent route-backed workflows.
