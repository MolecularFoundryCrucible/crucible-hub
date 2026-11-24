# Crucible Hub design system reference

Start with the quick reference in [design-system.md](design-system.md); this document holds the detailed rules behind it. The live specimens are at `/hub/fixtures/design-system` ([design fixtures](design-fixtures.md)). The decision to own the system is [decision 0003](../decisions/0003-owned-design-system.md); motion is [decision 0036](../decisions/0036-centralize-motion.md).

Hub shares Lens's semantic hierarchy and state discipline, not its phone dimensions, navigation, or Material defaults. Use semantic meaning before appearance, calm dense rows and tables, explicit accessible states, native HTML before managed primitives, full usable MFIDs, and one behavior across light and dark themes.

## Ownership

| Layer                        | Owner                        | Primitive values           |
| ---------------------------- | ---------------------------- | -------------------------- |
| Palette, roles, and themes   | `src/styles.css`             | Allowed only here          |
| Controlled shadcn primitives | `src/components/ui`          | Shared tokens only         |
| Crucible domain components   | `src/components/crucible`    | Semantic tokens only       |
| Feature screens and routes   | `src/features`, `src/routes` | No primitive visual values |

Generated primitives enter `src/components/ui`, are reviewed, and become Hub-owned source. Feature code never introduces colors, arbitrary values, shadows, type sizes, spacing, radii, breakpoints, layers, or motion timings; a missing role is a design-system change.

## Typography

Noto Sans and Noto Sans Mono are self-hosted (`--font-mono` backs every `font-mono` use, code blocks, and the metadata editor). Semantic utilities own each role completely, so feature code does not rebuild roles from size, weight, line-height, or tracking utilities. Use tabular numerals for changing data, selectable monospace MFIDs, and no interface text below 12 px.

| Role                                      | Size / line height / weight | Use                      |
| ----------------------------------------- | --------------------------- | ------------------------ |
| `title-page`                              | 28 / 36 px / 600            | Route title              |
| `title-entity`                            | 24 / 32 px / 600            | Entity title             |
| `title-section`                           | 18 / 28 px / 600            | Section, dialog, group   |
| `body-prominent`                          | 16 / 24 px / 400            | Spacious body and inputs |
| `body`, `identifier`, `label`             | 14 / 20 px / 400 or 600     | Rows, MFIDs, controls    |
| `supporting`, `label-compact`, `overline` | 12 / 16 px                  | Secondary content        |
| `metric`                                  | 24 / 32 px / 600            | Bounded summary          |

- Read-only field labels in cards use the semibold `label` role in muted foreground; values use `body` or `identifier`.
- `supporting` is for hints, secondary identifiers, dense metadata keys, and supplementary status.
- In tables, headers and each row's record name use `label`; links to other records in secondary columns use `body`, so each row has one emphasized name.
- Group headings above labelled controls (sidebar groups, Filters sections) use muted `label-compact`.
- Instructional copy and confirmations put a referenced resource's name in strong text; accessible names stay plain.

## Spacing, sizing, and layers

- Spacing uses a 4 px base and named roles; radii are 4, 8, 12, and 16 px roles.
- Primary touch controls are at least 44 px. Dense pointer rows may be 36 px when each target is at least 24 by 24 px, separated, and keyboard reachable.
- Elevation: `level-0` flat, `level-1` sticky or raised, `level-2` menu or popover, `level-3` modal. Prefer surfaces and borders to shadow.
- Layers, lowest to highest, applied as `z-(--layer-*)`: `raised`, `graph-overlay`, `graph-action`, `sticky`, `floating-utility`, `navigation`, `route-progress`, `modal`, `popover`, `tooltip`, `toast`. Popovers sit above modals because pickers and menus open inside dialogs and the inspector.

## Color and themes

The palette (`--palette-neutral-*`, `--palette-blue-*`, `--palette-orange-*`) holds raw OKLCH values anchored on the three Crucible brand colors; only roles reference it. Roles are the only colors components use, themes swap only roles, and Tailwind's default palette is disabled. Every role with a light value also defines a dark value, which the contrast check enforces. Do not derive hierarchy with arbitrary foreground opacity.

Resource roles: datasets jade-emerald, samples plum-magenta, projects cobalt, instruments brass-gold (distinct from the orange selection role), people cerulean, service accounts indigo-violet, and files steel-slate. Combined Data navigation uses the dark-blue and light-blue brand pair. Renderers such as the graph use the same resource roles. Type, state, permission, and lifecycle always also use text, icon, shape, position, or pattern.

