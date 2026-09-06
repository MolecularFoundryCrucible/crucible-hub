# Crucible Hub Design System

Status: Phase 0 baseline

Date: 2026-09-02

## Scope and principles

This document owns Hub tokens, themes, component policy, responsive behavior, accessibility, and visual validation. [`product-brief.md`](product-brief.md) owns product intent, [`architecture.md`](architecture.md) owns runtime boundaries, and [decision 0003](../decisions/0003-owned-design-system.md) owns the decision to use an owned system.

Hub is a desktop-first scientific workspace that shares Lens's semantic hierarchy and state discipline, not its phone dimensions, Compose structure, navigation, or Material defaults. Use semantic meaning before appearance, calm dense rows and tables, explicit accessible states, native HTML before managed primitives, usable full MFIDs, and one behavior contract across light and dark themes. Accessibility is a release property.

## Ownership and tokens

| Layer                                | Owner                        | Primitive values           |
| ------------------------------------ | ---------------------------- | -------------------------- |
| Primitive scales and semantic themes | `src/styles.css`             | Allowed only here          |
| Controlled shadcn primitives         | `src/components/ui`          | Shared tokens only         |
| Crucible domain components           | `src/components/crucible`    | Semantic tokens only       |
| Feature screens and routes           | `src/features`, `src/routes` | No primitive visual values |

Generated primitives enter `components/ui`, are reviewed, and become Hub-owned source. Feature code must not introduce colors, arbitrary utility values, shadows, type sizes, spacing, radii, breakpoints, z-index values, or motion durations. A missing role is a design-system change, not a local exception.

Primitive scales use a 4 px base and named spacing roles, a system sans stack plus system monospace for MFIDs, shared radius and elevation roles, named layers, and named responsive breakpoints. Semantic utilities own each typography role completely: feature code does not recreate roles with primitive Tailwind size, weight, line-height, or tracking utilities. Use tabular numerals for changing data, selectable monospace MFIDs, and no interface text below 12 px.

| Role                                      | Size / line height / weight | Use                        |
| ----------------------------------------- | --------------------------- | -------------------------- |
| `title-page`                              | 28 / 36 px / 600            | Route title                |
| `title-entity`                            | 24 / 32 px / 600            | Entity title               |
| `title-section`                           | 18 / 28 px / 600            | Section, dialog, group     |
| `body-prominent`                          | 16 / 24 px / 400            | Spacious body and inputs   |
| `body`, `label`                           | 14 / 20 px / 400 or 600     | Rows, paragraphs, controls |
| `supporting`, `label-compact`, `overline` | 12 / 16 px                  | Secondary content          |
| `metric`                                  | 24 / 32 px / 600            | Bounded summary            |

Use 44 px minimum primary touch controls. Dense pointer-oriented rows may be 36 px only when each target is at least 24 by 24 px, separated, and keyboard reachable. Semantic layout roles include page gutter, content and reading widths, section gaps, dense pill roles, and a 320 px initially resizable metadata editor. Use restrained 4, 8, 12, and 16 px radius roles only after fixture calibration. Resting elevation is `level-0` flat, `level-1` sticky or raised, `level-2` menu or popover, and `level-3` modal. Prefer surfaces and borders to decorative shadow.

Use quick, standard, and deliberate motion roles with initial 120, 180, and 240 ms targets. No continuous decoration. Reduced motion removes non-essential transforms, parallax, auto-scroll, and continuous effects. Shell breakpoints are compact below 48 rem, medium at 48 rem, wide at 64 rem, and expanded at 80 rem; components prefer container queries. Named layers cover base, sticky, navigation, popover, modal, notification, and emergency messages.

Themes use calibrated OKLCH values and foreground/background pairs for background, surface, card, popover, primary, secondary, muted, accent, destructive, success, warning, info, border, input, ring, selection, sidebar, and data visualization. Resource pairs cover sample, dataset, project, instrument, person, file, and service account. State, type, permission, and lifecycle always also use text, icon, shape, position, or pattern. Do not derive hierarchy with arbitrary foreground opacity.

