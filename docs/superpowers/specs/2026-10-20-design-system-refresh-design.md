# Design system refresh

Date: 2026-10-20

Branch: `feat/ui-color-system` (experimental; nothing merges to `main` without explicit approval)

## Intent

Crucible Hub is a scientific data platform. On every page the data is the hero: values, files, metadata, MFIDs, timestamps. The interface recedes: neutral surfaces, few borders, quiet controls, and color only where it carries meaning (resource type, state, access, selection, and the single most important action).

The reference feel is GitHub: a mostly neutral interface where one blue does the work and color mostly means state. Mechanics resemble each other, but the Hub must not copy GitHub's look. Its identity comes from the three Crucible brand colors and its scientific content.

The current system works and is enforced, but grew organically. The user found the result "greyish everywhere" and bland. This refresh:

1. checks tokens against current best practice, defines them in one place, and applies them consistently;
2. refines existing components with small UI/UX guidelines that are missing (no redesigns);
3. documents the result so future work, human or agent, builds new pages that look right the first time.

## Goals

- A two-layer color token system: a raw palette, and semantic roles that reference only that palette.
- Deliberate use of the three Crucible colors, each with one job.
- A three-tier action hierarchy (primary, secondary, tertiary) plus semantic destructive and warning variants, with no other general-purpose button styles.
- Hover, pressed, and selected colors defined as tokens, not mixed ad hoc inside component classes.
- Both themes designed with equal care; dark mode is not an inversion.
- Documentation split into a scannable quick reference and a detailed reference, with the fixture design-system page as the live visual version.
- Enforcement updated so drift is caught automatically.

## Non-goals

- Changing resource-type colors (dataset, sample, project, instrument, person, service account, file). The user is satisfied with them. They may be re-expressed on the new palette only if their rendered values stay visually identical within rounding.
- Component redesigns, new components, layout changes, or new features.
- Changing the type, spacing, radius, motion, or breakpoint scales, beyond fixing inconsistencies found during the sweep.
- Adopting the W3C DTCG JSON format or Style Dictionary. CSS custom properties in `src/styles.css` remain the single source. (Mentioned only so a builder does not add a toolchain.)
- Installing third-party design skills.

## Anti-goals (failure even if it technically works)

- Color that decorates instead of meaning something.
- Orange on buttons, orange as a status color, or orange that can be mistaken for warning amber or instrument brass.
- Light blue used for text or thin lines on light surfaces (1.8:1 on white).
- A brand-heavy interface that competes with the data.
- Regressions in WCAG 2.2 AA contrast, focus visibility, or target size.
- A visual change that slips into `main` before the user approves it with screenshots.

## Constraints

- Stack: Tailwind v4 (`@theme inline`), shadcn on Base UI, CSS custom properties. Tokens live only in `src/styles.css`.
- Existing contract `docs/design-system.md` and enforcement `npm run design:check` (`scripts/check-design-tokens.mjs`, `scripts/check-color-contrast.mjs`). Feature code may not introduce raw colors, arbitrary values, or primitive typography; this stays.
- Contrast standard is WCAG 2.2 AA (APCA is not adopted by WCAG 3, which is itself years away). APCA may be reported as a secondary, non-blocking check, mainly for dark mode.
- Light and dark themes via the `.dark` class; both must pass the contrast script.
- Browser checks use the production build on port 4174 with fixtures (`HUB_DATA_SOURCE=fixture HUB_ENABLE_FIXTURES=true`). Never start a second Vite dev server.
- Another agent (Antigravity) may edit Hub UI in this repository; check `git status` before each step and never mix its uncommitted work.
- Do not commit unless the user asks.
- No em dashes anywhere; no code comments unless the why is non-obvious; no filler UI text.

## Decisions made with the user

### Brand colors, one job each

| Color | Value | Contrast | Job |
| --- | --- | --- | --- |
| Crucible dark blue | `#031e2d` | 17.1:1 on white | Ink and primary action in light mode; sidebar surface in dark mode |
| Crucible light blue | `#a8c4cd` | 1.8:1 on white; 9.3:1 on dark blue | Quiet surfaces in light mode (sidebar, selected and hover backgrounds); primary action in dark mode |
| Crucible orange | `#ff6600` | 2.9:1 on white; 5.8:1 on dark blue | "You are here / this is selected" signal only |

Orange keeps its current role as the selection and current-location marker (active tab underline, current nav item, current graph node). On light surfaces it uses a darkened step that reaches at least 3:1 (today `#cc5200`, 4.4:1). On dark surfaces it may use full-strength `#ff6600`. The sign-in page keeps orange as its one brand moment (user decision), but not as a thick card border (see below).

### No generic decoration

The user rejects thick accent bars as generic AI-generated styling. Remove all three in the Hub today:

- the 3 px orange top border on the sign-in card (`.auth-page-card`);
- the 3 px resource-colored top border on the resource inspector (`--inspector-accent`);
- the 5 px resource-colored left stripe on sample and dataset graph nodes (`.resource-graph-flow-node[data-kind]`).

