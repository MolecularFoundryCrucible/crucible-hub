# 0015: Edit Resource Timestamps in Local Time

Status: Accepted

Date: 2026-09-05

## Context

Sample and dataset timestamps describe the scientific event associated with a resource rather than its API creation or modification. Both API update schemas accept `timestamp`, but decision 0014 initially excluded it from the bounded Summary editor.

Scientists reason about entered dates and times in their local timezone. The API stores timestamp strings in UTC, so treating a local picker value as UTC would silently shift the scientific event time.

## Decision

Both sample and dataset Summary cards always present Timestamp. A recognized ISO timestamp displays in the browser's local timezone and includes date and time. An absent value displays as `-`. A nonstandard timestamp string is displayed unchanged rather than being guessed, reformatted, or discarded.

Timestamp joins the existing capability-gated in-place Summary editor. Use the native `datetime-local` control with seconds precision. Its wall-time value is interpreted in the browser's local timezone and converted to an ISO UTC string before the validated server-function request. Clearing the control sends `null`. Invalid values remain local field errors and never reach the mutation boundary. A nonstandard original value leaves the picker empty, remains visible as existing context, and is preserved during unrelated edits unless the scientist enters a replacement.

The server function accepts only a valid ISO timestamp string, `null`, or omission alongside the resource type's existing descriptive fields. The API response remains authoritative, and confirmed cache updates use the returned UTC value. Creation and modification times remain read-only identity fields.

This decision supersedes only the timestamp exclusion in decision 0014. All other scope and safety boundaries in decision 0014 remain accepted.

## Consequences

- Scientists see and enter timestamp values in their own local timezone.
- The API continues to receive and store unambiguous UTC values.
- Existing nonstandard strings remain readable and survive unrelated edits without an unreliable date-parser interpretation.
- Timestamp edits share the existing draft retention, unsaved-navigation protection, strict payload, error, and cache behavior.
- Browser timezone changes can change the displayed wall time without changing the stored instant.

## Alternatives considered

- Show and edit UTC directly. This matches storage but makes ordinary scientific data entry unnecessarily error-prone.
- Add a custom calendar and time-zone control. This adds interaction and maintenance cost without a current requirement to select a timezone other than the browser's local timezone.
- Keep timestamp read-only. The API explicitly supports the bounded update, and the field belongs with the other descriptive scientific context.

## Privacy review

This change adds no persistence, telemetry, third-party host, credential handling, or retention mechanism. Local timezone conversion occurs in browser memory, and only the resulting UTC timestamp enters the existing server-function mutation boundary.

## Validation

- Verify local picker values convert to the expected ISO UTC instant.
- Verify API UTC values populate the picker as the equivalent local wall time.
- Verify nonstandard strings display unchanged and remain untouched during unrelated edits.
- Verify clearing sends `null`, unchanged values are omitted, and invalid values do not submit.
- Verify successful and failed timestamp mutations preserve the existing cache, draft, pending, and navigation behavior.
- Verify both static Summary cards show date and time in the browser's local timezone.
