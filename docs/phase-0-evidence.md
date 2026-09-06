# Crucible Hub Phase 0 Evidence

Status: Current evidence register

Date: 2026-09-06

## Purpose

This register records the current Phase 0 gate state. It replaces historical run-by-run logs; package order and future work belong in [roadmap](roadmap.md).

| Gate                                                            | Status           | Current evidence and remaining condition                                                                                                                                                                                          |
| --------------------------------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Server-only import protection                                   | Verified         | Native import guards and `npm run boundary:check` provide a negative browser-build proof.                                                                                                                                         |
| Fixture, browser, and production runtime harness                | Verified         | Unit, browser, accessibility, controlled transport, production runtime, and CI harnesses exist.                                                                                                                                   |
| Read workspace                                                  | Verified locally | Fixture/browser coverage covers collections, filters, search, inspection, navigation, downloads, recovery, and responsive accessibility. Production authentication remains separate.                                              |
| Controlled mutations                                            | Verified locally | Resource and Settings descriptive editing, scientific metadata editing, reviewed deletion requests, and direct project membership are covered with deterministic fixtures and browser tests. Production exposure remains blocked. |
| Direct project membership                                       | Verified locally | Add, role change, removal, and self-leave use API-shaped server functions and are fixture/browser verified. No invitation workflow is implemented or planned.                                                                     |
| Query hydration and account isolation                           | Partial          | SSR Query integration and identity-scoped keys are covered locally. Authenticated two-account replacement awaits the session boundary.                                                                                            |
| Same-origin and CSRF mutation enforcement                       | Partial          | Server-function boundary configuration exists; authenticated production evidence awaits shared sessions.                                                                                                                          |
| Shared server-side sessions and private-function authentication | Blocked          | Requires the API-owned login exchange, accepted session infrastructure, rotation, revocation, and multi-replica proof.                                                                                                            |
| Production container and `/hub` behavior                        | Partial          | Built runtime, health, deep-link, path-prefix, and shutdown checks exist. Authenticated callback and target-edge behavior remain open.                                                                                            |
| Direct resumable uploads                                        | Planned          | Requires the authorized direct-upload contract and non-production CORS, lifecycle, retry, resume, and cleanup proof.                                                                                                              |

## Current validation baseline

Run `npm run validate` for formatting, lint, strict types, unit tests, OpenAPI drift, server-boundary protection, token policy, documentation links, secret scanning, and production build. Run `npm run test:browser`, `npm run test:production`, and `npm run audit` when their package gate requires them.

All evidence above is fixture or controlled-test evidence unless explicitly marked otherwise. It does not authorize live API access, deployment, release, or production mutation exposure.
