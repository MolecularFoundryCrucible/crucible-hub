# Crucible Hub application review

Review date: 2026-09-06, America/Los_Angeles.

Scope: the current working tree based on commit `4881bf7`, including the substantial pre-existing uncommitted implementation and documentation changes. This is a review of the local application, not a production certification. No application fixes were made.

## Overall assessment

Crucible Hub has a strong foundation and a useful local research workspace, but it is not ready for production release. The architecture, resource identity model, local error recovery, and separation of management workflows are thoughtfully implemented. Production authentication and uploads remain explicit blockers. Several newer workflows also need more complete browser verification.

The chosen visual direction is appropriate for a scientific application. The neutral surfaces, Noto Sans typography, restrained resource colors, semantic tables, and persistent entity navigation support focused research work. Keep this direction. The main need is to improve its execution: compact tables are not readable enough, graph styling is broken, some important actions are too dependent on icons, and forms lack a consistent level of guidance and action presentation.

The app builds successfully, but its browser suite is currently red. Passing static validation does not establish that the current UI is ready.

## Review method and verification

Reviewed the product brief, architecture, roadmap, design system, evidence register, relevant source and test files, and rendered local fixture pages. Browser inspection covered Home, Data, dataset Overview and Graph, sample Access, project Overview and Settings, Search, and dataset creation. Captured desktop screens at 1440 x 1000 and compact dark screens at 320 x 844. Existing browser checks also exercise additional routes, widths, themes, keyboard interactions, error states, and accessibility.