Theme is light, dark, or system. It is resolved before first paint, sets `color-scheme`, follows system changes only in system mode, and persists only the preference.

## Badges and status

- Status badges use a quiet tinted surface: success for Valid, Complete, Active; info for pending, queued, running, processing; warning for maintenance, retrying, limited results, attention; destructive for failed, invalid, decommissioned.
- Labels and tones come from one catalogue in `src/lib/status.ts`, keyed by kind of record because one word can carry a different tone per kind. `StatusBadge` renders them in sentence case.
- `VisibilityBadge` pairs the `public` (info-tinted) or `private` (neutral) variant with a globe or lock icon.
- `AccessRoleBadge` never uses hue: `emphasis` for roles that manage access (Owner, Admin), `outline` for roles that change data (Editor, Contributor, platform Support), `muted` for read-only or none. Owner adds the `OwnerRoleIcon` crown and reads as Lead on projects and Manager on instruments.

## Motion

Motion explains change and never decorates. Durations are `--motion-fast`, `--motion-standard`, and `--motion-deliberate` (120, 180, 240 ms) with `ease-standard`, `ease-enter`, and `ease-exit`; entering decelerates, leaving accelerates and is one step shorter. Every animated element uses one role:

| Role               | Used for                                            | Enter                                                  | Exit                              |
| ------------------ | --------------------------------------------------- | ------------------------------------------------------ | --------------------------------- |
| `press`            | hover, press, focus, and selection color            | fast, standard easing                                  | same                              |
| `anchored-overlay` | menus, popovers, comboboxes, hover cards, tooltips  | fast, fade plus 95% scale                              | fast, fade                        |
| `modal`            | dialogs, alert dialogs, and backdrops               | standard, fade plus 95% scale                          | fast, fade                        |
| `sheet`            | side sheets and the resource inspector              | deliberate, slide from its edge plus fade              | standard                          |
| `toast`            | notifications                                       | standard                                               | fast                              |
| `reveal`           | conditional sections opening in place               | standard, height plus fade                             | standard                          |
| `content-enter`    | new rows, appended pages, swapped panels            | standard, fade                                         | none                              |
| `section-change`   | route-backed section tabs                           | standard crossfade through a view transition           | same                              |
| `layout`           | sidebar collapse, inspector docking, graph relayout | standard; graph relayout and viewport moves deliberate | same                              |
| `pending`          | dimming a reloading region                          | fast fade after the indicator delay (200 ms)           | fast                              |
| `progress`         | route progress bar and inline spinners              | bar after 500 ms, spinners after the indicator delay   | bar finishes to full width, fades |

Shared pieces, each with one home:

- Overlay primitives in `src/components/ui` apply their role from `src/lib/motion.ts` as CSS transitions on Base UI `data-starting-style` and `data-ending-style`; feature code never sets overlay timing or layers.
- `Reveal` opens conditional content; `enterMotionClassName` with `useEnteringKeys` fades in only items that arrive after the first render.
- `PendingRegion` marks a reloading region with `aria-busy` and dims it only after the indicator delay; `useDelayedFlag` delays other indicators such as `DelayedPendingIcon`.
- Dialog content keeps its state until the close animation ends, through `onOpenChangeComplete` or `useExitSafeMount`.
- Script-timed motion reads tokens through `motionDuration`, which returns 0 under reduced motion.
- Controls in flight show pending with `aria-busy`, not `disabled`; copy controls confirm for 2 seconds through `useCopyFeedback`.
- Search-only navigation (filters, the inspector) never starts a view transition.

One reduced-motion block in `src/styles.css` removes movement: overlay scale and slide, `Reveal` height, graph motion, view transitions, and smooth scrolling. `npm run design:check` rejects raw durations and curves, arbitrary or numeric timing utilities, keyframe animation classes outside `src/lib/motion.ts`, and numeric `z-*` layers everywhere under `src`.

## Identity

