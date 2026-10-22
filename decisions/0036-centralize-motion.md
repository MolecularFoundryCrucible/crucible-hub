# 0036: Centralize Motion in One System of Roles and Shared Pieces

Status: Accepted

Date: 2026-10-22

Updated: 2026-10-22

## Context

The Hub has motion tokens (`--motion-fast`, `--motion-standard`, `--motion-deliberate` at 120, 180 and 240 ms, and standard, enter and exit easing in `src/styles.css`) and a few shared pieces (`Reveal`, `enterMotionClassName`, `useEnteringKeys`, `.pending-region`). A review of the whole Hub found that many places bypass them:

- toasts and the resource graph use their own durations and curves
- overlays use the same easing to open and close, and `--motion-ease-exit` is unused
- tooltips have no set timing and no fade on close
- every overlay shares `z-50`
- the "Show all" expansion reads the duration as a number and breaks in production builds
- loading indicators flash on fast responses, and stale content is only dimmed in one place

Each one-off fix so far added another local pattern. The Hub needs one motion system that features use by name, not by value.

The design follows the shared ground of published industry guidance rather than inventing a style: IBM Carbon "productive motion" for data-heavy tools, Material Design 3 motion, GitHub Primer and the Apple Human Interface Guidelines, together with WCAG 2.2 (2.2.2 and 2.3.3).

## Principles

- **Motion explains change, never decorates.** It shows where something came from or went, that work is in progress, or that content changed.
- **Quick and productive.** Durations stay between 120 and 240 ms. Size and distance choose the step: small things are fast, surfaces are deliberate.
- **Asymmetric.** Entering decelerates (`ease-enter`); leaving accelerates (`ease-exit`) and is one step shorter than entering.
- **Cheap to render.** Animate `opacity` and `transform`. Height animates only through `Reveal` and native disclosure.
- **Feedback first.** Every activation shows a response within 100 ms, optimistically where it is safe.
- **Indicators wait.** Spinners, progress bars and dimming appear only after a short indicator delay, so fast responses never flash.
- **Stale stays readable.** While a region refreshes, its previous content stays visible and dimmed. Skeletons match the loaded layout.
- **Reduced motion means no movement.** Movement becomes an instant change. A fade of at most the fast duration is allowed only where an instant change would lose meaning.

## Decision

### 1. Tokens, defined once in `src/styles.css`

- **Durations:** the existing `--motion-fast` (120 ms), `--motion-standard` (180 ms) and `--motion-deliberate` (240 ms).
- **Easing:** the existing `--motion-ease-standard`, `--motion-ease-enter` and `--motion-ease-exit`.
- **New: `--motion-indicator-delay` (200 ms).** The wait before any spinner, progress bar or dimming appears.
- **New: `--motion-pending-opacity` (0.6).** The opacity of dimmed stale content.
- **New: `--motion-progress-delay` (500 ms).** The longer wait before the route progress bar appears. Dimming stale content follows React's own 200 ms example, while progress bars and looping indicators follow the longer waits in NN/g guidance and TanStack Router's pending defaults.
- **New: named layers,** alongside the existing `--layer-*` tokens. From lowest to highest: the existing sticky and floating layers, then `--layer-navigation` (sidebar and app header), `--layer-modal` (dialogs, alert dialogs, sheets and their backdrops), `--layer-popover` (menus, popovers, comboboxes, hover cards), `--layer-tooltip` and `--layer-toast`. Popovers sit above modals because the Hub opens pickers and menus inside dialogs and the inspector; a modal blocks everything outside it, so no popover from behind a modal can be open at the same time. Toasts use `--layer-toast` plus their stack index. This replaces the popover-below-modal order currently documented in `docs/design-system-reference.md`.

No component, route or feature may use a raw duration, easing curve, cubic-bezier, `z-50` or numeric z-index.

### 2. Motion roles

Every animated element uses exactly one role. Each role is defined once, as CSS in `src/styles.css` and as class constants in `src/lib/motion.ts`.

