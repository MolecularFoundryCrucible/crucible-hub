# Design System Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Hub's color tokens as a palette plus semantic roles, settle the action hierarchy, remove generic decoration, and document the system as a quick reference.

**Architecture:** All tokens stay in `src/styles.css`: a palette layer (raw ramps) and a role layer (light in `:root`, dark in `.dark`) that references only the palette. Components in `src/components/ui` consume roles only; `scripts/check-design-tokens.mjs` and `scripts/check-color-contrast.mjs` enforce it. Each task ends at a user approval gate with before/after screenshots.

**Tech Stack:** Tailwind v4 (`@theme inline`), shadcn on Base UI, React, Vitest, Playwright, culori (contrast script).

**Spec:** `docs/superpowers/specs/2026-10-20-design-system-refresh-design.md`

## Global Constraints

- Branch `feat/ui-color-system`; commit after each task once checks pass; never merge to `main` without explicit user approval.
- Next task starts only after the user approves the previous task's screenshots.
- Tokens and raw color values live only in `src/styles.css`.
- WCAG 2.2 AA: text 4.5:1; inputs, icon-only controls, focus rings, sole-cue boundaries 3:1. Text-button borders may be softer.
- Resource-type colors (`--resource-*`) keep their rendered values.
- Orange is selection and current location only; no orange on buttons or status.
- No accent stripes, colored bars, or decorative glows.
- Browser checks: `npm run build`, then `HOST=127.0.0.1 PORT=4174 HUB_DATA_SOURCE=fixture HUB_ENABLE_FIXTURES=true NODE_ENV=development node .output/server/index.mjs`. Never a second Vite dev server.
- Screenshot script: `scratchpad/audit/capture.cjs <dir>` (1440x900, light and dark, admin cookie). Before shots come from `main`.
- No em dashes; no code comments unless the why is non-obvious; no filler UI text.

## Review Focus

- Theme toggle mid-session: every role must exist in both `:root` and `.dark`, so a role missing from `.dark` silently shows the light value on a dark surface.
- Hover over a solid primary in dark mode (light-blue fill): hover must stay legible with the dark-blue foreground.
- Pressed toggles (Edit/Done, view pickers) after removing the `secondary` button variant: the pressed state must still be visibly different from rest.
- Graph canvas in fullscreen with the expansion buttons migrated off `graph`: buttons must stay visible on the recessed graph surface in both themes.
- Disabled outline and ghost buttons: must be distinguishable from enabled ghost buttons that have no border.

---

### Task 1: Palette and component preview (approval gate, no app code)

**Files:**

- Create: `<scratchpad>/design-preview/preview.html` (published as an Artifact)

**Interfaces:**

- Produces: an approved set of palette ramp values (neutral, brand blue, orange) and role mappings for light and dark, written as a CSS block at the top of the preview file that Task 2 copies verbatim.

- [ ] **Step 1:** Generate ramps in OKLCH: neutral (12 steps, hue 240, chroma 0.003 to 0.02), brand blue (anchored on `#031e2d` and `#a8c4cd`), orange (anchored on `#ff6600`, including a step with at least 3:1 on white). Map every role named in the spec's "Proposed token architecture" for both themes.
- [ ] **Step 2:** Compute contrast with culori for each role pair the contrast script checks plus the soft and strong border roles; print a table on the page.
- [ ] **Step 3:** Render, in both themes side by side: ramps, roles, all button tiers in rest, hover, pressed, focus, disabled; badges; a dataset Summary card and a table row; a graph node and an inspector header without accent bars (two border alternatives each); two sign-in card alternatives carrying orange without a stripe or glow.
- [ ] **Step 4:** Publish as an Artifact and ask the user to approve or adjust. Stop until approved.

### Task 2: Tokens

**Files:**

- Modify: `src/styles.css` (`:root`, `.dark`, `@theme inline`)
- Modify: `scripts/check-color-contrast.mjs`
- Modify: `src/components/ui/dialog.tsx:32`, `src/components/ui/alert-dialog.tsx:30`, `src/components/ui/sheet.tsx:29` (`bg-black/10` to an overlay role)

**Interfaces:**

- Consumes: approved CSS block from Task 1.
- Produces: palette tokens `--palette-neutral-{1..12}`, `--palette-blue-{n}`, `--palette-orange-{n}`; new roles `--border-strong`, `--action-hover`, `--action-pressed`, `--primary-hover`, `--overlay`, each with a `--color-*` mapping in `@theme inline`. All existing role names keep working.

- [ ] **Step 1: Write the failing check.** In `check-color-contrast.mjs`, replace the `action-border` 3:1 expectation with: `border-strong` on `background` and `card` at 3:1; `input` at 3:1 (unchanged); `primary-foreground` on `primary` at 4.5:1; `primary-foreground` on `primary-hover` at 4.5:1; `selection` on `background` and `card` at 3:1; `foreground` on `secondary` at 4.5:1. Add a check that every role defined in `:root` (excluding `--palette-*` and `--brand-*`) is also defined in `.dark`.
- [ ] **Step 2:** Run `node scripts/check-color-contrast.mjs`. Expected: FAIL (missing `border-strong`, `primary-hover`, and roles absent from `.dark`).
- [ ] **Step 3:** Add the palette and roles to `src/styles.css`; re-point existing roles at the palette; disable Tailwind's default palette with `--color-*: initial;` at the top of `@theme inline`; replace `bg-black/10` with `bg-overlay`.
- [ ] **Step 4:** Run `npm run design:check && npm run typecheck && npm test && npm run build`. Expected: all pass.
- [ ] **Step 5:** Capture after screenshots, publish the comparison Artifact, commit `feat(ui): palette and semantic color roles`. Stop until approved.