| Check                                                          | Result                     | Interpretation                                                                                                                                                                                                                              |
| -------------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run validate`                                             | Passed                     | Formatting, lint, types, 404 tests across 53 test files, OpenAPI drift, server boundary, design policy, documentation links, secret scan, and production build passed.                                                                      |
| `HUB_DATA_SOURCE=fixture npm run test:browser -- --workers=4`  | 109 passed, 20 failed      | 19 screenshot baseline failures and one accessibility failure.                                                                                                                                                                              |
| Compact relationship-dialog accessibility recheck              | Failed 3 of 3 repetitions  | The tooltip contrast failure is reproducible in the current automated interaction.                                                                                                                                                          |
| Production build, runtime script, and production browser suite | Passed; 6 browser tests    | The first production invocation encountered the review server occupying port 4174. After stopping that server, the runtime script and all production browser tests passed. This port collision was review setup, not an application defect. |
| `npm run audit`                                                | 0 vulnerabilities reported | Registry result at review time; this is not a comprehensive security assessment.                                                                                                                                                            |
| Manual fixture browser review                                  | Defects reproduced         | Compact Data readability, graph theme failure, double discard confirmation, and enabled-looking Activity placeholder.                                                                                                                       |

No authenticated live APIs, external records, uploads, deployments, or sibling repositories were changed. Native desktop 200 percent browser zoom, a screen reader session, Firefox, Safari, real mobile hardware, production authentication, and large live workspaces were not verified. Existing layout-equivalent zoom tests are not a substitute for native zoom testing. A hydration attribute warning involving date inputs also appeared during the browser run; its cause and persistence were not isolated, so it is a follow-up rather than a confirmed functional defect.

## Prioritized findings

Priority 1 means fix before treating the affected workflow as ready. Priority 2 means a meaningful usability or implementation correction. Priority 3 means polish or a lower-risk improvement. Production blockers are listed separately from defects in implemented features.

### F1. Priority 1: the compact Data table is technically contained but practically unreadable

**Evidence:** At `/hub/data` with a 320-pixel viewport, resource names collapse to approximately one or two visible characters, project and owner values become short fragments, and dates visually compete with the full-page action. The page does not overflow horizontally, but users cannot identify the records reliably. The local review artifact was captured as `output/playwright/review-data-compact-dark.png`.

**Cause:** The [Data route](../src/routes/_app.data.tsx), around line 246, retains Name, Project, Owner, Updated, and the action column in a fixed-layout table at compact widths. The [column tokens](../src/styles.css), around line 43, reserve a fixed action width and divide the remainder between several columns. Hiding only the separate Type column is insufficient.

**Recommendation:** Introduce an equivalent compact list with the resource name as the primary line and project, type, owner, and date as secondary information, or give the table a useful minimum width with deliberate local scrolling. Preserve both inspection and full-page navigation. Check actual text visibility and action overlap at 320 and 390 pixels, not only `scrollWidth <= innerWidth`. Audit project and instrument data tables for the same pattern.

### F2. Priority 1: graph colors do not reach Cytoscape

**Evidence:** Opening a populated sample or dataset Graph tab produces repeated warnings such as `The style property background-color: oklch(1 0 0) is invalid`. Nodes render with gray fills and black borders/text in both themes, instead of the intended sample/dataset colors and theme-specific surfaces. The local review artifacts were captured as `output/playwright/review-graph-desktop.png` and `output/playwright/review-graph-dark.png`.

**Cause:** `graphStyles()` in the [graph page](../src/features/resource-graph/resource-graph-page.tsx), around line 291, passes raw CSS custom-property values to Cytoscape. The installed Cytoscape color parser accepts arrays, named colors, hex, RGB, and HSL, but does not parse these OKLCH strings. CSS custom-property lookup returns the original token syntax rather than a renderer-compatible color.

**Recommendation:** Keep the semantic tokens authoritative and resolve their colors into a format the graph renderer supports at the integration boundary. Verify both initial rendering and a theme change. Add a graph-specific visual check and detection of rejected style warnings. The current graph tests verify canvas presence and the HTML alternative, so this rendering defect passes those tests.

### F3. Priority 1: browser acceptance is failing, and the failures need classification

**Evidence:** The browser run failed 19 visual comparisons across Home, Projects, Data, Search, Instruments, instrument datasets, inspectors, and layout-equivalent zoom cases. Examples include 7,985 differing pixels for the wide project inspector and 12,186 for the wide resource inspector, against a 500-pixel allowance. Some failures also change image height. All six primitive design-system theme/width baselines passed.

**Interpretation:** This establishes that current product screens differ from their accepted baselines. It does not establish that all 19 differences are bad design. The worktree contains new Create controls, graph navigation, and layout changes that plausibly account for some differences. Each failure still requires review before acceptance.

**Recommendation:** Inspect expected, actual, and diff images; repair unintended changes; then update only intentionally accepted baselines. Do not increase the tolerance or bulk-accept the results. Record fresh evidence for the current tree before describing the affected slices as browser-verified. See the [browser configuration](../playwright.config.ts), [route scenarios](../tests/browser/route-scenarios.spec.ts), and [evidence register](phase-0-evidence.md).

### F4. Priority 2: a closing tooltip causes a reproducible accessibility failure

**Evidence:** `resource-relationships.spec.ts`, test “keeps the compact add dialog accessible and contained,” fails after opening Add relationship at 390 x 844. Axe reports serious text contrast failure on `[data-slot="tooltip-content"]` with `data-closed` and `data-ending-style`. Reported contrast was approximately 1.06 to 1.16, below the check's 4.5 requirement. Three isolated repeats failed as well.

**Interpretation:** The flagged element is a tooltip during its exit state. This is not evidence that the entire dialog palette has insufficient contrast. The interaction between tooltip dismissal, its animation, and the timing of the accessibility scan needs inspection.

**Recommendation:** Inspect the [tooltip primitive](../src/components/ui/tooltip.tsx) and relationship dialog behavior. Establish correct dismissal and visibility semantics and test both the stable dialog and its transition. Avoid suppressing contrast checks or simply adding an arbitrary delay to hide the symptom.

### F5. Priority 2: cancelling a creation draft asks for discard confirmation twice

**Reproduction:** Open `/hub/datasets/new`, type a name, click Cancel, and click Discard changes. The confirmation remains and the route does not change. Clicking Discard changes a second time finally navigates to Data.

**Cause:** In [discard protection](../src/features/forms/discard-changes.tsx), lines 34-40, the explicit cancel-confirmation branch calls `onDiscard()` while the form is still dirty. The dataset callback navigates immediately, so the route blocker intercepts that navigation and raises another confirmation. Other creation forms use the same callback pattern; their individual reproductions remain to be checked.

**Recommendation:** Make an approved discard and the resulting navigation one coherent operation using the existing router blocker. A single confirmation must complete cancellation. Add coverage for Cancel followed by Discard, separately from clicking a navigation link while dirty.

### F6. Priority 2: the Activity placeholder renders as an enabled control

**Evidence:** Activity has a normal pointer cursor and button presentation but does nothing. DOM inspection found neither `disabled` nor `aria-disabled` on the rendered button, despite the `disabled` prop in [AppShell](../src/components/crucible/app-shell.tsx), around line 111. Its “coming later” tooltip is hidden in the expanded desktop sidebar.

**Cause to investigate:** The [sidebar primitive](../src/components/ui/sidebar.tsx) composes the button through a tooltip trigger. The intended disabled semantics are not reaching the final DOM in this case.

**Recommendation:** Omit Activity until useful, or render a clearly unavailable item with visible explanatory text and correct semantics. Verify disabled prop forwarding through this composition. A dead control should not look like a working destination.

### F7. Priority 2: several form errors are announced but not associated with their inputs

**Evidence:** For example, `ProjectTextField` in the [project creation form](../src/features/project-creation/project-creation-form.tsx), around line 300, supplies `aria-invalid` but no `aria-describedby` or `aria-errormessage`; its `FieldError` has no associated ID. Similar patterns exist in instrument registration and dataset text fields. The [shared Field wrapper](../src/components/ui/field.tsx) is an ordinary grouped element and does not generate these relationships automatically.

**Impact:** An alert can announce a newly displayed error, but returning focus to the input does not reliably expose the specific correction as its accessible description. Help text also lacks consistent association. This is a source-confirmed semantic gap; a screen reader session was not performed.

**Recommendation:** Give help and error content stable IDs and associate them with their controls, using the established form primitives where appropriate. Preserve labels, invalid state, and error announcements, and verify the focus-and-correct workflow rather than only running an automated page scan.

### F8. Priority 2: newer consequential workflows have incomplete browser coverage

**Evidence:** Browser tests cover menu navigation to creation routes, lifecycle changes, and the presence/layout of ownership and project-assignment cards. They do not exercise complete project/sample/dataset creation submissions, dataset link recovery, operator changes, or ownership/project-move preview-confirm flows. The [evidence register](phase-0-evidence.md) correctly distinguishes static/unit coverage for several of these newer operations.

**Recommendation:** Prioritize behavioral browser coverage for successful submission, confirmed rejection, uncertain outcome, cancellation, lost capabilities, stale preview, and partial completion. For dataset creation, prove that retry only repeats missing links and clearly distinguishes “dataset created” from “links incomplete.” This would also cover the discard defect missed by current route-opening tests. Keep fixture coverage separate from accepted API-contract and production-session evidence.

## UI and design assessment

### What is working well

- The visual style is calm and appropriate for scientific work. Typography, restrained surfaces, border treatment, spacing, and light/dark roles generally feel like one application. The primitive visual and automated accessibility checks provide useful supporting evidence.
- Resource Overview has a sensible hierarchy: Summary and Identity first, then Files, Relationships, and Scientific metadata. Linked project and instrument context is visible. Stable entity headings and route-backed sections help preserve orientation.
- The inspector preserves the originating collection and provides explicit full-page navigation. Existing tests cover focus restoration, history, local recovery, and preservation of filters and scroll context.
- Project members, resource access, ownership, lifecycle, and scientific metadata have distinct workflows. This separation helps users understand what an operation changes.
- Search grouping, explicit filters, local retry messages, selectable identifiers, and per-file download states are useful foundations for research tasks.

### Improvements to the chosen style and interaction design

| Area                       | Assessment                                                                                                                                                                       | Suggested improvement                                                                                                                                                                                                                                                             |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Action language            | Creation has text submit buttons, General Settings uses an icon-only save action, and relationship management groups several unfamiliar icons.                                   | Use visible text for primary Save, Add relationship, and consequential request actions. Retain icons for well-understood secondary actions such as copy or close.                                                                                                                 |
| Destructive actions        | A trash icon beside the resource header launches a deletion-request workflow. Its meaning and review requirement are not apparent from the resting screen.                       | Prefer a labelled “Request deletion” action in an appropriate actions menu or explicit management area. Preserve the existing confirmation flow.                                                                                                                                  |
| Form length                | The desktop dataset creation screenshot is about 1,512 pixels tall; optional fields and chooser state each consume separate rows. The submit action is below the first viewport. | Put required identity/project fields first and group optional acquisition details behind clear disclosure. Show the selected resource and its change action compactly. Keep the action area reachable without obscuring focused fields.                                           |
| Terminology                | Copy includes “short API identifier” and “server-resolved identity,” which describe implementation rather than a researcher’s decision.                                          | Explain the user consequence: a short project identifier used in integrations, or a person’s confirmed name and username. Clarify what “Public” exposes at the point of choice.                                                                                                   |
| Graph usability            | A fixed 480-pixel canvas contains only two nodes in the fixture. On compact screens, fit-to-view makes their labels tiny while the readable table starts collapsed below it.     | Make the relationship list easier to reach or default to it on compact screens. Add an edge legend and usable zoom controls; verify fit behavior with long labels, dense graphs, resize, and different input devices. The renderer also warns about the custom wheel sensitivity. |
| Resource color consistency | Home and Search use semantic type colors; some detail relationship icons are neutral, and the graph currently falls back to gray.                                                | Establish one deliberate rule for when type color conveys meaning. Keep labels and icon shapes as redundant cues. Fix graph color parsing before palette adjustments.                                                                                                             |
| Role colors                | The Owner badge is salmon/red and visually strong in an otherwise restrained Access screen. This can suggest an error or danger.                                                 | Review whether role hierarchy can use quieter treatments, reserving the strongest warning/destructive colors for states requiring attention. This is a design judgment, not a measured contrast failure.                                                                          |
| Collection scanning        | Dense All data displays samples followed by datasets, with independent Next samples and Next datasets controls at the bottom of a long table.                                    | Make the two result groups and their pagination scope explicit. Keep pagination reachable. Add sorting or facets only where the API can apply them to the entire result set.                                                                                                      |
| Mobile creation            | The global Create button disappears below the small breakpoint. Contextual creation links remain on collection pages.                                                            | Consider an equivalent Create entry in the compact navigation if cross-workspace creation is a primary action; maintain a consistent discovery path.                                                                                                                              |
| Browser orientation        | Inspected pages all retain the browser title “Crucible Hub.”                                                                                                                     | Add useful route titles for Data, Search, and creation. Consider entity titles only with an explicit privacy decision about names in tab titles and browser history.                                                                                                              |
| Home continuation          | Home shows recently added records and accessible projects, rather than a full “resume my work” experience.                                                                       | Consider pins, saved views, or recent visits once their account isolation and retention policy is accepted. “Projects you can access” would also be more precise than “Your projects” if the list includes broadly shared projects.                                               |

No wholesale redesign or additional decorative treatment is needed. Resolve readability, action clarity, and incomplete behavior within the existing system before introducing more visual variation.

## Product status and missing features

The [roadmap](roadmap.md) is broadly candid about the distinction between local functionality and production exposure. “Implemented locally” should remain the status for the newer management and graph work until its behavioral and contract gates are complete.

| Capability                                     | Current status                                                                                                             | Next requirement and owner                                                                                                                                                                                                                         |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Production login, logout, and account sessions | Blocked; local API-key mode is explicitly rejected in production. Account display is not a usable account-management flow. | `crucible-api`: accepted login exchange. Hub and session infrastructure: opaque shared sessions, rotation, revocation, expiry, logout, identity replacement, and authenticated mutation protection.                                                |
| Deployment and operations                      | Local production runtime is verified; no established release/deployment process.                                           | Hub: release configuration, environment validation, rollback and operational checks, with session infrastructure settled before rollout.                                                                                                           |
| File upload and recovery                       | Not implemented; creation currently creates records without attaching files.                                               | `crucible-api` and storage configuration: accepted browser-safe upload lifecycle. Hub: staged upload UI, progress, cancellation, retry/resume, and partial-failure recovery. This is the largest missing researcher workflow after authentication. |
| Creation and management                        | Broad local implementation, with newer slices less tested.                                                                 | Hub: finish browser acceptance and user recovery flows. API: operation-specific contracts, conditional-write behavior, and reliable uncertain-outcome/idempotency support where needed.                                                            |
| Activity and audit history                     | Activity is a nonfunctional shell item.                                                                                    | API and Hub: authorized event source, useful resource/project timelines, and clear visibility and retention rules. Do not simulate activity from incomplete client observations.                                                                   |
| Join requests                                  | Intentionally deferred; invitations are not planned.                                                                       | API: efficient project-scoped identity/status/capability contract. Hub: submission, status, and review workflow after acceptance.                                                                                                                  |
| Scientific file understanding                  | File listing, metadata, and download exist; specialized viewers and richer Explorer workflows remain future work.          | Hub plus owning viewer/API repositories: prioritize representative scientific formats and measure parity before replacing existing tools.                                                                                                          |
| Graph exploration                              | One-hop local prototype with a textual alternative.                                                                        | Hub: fix rendering and complete usability evidence. API: typed nodes/edges, depth and truncation semantics, permission behavior, and bounded responses. Advanced graph expansion should follow those gates.                                        |
| Search at scale                                | Bounded multi-kind discovery exists. Richer filtering, global sorting, and workspace summaries depend on API support.      | API: efficient supported collection/search contracts. Hub: accurate limits, shareable filters, and clear pagination.                                                                                                                               |
| Saved views, pins, exports, bulk work          | Deferred high-scale features.                                                                                              | Prioritize with research users after core reliability. Use API-backed bulk actions and explicit privacy decisions for stored personal workspace state.                                                                                             |
| Administration                                 | Not required for the first user-facing release.                                                                            | Keep separate from normal researcher workflows; implement only against accepted capabilities and review contracts.                                                                                                                                 |

The external dependency details should continue to live in the [API handoff](crucible-api-handoff.md), rather than becoming Hub-side workarounds. Authentication and upload designs are still proposed decisions, not authorization to implement a guessed contract.

## Recommended work order

1. Repair compact Data readability, graph color integration, double discard confirmation, Activity semantics, and form error associations. Resolve the tooltip transition failure and review all failing screenshots.
2. Complete browser coverage for creation, operators, ownership, and project moves, including partial and uncertain outcomes. Add graph rendering and warning checks. Use a meaningful warning policy because the current [browser fixture](../tests/fixtures.ts) checks uncaught page errors but does not fail on the graph’s console warnings.
3. Run focused usability sessions with a researcher and project/instrument manager: find a known sample, inspect provenance, download a file, create a dataset, recover from an incomplete association, and explain the consequence of an access change. Include keyboard-only and screen reader use, native zoom, and compact layouts.
4. Close the production authentication/session gate with the owning API and infrastructure work. Establish deployment and rollback evidence before enabling real user access.
5. Deliver the complete create-and-upload workflow, then prioritize activity, saved views, richer discovery, and scientific previews using observed user needs.

## Evidence files and review impact

Screenshots from this review are ignored local artifacts under `output/playwright/`; they are not new accepted visual baselines and may be absent from a checkout. Their names were `review-home-desktop.png`, `review-detail-desktop.png`, `review-data-compact-dark.png`, `review-graph-dark.png`, `review-graph-compact-dark.png`, `review-create-desktop.png`, `review-access-dark.png`, and `review-settings-dark.png`. Keep the report's written reproductions when sharing it without those artifacts.

Changelog impact: none. This task adds a review report and local evidence only; existing changelog edits were preserved. Cross-repository consequence: no changes were made elsewhere. Authentication, upload, graph, and several mutation/scale requirements depend on `crucible-api` and the session/storage infrastructure as described above.