- `PersonIdentity` presents people and service accounts (`inline`, `collection`, `stacked`, `avatar`). Service accounts use the robot icon and service-account violet; the API account-type field decides, and icon shape plus accessible name keep it independent of color. Shared presentations show `@username`; titles, labelled fields, copied values, and accessible names use the raw username.
- `ResourceIdentity` shows the type icon, name, optional context, and optional MFID. Unnamed samples and datasets read `Untitled sample` or `Untitled dataset`; projects and instruments fall back to their ID, then MFID.
- `PersonLink` and `ResourceIdentityLink` link every reference to a person, project, or instrument through `IdentityHoverCard`. A record's own name in its row, breadcrumbs, search results, and group headers is a plain link. Cards never hold information needed to navigate or understand the row.
- `TruncatedText` shows cut-off text in the Hub tooltip. Native `title` tooltips are used only on `<time>`.
- `MfidText` owns identifier typography; `MfidValue` adds copy. `MfidQrCode` renders the MFID with a quiet zone and a Print action, and the Identity card sizes it from its own width.
- The QR scanner shows a square viewfinder framed in the `scan-frame` role, keeps scanning after an unrecognized code, and offers `IdentifierInput` as a manual fallback.
- Timestamps display in the viewer's time zone (`Sep 6, 2026, 14:32`), formatted on the server from the `crucible_hub_time_zone` cookie, or in UTC until hydration without it. Editing uses native local date-time controls.
- One-time secrets use a read-only monospaced `IdentifierInput` with a copy action and say the value cannot be shown again. Secrets never appear in rows, notifications, links, or persistent UI state.

## Icons and actions

Routes and features import Lucide icons only through `src/components/crucible/icons.ts` or semantic icon wrappers. Icons beside 14 px text use `size-icon-label` (16 px) and beside 12 px text `size-icon-supporting` (14 px); button icons keep `buttonVariants` sizing. Decorative icons are `aria-hidden`; icons in buttons declare `data-icon="inline-start"` or `"inline-end"`. Icon-only controls need an accessible name and a tooltip and are reserved for obvious low-risk actions. No emoji or logo is a UI icon.

Recurring actions are owned by shared components:

- `EditableCardTrigger` and `EditableCardActions`: read-first card Edit, Cancel, Save, and pending feedback.
- `CreationFormActions`: creation Cancel and submit with multi-stage retry labels.
- `ManagementToggle`: ghost Edit and Done for inline list management, using `data-active` because its name already includes the visible word.
- `ResourceFullPageLink`, `CardViewAllLink`, and `ResourceCreationLink`: canonical navigation and creation links.
- `RotateCredentialAction`, `AccessGrantListActions`, and `UnlinkRelationshipAction`: key rotation, access list footers, and relationship unlinking.
- `RefreshButton`: refresh with `aria-busy`, spinning icon, and last-updated tooltip.