| Role               | Used for                                            | Enter                                                                                             | Exit                                       |
| ------------------ | --------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `press`            | hover, press, focus, selection colour changes       | fast, standard easing                                                                             | same                                       |
| `anchored-overlay` | menus, popovers, comboboxes, hover cards, tooltips  | fast, `ease-enter`, fade plus 95% scale from the anchor side                                      | fast, `ease-exit`, fade                    |
| `modal`            | dialogs, alert dialogs and their backdrops          | standard, `ease-enter`, fade plus 95% scale                                                       | fast, `ease-exit`, fade                    |
| `sheet`            | side sheets and the resource inspector              | deliberate, `ease-enter`, slide from its edge plus fade                                           | standard, `ease-exit`                      |
| `toast`            | notifications                                       | standard, `ease-enter`                                                                            | fast, `ease-exit`; stack reflow standard   |
| `reveal`           | conditional sections that open and close in place   | standard, height plus fade (`Reveal`)                                                             | standard                                   |
| `content-enter`    | newly arrived rows, appended pages, swapped panels  | standard, `ease-enter`, fade                                                                      | none: content leaves instantly             |
| `section-change`   | route-backed section tabs                           | standard crossfade through the existing view transition                                           | same                                       |
| `layout`           | sidebar collapse, inspector docking, graph relayout | standard; graph relayout deliberate                                                               | same                                       |
| `pending`          | dimming a region whose data is reloading            | after the indicator delay: fast fade to the pending opacity                                       | fast                                       |
| `progress`         | the route progress bar and inline spinners          | bar after the progress delay, spinners after the indicator delay; the bar grows slowly toward 80% | finishes forward to full width, then fades |

### 3. Shared pieces

Features compose these and never re-implement them:

- **Motion module (`src/lib/motion.ts`).** Role class constants for each overlay type and for content enter. `motionDuration(token)` returns milliseconds from any token, accepting both `ms` and `s`, for the few places that must time motion in script (Web Animations, the graph).
- **`Reveal`.** It already exists: height plus fade, and it keeps its last content while it closes.
- **`useEnteringKeys` with `enterMotionClassName`.** They already exist: fade in only items that arrive after the first render.
- **`PendingRegion`.** A component that applies `pending-region`, `data-pending` and `aria-busy` together, with the dim delayed by the indicator delay. It replaces hand-wired `aria-busy` on collections, search, the inspector and the admin-view switch.
- **`useDelayedFlag(active, delay = indicator delay)`.** Becomes true only after `active` has held for the delay. It drives `RouteProgress`, inline pending icons that should not flash, and `PendingRegion`.
- **Overlay presets in `src/components/ui`.** Each Base UI overlay primitive applies its role once, so every dialog, menu, popover, combobox, hover card, tooltip, sheet and toast inherits the same timing, easing and layer. Overlay roles are CSS transitions on Base UI's `data-starting-style` and `data-ending-style`, which Base UI recommends over keyframe animations because a transition reverses smoothly when interrupted.
- **Exit-safe dialog content: Base UI `onOpenChangeComplete` and `useExitSafeMount`.** Dialog content keeps its last state until the close animation ends. Callers stop unmounting content or resetting state the moment `open` becomes false.

### 4. Reduced motion

- **One block.** A single `prefers-reduced-motion: reduce` block in `src/styles.css` replaces the three scattered ones.
- **What it does:**
  - zeroes all transitions and animations
  - turns off `tw-animate-css` translate and scale offsets
  - makes press transforms such as `translate-y-px` conditional on `motion-safe`
  - stops script-driven motion (the graph, `animateGrowth`, smooth scrolling) through one `prefersReducedMotion()` helper in the motion module

### 5. Enforcement

`scripts/check-design-tokens.mjs` is extended to reject, in `src/components/ui` as well as feature code:

- raw `ms`, `s` or `cubic-bezier` values in class names and inline styles
- arbitrary `duration-[...]`, `delay-[...]`, `ease-[...]` and `animate-[...]` utilities, and numeric `delay-*` utilities; `transition-[...]` stays allowed when it only lists properties, since a property list carries no timing
- keyframe animation classes (`animate-in`, `fade-in`, `zoom-in`, `slide-in-from-*` and their exit forms) outside `src/lib/motion.ts`, which owns the content-enter class
- `z-50` and numeric `z-*` utilities
- `ease-in`, `ease-out` and `ease-in-out`

The checker names the motion role or layer token to use instead. `docs/design-system-reference.md` documents the roles table and the shared pieces. `docs/design-system.md` gets a short "motion" rule set.

### 6. Fixes delivered through the system

These are the review findings that were checked against the code. Each is fixed with the pieces above, not locally.

1. **Foundations:**
   - the tokens, roles, motion module, `PendingRegion` and `useDelayedFlag`
   - the overlay presets and named layers
   - the consolidated reduced-motion block
   - the checker rules
2. **Overlays:**
   - toasts on tokens
   - tooltips fade on close
   - every overlay uses the enter and exit easing
   - dialog exits run to completion: the print dialog, Add members, Platform role and the one-time credential dialog
   - the QR scanner tooltip reaches keyboard users
3. **Correctness:**
   - "Show all" expansion timing uses `motionDuration`
   - collapsing a list inside the inspector scrolls the inspector rather than the page
   - `useIsMobile` uses rem through `useMediaQuery`, so the compact breakpoint matches CSS under text zoom; the inspector stays non-modal between the compact and docked widths, as the design system reference intends
4. **Loading:**
   - `PendingRegion` on Data, project data, search, the directories and the inspector
   - `RouteProgress` delayed and finishing forward
   - the resource page skeleton includes the Manage tab
   - Home and search skeletons match their loaded rows
   - Load more and infinite scroll fade new rows in
5. **Interaction feedback:**
   - whitespace-only summary edits do not enable Save
   - the upload drop zone stays in place during an upload
   - copy feedback resets after a short time through one shared copy hook
   - the Administrator view badge and switch show pending through the shared styles instead of `disabled`
6. **Layout:**
   - the graph relayout uses the deliberate duration and the motion module instead of a 440 ms local timer
   - sidebar collapse avoids swapping whole subtrees mid-animation where CSS can express the collapsed state

## Scope

Section 6 is the complete scope of this work. The principles guide future work and the design check; this work does not audit the whole Hub against them, and it does not make existing mutations optimistic.

## Non-goals

- No animation library (such as Framer Motion). CSS transitions, `tw-animate-css` for content entering, Base UI data attributes and the Web Animations API are enough.
- No decorative motion, page-level route animations beyond the existing section crossfade, parallax or spring physics.
- No list virtualization or graph rendering rewrite in this work.

## Rejected alternatives

- Keeping per-component fixes: this is how the current drift happened.
- Material 3 "emphasized" durations (up to 500 ms) for surfaces: they suit consumer apps, but feel slow in a productivity tool used all day.
- A motion component library wrapping every element: CSS roles applied by the existing primitives cover the need with less code.

## Consequences

- Motion changes are made in one place: tokens and roles in `src/styles.css`, constants in `src/lib/motion.ts`, presets in `src/components/ui`.
- New overlays and lists get correct motion by using the existing primitives. The design check catches bypasses.
- Some animations become slightly faster or slower to fit the roles, notably toasts (500 to 180 ms) and graph relayout (440 to 240 ms).

## Validation

- **Unit tests** cover `motionDuration` (`ms` and `s`), `useDelayedFlag`, `useEnteringKeys` and exit-safe dialog content.
- **The design check** fails on a deliberately added raw duration, cubic-bezier or `z-50` in a fixture.
- **Browser tests** check:
  - that an overlay plays its exit, by observing the ending style
  - that a fast response shows no progress bar or dimming
  - that a slow response shows both after the indicator delay
  - that under emulated reduced motion, overlays and `Reveal` change instantly
- **Frame-by-frame traces** like the Administrator view work are recorded for the toggle, opening and closing an overlay, a filter change on Data, and opening the inspector.