Light, dark, and system preferences share these roles. Resolve theme before first paint, set `color-scheme`, react to system changes only in system mode, and persist only the preference, never derived colors. Any browser preference must be account-neutral and safely cleared or recomputed on identity change. Validate every semantic pair in both modes.

## Primitives and components

[Decision 0006](../decisions/0006-use-base-ui-primitives.md) selects Base UI. Pin it in `components.json`, use the official shadcn CLI and registry, inspect current documentation and project context, preview changes, and never overwrite Hub modifications without review. Use composition and existing variants first. Community registry components require provenance, dependency, license, source, accessibility, and theme review. Do not switch primitive base or preset as a feature side effect.

Install primitives only when needed and treat `src/components/ui` as the current inventory. Do not document a planned component as installed. Keep layout composition at call sites and semantic visual variants in shared components.

Lists use flat full-width rows or semantic tables. Cards are reserved for contained groups, summaries, empty states, and bounded metrics. Metadata uses the shared renderer: at most six top-level fields before disclosure, native closed disclosures for nested values, explicit counts, selectable scalar values, and explicit null or empty labels. The inspector's metadata remains closed initially.

Domain components accept semantic data and actions, never authorize or infer permissions. Presentational components do not fetch. The first layer includes resource, project, instrument, person, and MFID identity; capability actions; status; metadata; relationship rows; collection names; Summary and Settings editors; scientific metadata editor; collection state; and bounded query-backed chooser. The chooser owns at most one identity-scoped kind-bounded search and transient dialog state, never route state, committed filters, enumeration, or authorization.

Use a semantic icon catalog, not arbitrary feature imports. Decorative icons are hidden from assistive technology. Icon-only controls have persistent resource-specific accessible names and visible tooltips, and are reserved for obvious low-risk actions. Text remains for unfamiliar, destructive, ambiguous, or qualified actions. Resource and critical-state assignments are stable. No emoji, logo, or brand mark is a normal UI icon. Lucide is the configured icon library; local SVG additions require review through the same catalog.

Instructional copy, confirmations, and tooltips emphasize a referenced resource's displayed name with semantic strong text so it remains distinguishable from the surrounding action or relationship wording. Accessible names remain complete plain-language actions.

## Interaction policy

- Use distinct semantics for navigation and disclosure chevrons. Selected navigation exposes current location beyond color. Persistent desktop navigation collapses to an accessible drawer or bottom pattern without changing route identity.
- Every form control has an accessible label. Shared fields provide semantic grouping, validation association and announcement, and distinct required, optional, disabled, read-only, pending, and failed states. Drafts survive failure until success or explicit discard.
- Summary edits may replace values within their card without changing page identity. Project and instrument descriptive changes live in Settings and reuse the same field, local-error, pending, and discard behavior. Project Overview uses one details section and a read-only People section; Settings uses route-backed General and Members subsections with administrative controls. Keep lifecycle, ownership, access, members, operators, metadata, relationships, and deletion separate.
- Metadata edit mode uses a bounded vertically resizable monospace root-JSON workspace. JSON types and nesting round-trip. Removing a top-level field requires full-replacement confirmation until the API supports atomic deletion.
- Member role badges name the role and communicate hierarchy by order. Unknown roles use a neutral fallback. Member management uses a focused add dialog, explicit role edit, and confirmation for removal or voluntary leave. Direct membership has no invitation workflow and production exposure remains blocked on session authentication.
- Relationship management belongs to canonical resource pages, not the inspector. State parent-child and cross-type direction in text and use a focused accessible dialog with bounded target-type search for add. Normal rows expose only canonical navigation; an explicit management mode replaces the navigation action with unlink controls, and unlink uses an alert dialog for confirmation. Controls follow the source's exact `can_edit` guidance but must not imply that either resource will be deleted. Keep pending, invalid, duplicate, self-link, cycle, unavailable, and failed states local and understandable without color.
- Resource Access is a route-backed child of canonical sample and dataset pages with a persistent parent header and Overview or Access navigation. Do not preload ACL data before Access entry. Show manager controls only for exact `can_manage_access`; keep public controls distinct, cap user and project grant choices at `max_grant_role`, and render owner, service-account, instrument, system, and unknown grants as read-only. Publish, unpublish, and revoke use alert-dialog confirmation and server-confirmed feedback without optimism.
- Consequential actions use confirmation and API preview where available. Pending, unavailable, failed, and ready controls preserve exterior geometry and use accessible feedback inside the reserved action area.
- Resource identity includes complete selectable MFID and fixed copy action. Absent Summary values use `-`. Recognized timestamps display local time and edit with native local date-time controls; unrecognized values stay unchanged and are never guessed.
- Confirm selectors to a record rather than storing arbitrary labels. Filter drafts use Apply and Clear, stay separate from URL state, name lifecycle field and time zone, and never call scientific timestamps creation dates.