### Task 3: Components

**Files:**

- Modify: `src/components/ui/button.tsx`, `src/components/ui/badge.tsx`, `src/components/ui/toggle.tsx`
- Modify call sites: `src/features/resource-graph/resource-graph-canvas.tsx:1440` (`graph`), `src/routes/auth.sign-in.tsx:60` (`link`), `src/components/crucible/collection-browser.tsx:297` and `src/features/project-data/project-data-collection.tsx:774` (`secondary`), the 8 `<Badge>` uses without a variant
- Modify: `scripts/check-design-tokens.mjs`
- Test: `src/components/ui/button.test.tsx` (create if absent)

**Interfaces:**

- Consumes: roles from Task 2.
- Produces: `Button` variants exactly `default | outline | ghost | destructive | destructive-solid | warning`; `Badge` variants without `link`, with `default` neutral.

- [ ] **Step 1: Write failing tests** in `button.test.tsx`: `outline` with size `icon-sm` has class `border-border-strong`; `outline` with size `sm` has class `border-action-border`; `aria-pressed="true"` on `ghost` and `outline` includes `aria-pressed:bg-secondary`; no variant class string contains `color-mix`.
- [ ] **Step 2:** Run `npx vitest run src/components/ui/button.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Update `button.tsx` (hover and pressed from roles, strong border for `icon*` sizes via compound variants, remove `secondary`, `graph`, `link`), `badge.tsx` (`default` neutral, remove `link`), `toggle.tsx`. Migrate call sites: graph expansion to `outline`; sign-in link to `ghost`; selected list items style `aria-current="page"` with `bg-secondary` on `ghost`. Audit the 8 default badges.
- [ ] **Step 4:** Add a `design:check` rule rejecting `variant="secondary"|"graph"|"link"` on `Button` and `variant="link"` on `Badge`.
- [ ] **Step 5:** Run `npm run design:check && npm run typecheck && npm test && npm run build`. Expected: all pass.
- [ ] **Step 6:** Screenshots including graph fullscreen and a pressed Edit/Done toggle; publish; commit `feat(ui): settle button and badge variants`. Stop until approved.

### Task 4: Sweep and decoration removal

**Files:**

- Modify: `src/styles.css` (`.auth-page-card`, `.auth-page-sign-in` glow if not approved, `[data-inspector-kind]` top border and `--inspector-accent`, `.resource-graph-flow-node[data-kind]` left stripe)
- Modify: call sites across `src/components/crucible`, `src/features`, `src/routes` whose tier violates the spec's classification rule

**Interfaces:**

- Consumes: approved alternatives from Task 1; variants from Task 3.

- [ ] **Step 1:** Remove the three accent bars and apply the approved replacements.
- [ ] **Step 2:** List every `Button` and `buttonVariants` call with its variant (`grep -rn`), classify each with the spec rule, and change only those that disagree. Record the changed list in the commit body.
- [ ] **Step 3:** Apply the refinement checklist from the spec (state coverage, 24x24 targets for ghost icon buttons, disabled consistency, tabular numerals in tables).
- [ ] **Step 4:** Run `npm run design:check && npm run typecheck && npm test && npm run build && npm run test:browser`. Expected: all pass.
- [ ] **Step 5:** Screenshots including sign-in, inspector, graph; publish; commit `feat(ui): apply action hierarchy and remove accent bars`. Stop until approved.

### Task 5: Documentation and fixture page

**Files:**

- Modify: `docs/design-system.md` (quick reference)
- Create: `docs/design-system-reference.md` (detailed reference, reorganized from today's `design-system.md`)
- Modify: `src/routes/fixtures.design-system.tsx`, `tests/browser/design-system.spec.ts`
- Modify: `CHANGELOG.md` (Unreleased)

- [ ] **Step 1:** Extend `tests/browser/design-system.spec.ts` to assert the fixture page shows sections named Palette, Roles, Actions, Badges, each in light and dark.
- [ ] **Step 2:** Run `npm run test:browser`. Expected: FAIL on the new assertions.
- [ ] **Step 3:** Update the fixture page; write the quick reference (principles, brand color jobs, role table, action tiers and classification rule, no-decoration rule, do/don't examples); move the remaining still-true detail into the reference doc; run `node scripts/check-doc-links.mjs`.
- [ ] **Step 4:** Run `npm run design:check && npm run typecheck && npm test && npm run build && npm run test:browser`. Expected: all pass.
- [ ] **Step 5:** Add the CHANGELOG entry; commit `docs: design system quick reference and reference`. Ask the user whether to merge.