Resource identity is already carried by the resource icon in its tinted icon well (inspector header, graph node badge), so the bars add nothing. Replacements must be useful rather than ornamental; candidates are shown in the preview for the user to choose:

- graph nodes: a uniform 1 px border (type-tinted or neutral), with the type icon well as the identity cue; current and inspected nodes keep their existing selection and focus treatments;
- inspector: no bar; the header icon well and title carry identity;
- sign-in: orange carried by a small, meaningful brand element (for example the Hub mark or the primary sign-in affordance's focus/hover), never a stripe or glow.

The same review applies to the sign-in page's radial glow behind the card: keep only if the preview shows it earns its place.

General rule for the quick reference: no accent stripes, gradient glows, or colored bars used to make a card look designed. Emphasis comes from content, type, and the established roles.

### Neutrals

All neutrals carry a slight cool tint toward hue ~240 so the canvas, text, and borders agree with the sidebar and brand blue. No pure greys.

### Resource-type and status colors

Unchanged in meaning and appearance. Status colors (success, warning, info, destructive) must stay distinguishable from resource-type colors and from orange.

### Action hierarchy

| Tier | Variant | Look | Use |
| --- | --- | --- | --- |
| Primary | `default` | Solid brand (dark blue in light, light blue in dark) | The one main action of a view: page-header Create, Save, Submit, dialog confirm |
| Secondary | `outline` | Card surface, soft border | Actions that change data: Add files, Choose project, Cancel |
| Tertiary | `ghost` | Text and icon, no resting container | Low-stakes and frequent: card Edit, Edit/Done toggle, Refresh, Browse nearby, copy, print, row open arrows, view-all links |
| Semantic | `destructive`, `destructive-solid` | Tinted red trigger; solid red final confirm | Delete, remove, revoke, leave |
| Semantic | `warning` | Tinted amber | Administrator view controls only |

Rules agreed so far:

- One primary per view. The global top-bar Create menu is chrome and uses `outline`, so it never competes with a page's own primary.
- Create buttons follow position: solid in a page header, outline inside a toolbar or card, outline in the top bar. The Data page header keeps two solid buttons (Create sample, Create dataset) as an equal pair; this is the one accepted exception.
- Variants to remove from `Button`: `secondary` (only used as a selected-item state in two lists, which already set `aria-current`; style that state directly), `graph` (fold into `outline` or `ghost`; if the graph canvas needs its own surface, express it through tokens scoped to the graph, not a button variant), and `link` (fold into `ghost` or the existing text-link styling).
- Contrast for borders: 3:1 is required for inputs, icon-only buttons, focus rings, and any boundary that is the only cue identifying a control. Text buttons may use a softer border, as WCAG 1.4.11 permits when the label identifies the control. `scripts/check-color-contrast.mjs` must encode this split (today it requires 3:1 for `--action-border`, which the experimental soft border fails at ~1.6:1).

### Documentation

- `docs/design-system.md` becomes a short quick reference: principles, the color roles and when to use each, the action hierarchy, and do/don't examples. Scannable in a few minutes.
- The current long-form content moves to a detailed reference (one or more files under `docs/`), reorganized by topic, keeping everything still true and dropping what is obsolete.
- `/fixtures/design-system` (`src/routes/fixtures.design-system.tsx`) becomes the live visual version: palette ramps, every semantic role in both themes, every button tier and state, badges, and focus states.

## Proposed token architecture

Two layers, both in `src/styles.css`:

1. **Palette (primitives).** Raw values only, named by appearance and step, never used directly by components or features:
   - a cool neutral ramp (about 12 steps from near-white to near-black, hue ~240, low chroma);
   - a brand blue ramp anchored on Crucible dark blue and light blue;
   - an orange ramp anchored on Crucible orange, including a step that reaches 3:1 on white;
   - existing hues for status and resource types, expressed as ramps or single steps as needed.
2. **Roles (semantic).** Named by job, never by value; light and dark themes swap only this layer. Shape inspired by Primer (foreground, background, border crossed with default, muted, emphasis) but kept compatible with shadcn names so `components/ui` keeps working:
   - text: default, muted, on-emphasis, link;
   - surface: canvas, card, popover, inset or muted, selected, hover;
   - border: default (soft), strong (3:1 for inputs and icon-only controls);
   - action: primary (bg, fg, hover), secondary (bg, border, hover), tertiary (hover), pressed;
   - accent: selection (orange), focus ring;
   - status: success, warning, info, destructive, each with emphasis and muted variants;
   - resource types and access roles: unchanged values, re-pointed at the palette where possible.

Existing shadcn role names (`--primary`, `--muted-foreground`, `--border`, and so on) stay as the public role names unless a rename clearly improves comprehension; new roles are added only where a real job is unserved today (for example, hover and pressed surfaces now computed with inline `color-mix`).

The Tailwind default color palette is disabled (`--color-*: initial` in `@theme`) so only Hub roles exist as utilities. Current uses of default palette classes (three `bg-black` overlays) move to a role.

## Small UI/UX refinements to apply

Applied as a checklist across existing components, not as redesigns:

- Every interactive element has distinct hover, pressed, selected, focus-visible, and disabled states from tokens.
- Ghost buttons keep a minimum 24x24 px target with spacing (WCAG 2.5.8), and icon-only ghost buttons keep a tooltip and accessible name (already required).
- Focus ring stays brand-colored and at least 3:1 against both the control and the surface.
- Disabled state is consistent (reduced opacity plus no pointer events) and never the only way to explain why an action is unavailable.
- Selected state in lists and navigation uses the light-blue surface plus orange marker where a marker exists, never color alone.
- Badges: the `default` badge variant is currently solid primary; with a dark-blue primary that becomes heavy. Badges are metadata, so `default` becomes neutral and no badge uses the solid primary.
- Numbers in tables and metadata use tabular numerals; MFIDs and identifiers use the monospace role (already required; verify during sweep).

## Process

1. **Preview before code.** Build a standalone palette and component preview (an Artifact page) showing the ramps, roles, buttons, badges, and a sample data card in both themes. The user approves colors there.
2. **Tokens.** Implement the palette and roles in `src/styles.css`, keeping every existing role name working. Update the contrast script for the new roles and the border split.
3. **Components.** Update `components/ui` (button, badge, toggle, and any primitive that mixes colors inline) to the new roles; remove the `secondary`, `graph`, and `link` button variants and migrate their call sites.
4. **Sweep.** Apply the action hierarchy and refinement checklist across `components/crucible`, `features`, and `routes`. Update `design:check` to reject removed variants and default palette utilities.
5. **Docs.** Rewrite `docs/design-system.md` as the quick reference, move detail into a reference doc, update the fixture page, and add a CHANGELOG Unreleased entry.

After each step: `npm run design:check`, typecheck, unit tests, production build, and before/after screenshots (Home, Data, a dataset Overview, dataset Manage, Users, Projects, a project Overview, the graph, the inspector, and sign-in, in light and dark) shared with the user as an Artifact page. Each step is committed to `feat/ui-color-system` once checks pass, and the next step starts only after the user approves the screenshots (user decision). The user decides whether and when to merge.

## Clarifications

### Starting point

The uncommitted changes on `feat/ui-color-system` are this session's own color experiment (tinted neutrals, brand primary, ghost tertiary actions, outline top-bar Create, position-based Create buttons). They are the starting point for step 2, not another agent's work. "Before" screenshots are always taken from `main`.

### Classifying an action (rule for the quick reference)

Pick the tier by stakes and frequency, not by whether the action eventually changes data:

- **Primary:** the one action the view exists for, or the commit at the end of a flow (Save, Create, Submit, Confirm).
- **Secondary (`outline`):** an action that directly executes a change or opens a flow that will, and that a person does deliberately (Add files, Choose project, Make private, Cancel in a form footer).
- **Tertiary (`ghost`):** frequent, reversible, or mode-entering actions whose consequences are confirmed elsewhere (card Edit opens a form whose Save is primary; Refresh; copy; print; navigation arrows; view all).
- **Destructive / warning:** chosen by meaning, regardless of frequency.

When in doubt, choose the quieter tier.

### Decisions made by the designer (reviewable)

- **Opacity and mixing.** Tailwind opacity modifiers on a semantic role (`bg-destructive/10`, `bg-primary/90`) are allowed: they derive from one role and stay consistent. Arbitrary `color-mix(...)` values inside component classes are not; they become named roles in `src/styles.css`. `color-mix` inside `src/styles.css` itself is fine, since that file is the single source.
- **Links.** Inline text links use the foreground color with underline on hover (today's behavior); resource names in tables and cards keep their current semibold foreground link style. No separate link blue. The only `variant="link"` button (sign-in page) migrates to `ghost`.
- **Icon-only buttons.** Icon-only `outline` buttons (the `icon*` sizes) automatically use the strong 3:1 border role; text `outline` buttons use the soft border. A `ghost` icon button satisfies the rule because its icon is the identifying cue and must itself reach 3:1 against the surface. The contrast script checks both border roles accordingly.
- **Selected and pressed surfaces.** Light mode: a light-blue-tinted surface. Dark mode: a dark-blue/light-blue mix, matching today's dark sidebar accent. `--secondary` survives as the role for pressed and selected surfaces even though the `secondary` button variant is removed.
- **Badges.** `default` becomes neutral. The 8 badge call sites that rely on `default` are audited; any that genuinely signal emphasis move to an explicit semantic variant. The badge `link` variant is unused and is removed; `design:check` rejects removed variants for both `Button` and `Badge`.

## Left to the builder

- Exact ramp step values and count, as long as roles meet the contrast rules and the preview is approved.
- Final role names where the doc gives a shape but not a name, as long as shadcn-compatible names keep working.
- How the graph canvas expresses its surfaces once the `graph` button variant is gone.
- How the detailed reference doc is split into files.
- Order of call-site migrations within a step.