Semantic table markup is the default with TanStack Table controlling headless state. Use semantic column-width roles, bounded primary-name cells with complete accessible values, keyboard-operable URL-backed controls, and virtualization that retains focused row and position access. Compact layouts may use an explicitly equivalent item list or bounded table scroll, never page-wide horizontal scroll. Do not imply unsupported bulk actions. File rows reserve a labelled screen-reader action slot with stable ready, pending, retry, and unavailable geometry and reduced-motion-safe status.

Dialogs are focused input, alert dialogs destructive confirmation, sheets contextual details or filters, and popovers small anchored content. Every overlay has an accessible title and fitting description. Base UI owns focus containment, restoration, Escape, outside interaction, and scroll behavior unless a documented requirement differs. Prefer a route for deep-linkable or durable navigation.

The inspector is the route-addressable exception under [decision 0008](../decisions/0008-inspect-linked-resources-in-place.md) and uses one modal shadcn Sheet at every width under [decision 0009](../decisions/0009-overlay-resource-inspection.md). It uses shared width, layer, surface, spacing, and motion roles, never resizes main content, and keeps title, Close, Back, and an Open full-page action stable. Relationship rows provide named preview and canonical navigation actions. Opening focuses its heading; following a relationship resets only panel scroll and focuses its new heading; closing restores the trigger or a stable page heading. Target changes keep chrome mounted but never show old body under a new heading. Files and downloads remain full-page actions.

Feedback preserves page context. Skeletons replace only unreadable known shapes. Loading, empty, unavailable, error, refreshing, stale, partial failure, disabled, selected, permission-limited, and destructive states are distinct and have accessible text. Refresh and pagination retain readable content with local busy and retry feedback. Errors stay in their affected panel, row, file, dialog, or field where possible; toasts never replace actionable or destructive feedback.

## Accessibility, responsiveness, and validation

Target WCAG 2.2 AA. Every workflow is keyboard operable with logical focus and no trap; focus is visible and unobscured. Normal text meets 4.5:1 contrast, large text and meaningful boundaries or focus indicators 3:1. Support 200 percent zoom, text-spacing overrides, and reflow at 320 CSS px without two-dimensional page scrolling except bounded alternatives for tables and intrinsic scientific views. Meet target-size requirements, announce async status without stealing focus, provide correct landmarks, headings, labels, errors, table headers, and dialog semantics, and never require color, hover, drag, precise pointing, or animation. Graphs and scientific views require a textual or tabular essential-information alternative. Automated checks do not replace manual keyboard and screen-reader review.

Desktop and laptop are primary. Use their space for navigation, semantic tables, comparison, split views, contextual panels, and visible identity. Keep prose and form width bounded while allowing data and metadata workspaces to expand. Preserve routes and MFIDs across breakpoints, retain primary action and entity identity without page overflow, make column loss explicit and reversible, and never let sticky UI obscure focus or content. Test long names, full MFIDs, translation expansion, empty values, dense metadata, and permission-limited states.

Phase 0 requires a token and component fixture surface, automated rejection of raw colors, inline styles, arbitrary values, and primitive typography outside approved files, component semantic and keyboard coverage, light and dark visual baselines at compact, medium, and wide widths, automated contrast and accessibility checks, and manual critical-workflow review. Test loading, empty, error, stale, partial-failure, long, and dense states. The current fixture routes and Playwright baselines are specified in [`design-fixtures.md`](design-fixtures.md). Exceptions must promote a named missing semantic role; permanent unexplained suppressions are not accepted.