Button variants are summarized in [design-system.md](design-system.md#actions). Further rules:

- Outline icon-only sizes (`icon`, `icon-xs`, `icon-sm`, `icon-circle`, `table-action`) use the 3:1 `--border-strong`.
- Below the `labels` threshold, page actions shorten to icons and `CompactLabelTooltip` names them.
- Confirmation footers show only text and `PendingIcon`, not the trigger icon.
- A `Button` that renders a link sets `nativeButton={false}`.
- Feature `className` on a `Button` may set layout only (width, flex, alignment, position).
- `SegmentedControl` serves small exclusive choices; long option sets switch to `NativeSelect` below the `labels` threshold.
- `Switch` owns toggle dimensions and variants, including `warning` for Administrator view.
- Every enabled control that activates on click uses the pointer cursor.

## Shell and page composition

- The sidebar uses the square Hub logo, a light-blue surface in light mode and dark blue in dark mode, and the orange `selection` marker for the current destination. Collapsed, it shows Recent as one menu and Administrator view as a shield icon.
- Sign-in and sign-in error pages use a centered card without the sidebar.
- Page headers have one title, an optional resource icon well (`.entity-icon-well`), and actions that stay beside the title at every width. Detail pages draw a rule under the header; directories set `divider={false}`.
- Breadcrumbs stay on one line: ancestors shrink first, the current page last, and every truncated segment has a tooltip and full accessible name.
- Section tabs use 2.5 rem targets and an orange underline for the active tab; contextual creation actions and `RefreshButton` sit at the right of the tab row. Sample and dataset Overview adds `ResourceSiblingNavigationControls`.

| Width role  | Content                                           | Behavior                                                 |
| ----------- | ------------------------------------------------- | -------------------------------------------------------- |
| Action      | A short explanation and one action                | Capped track sharing a row with peers; stacks on compact |
| Reading     | Forms, access lists, members, prose               | Full width up to the reading boundary                    |
| Wide detail | Summary, identity, files, relationships, metadata | Spans within the seven-column detail grid                |
| Workspace   | Tables, search results, files, graphs             | Full content width with local containment                |
| State       | Missing, unavailable, and recovery content        | Centered state boundary                                  |

Grids use DOM order and auto-placement, never CSS `order` or masonry, so omitted cards collapse naturally. Lists that can grow without bound show 10 rows and expand in place with Show all. Lists use flat rows (`ResourceList`) or tables; cards are for contained groups, summaries, empty states, and metrics. Scientific metadata uses the searchable tree renderer with `Disclosure` rows and an expand-all control.

## Tables and collections

Tables use semantic markup without a headless table package. Column alignment comes from the `kind` prop on `TableHead`, `TableCell`, and `SortableTableHead`:

| Kind      | Content                            | Alignment               |
| --------- | ---------------------------------- | ----------------------- |
| `text`    | Names, identifiers, people, status | Start (default)         |
| `numeric` | Sizes, counts, quantities          | End, tabular numerals   |
| `date`    | Dates and times                    | Start, tabular numerals |
| `action`  | Trailing row actions               | End                     |
| `select`  | Row selection checkboxes           | Center                  |

- Sortable headers expose `aria-sort` and name the next direction; `TableSortControl` replaces them when rows stack.
- A resource or person name is the row's only navigation target. Stored file names open in a new tab and say so.
- Compact layouts reflow rows into labelled stacked records or bounded table scroll, never page-wide horizontal scroll.
- Selecting rows in a review table replaces the column headings with bulk actions.
- Every directory wraps its toolbar and results in `CollectionSection` and uses `CollectionToolbar`: what is shown on the left (type switch or search, then filters), how it is shown on the right (`Group by`, Refresh).
- `CollectionFilterPanel` is a sheet of `FilterSection`s using `FilterValuePicker`, `FilterChoice`, and `DateRangeFilter`. It edits a draft: Reset restores defaults, and Apply reads Show N with the draft's count. Applied filters show as `RemovablePill`s with Clear all.
- Directory search fields debounce 250 ms with a three-character minimum, as the top-bar search does.

## Forms and overlays

- Every control has a label, grouping, announced validation, and distinct required, optional (muted `(optional)`), disabled, read-only, pending, and failed states. Drafts survive failure.
- Identifier inputs with a live availability check use `src/features/forms/identifier-fields.tsx` and `useSlugConflict`.
- Facet-backed sample and dataset fields use `FacetCombobox`, which lists existing values with counts and offers `Create "<value>"`.
- Confirmations use `ConfirmationDialog`: `kind="dialog"` for reversible changes, `kind="alert"` for consequential or destructive ones.
- Overlays avoid stacking. A dialog over a modal sheet keeps a transparent backdrop, and the sheet dims through `data-nested-dialog-open`.
- Dialogs stay within the viewport, scroll internally, and keep their footer visible.

## Responsive layout

Window classes set the shell; content thresholds set everything inside it. Both are tokens in `src/styles.css` (`--breakpoint-*`, `--container-*`), `src/lib/window-class.ts` mirrors the window classes for scripts, and the browser reports its class in the `crucible_hub_window` cookie so the server renders the right navigation.

| Window class | Width                             | Navigation                    | Inspector           | Top bar and margin                                            |
| ------------ | --------------------------------- | ----------------------------- | ------------------- | ------------------------------------------------------------- |
| compact      | below `--breakpoint-md` (48 rem)  | drawer                        | modal sheet         | icon-only Create, avatar only, no shortcut hint; 16 px margin |
| medium       | from `md` (48 rem)                | icon rail, expandable unsaved | modal sheet         | full top bar; 24 px margin                                    |
| expanded     | from `lg` (64 rem)                | saved sidebar choice          | non-modal overlay   | full top bar; 32 px margin                                    |
| wide         | from `--breakpoint-wide` (90 rem) | saved sidebar choice          | docked preview pane | full top bar; 32 px margin                                    |

The side margin is `--page-margin`, used through the `page-margin` utility by the top bar, page, footer, and Back to top. Vertical page spacing stays at `--spacing-page-block` (24 px) at every width.

Inside the shell, `main` is the named `content` container, and cards, sheets, dialogs, field groups, and tables are containers too. Queries measure the content box.

| Threshold         | Width  | Used for                                 |
| ----------------- | ------ | ---------------------------------------- |
| `fields`          | 22 rem | Two fields or a label beside its value   |
| `identifier-icon` | 26 rem | The MFID field icon                      |
| `table-columns`   | 30 rem | Optional table columns                   |
| `fields-wide`     | 34 rem | Three fields side by side                |
| `labels`          | 42 rem | Page action labels; below it, icons only |
| `split`           | 48 rem | Page grids split into columns            |
| `directory-split` | 56 rem | Group directory beside its table         |
| `table-detail`    | 56 rem | Processing table detail columns          |

## Resource inspector

The inspector is one adaptive shadcn Sheet whose mode follows the window class above ([decision 0037](../decisions/0037-adapt-resource-inspector-to-viewport.md)); URL and history behavior are in [decision 0008](../decisions/0008-inspect-linked-resources-in-place.md).

- Non-modal modes have no backdrop. An outside press on nothing interactive or Escape closes it; scrolling and focus movement do not, and its scrolling stays inside it.
- The docked pane keeps the last preview while navigating, never shifts the layout, shows a hint while empty, and can be hidden from the top bar.
- A top bar holds Back (through in-panel history, or close) and Close. The header shows the resource icon well, name (two lines at most), MFID, any deletion-request status, and Open.
- Sections: Context, Thumbnails (datasets), Files (datasets, 10 at most before expanding), Relationships (no editing), and Scientific metadata. Sample and dataset footers add Graph and, when allowed or pending, Delete.
- Opening focuses the heading; closing restores focus to the trigger or a stable heading without moving the page.

## Resource graphs

Behavior is in [decision 0026](../decisions/0026-explore-bounded-resource-graphs.md) and the graph controls in [information architecture](information-architecture.md#sample-and-dataset). Presentation:

- React Flow with ELK Layered in a worker, on a recessed `--graph-surface` with `--graph-card` nodes. All dimensions, colors, line styles, zoom limits, and spacing come from tokens.
- Nodes are neutral with a `--border-strong` edge; the resource icon badge carries type, hover tints the edge with the resource role, and the current resource has the selection edge and a Current label.
- Lineage edges are solid with rounded steps and open arrowheads; associations are dashed and undirected.
- Expansion buttons (`icon-circle`) attach to the node edge in the direction they expand.
- On touch, one finger scrolls the page outside fullscreen and two fingers pan and zoom. Tapping an unselected node highlights it; a second tap opens the inspector.
- Tooltips and menus portal into the graph surface in fullscreen.

## Feedback and recovery

- Pending states keep breadcrumbs, navigation, controls, labels, headings, and table headers visible and replace only unresolved values with shape-matched skeletons (`PanelState`, `PanelUpdateError`).
- Loading, empty, unavailable, error, refreshing, stale, partial failure, disabled, permission-limited, and destructive states are distinct and announced in text.
- Paginated collections show loaded and total counts, auto-load near the end with a `Load more` fallback, stop on error while keeping loaded rows, and offer Back to top.
- Placeholder data never bridges incompatible ownership, filter, scope, type, status, or search contexts.
- Errors stay in their panel, row, file, dialog, or field, formatted by the shared safe formatter so correlation references remain. Route error boundaries keep the nearest stable shell and reload the document on Vite preload errors.
- Toasts acknowledge short completed mutations whose result is already visible. Validation, errors, warnings, progress, destructive outcomes, partial completion, one-time credentials, and copy feedback stay inline.

## Accessibility and validation

Target WCAG 2.2 AA in both themes: keyboard operation without traps, visible unobscured focus, 4.5:1 text and 3:1 large text and boundaries, 200 percent zoom, text-spacing overrides, reflow at 320 CSS px, target sizes, announced async status, correct landmarks and semantics, and nothing that requires color, hover, drag, precise pointing, or animation. Keyboard shortcuts are listed in the Shortcuts dialog and never fire while typing or inside a dialog. Graphs have a non-visual alternative through focusable nodes, the Relationships card, and the inspector.

Validation uses the fixture pages, `npm run design:check` (token policy, raw buttons, uncatalogued icons, and contrast for every role pair in both themes), component tests, and the Playwright suite in `tests/e2e`. Screenshots are local review artifacts and are not committed.
