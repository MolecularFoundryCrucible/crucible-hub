# Crucible Hub Design System

Status: Active quick reference

Date: 2026-10-20

Read this before building or changing any screen. The detailed rules live in [`design-system-reference.md`](design-system-reference.md); the live visual version is `/hub/fixtures/design-system` ([`design-fixtures.md`](design-fixtures.md)). `npm run design:check` enforces most of what follows.

## Principles

- The data is the hero. Values, files, metadata, MFIDs, and timestamps carry the visual weight; the interface recedes.
- Color means something or it is not there: resource type, state, access, selection, and the one main action. Never decoration.
- Calm and dense: neutral surfaces, few borders, quiet controls, tabular numerals for changing numbers, monospace for identifiers.
- Both themes get equal care. Dark mode is designed, not inverted.
- Accessibility is a release property: WCAG 2.2 AA in both themes.

## Brand colors, one job each

| Color               | Value     | Job                                                                                    | Never                                        |
| ------------------- | --------- | -------------------------------------------------------------------------------------- | -------------------------------------------- |
| Crucible dark blue  | `#031e2d` | Ink and primary action in light mode; sidebar in dark mode                             | Large decorative fills                       |
| Crucible light blue | `#a8c4cd` | Quiet surfaces in light mode (sidebar, selected, pressed); primary action in dark mode | Text or thin lines on light surfaces (1.8:1) |
| Crucible orange     | `#ff6600` | "You are here" and "this is selected": nav marker, active tab, current graph node      | Buttons, status, stripes, glows              |

On light surfaces orange uses the darkened selection step (`--palette-orange-6`, 4.4:1). Resource-type colors (dataset, sample, project, instrument, person, service account, file) and status colors (success, warning, info, destructive) are separate roles and never borrow brand colors.

## Tokens

Two layers, both only in `src/styles.css`:

1. **Palette** (`--palette-neutral-*`, `--palette-blue-*`, `--palette-orange-*`): raw values. Only roles reference them.
2. **Roles**: named by job, swapped per theme. Components and features use role utilities only (`bg-card`, `text-muted-foreground`, `border-border-strong`).

| Need                                  | Role                                                                            |
| ------------------------------------- | ------------------------------------------------------------------------------- |
| Page, card, popover surface           | `background`, `card`, `popover`                                                 |
| Body and secondary text               | `foreground`, `muted-foreground`                                                |
| Divider, card edge                    | `border`                                                                        |
| Input or icon-only control edge (3:1) | `border-strong`, `input`                                                        |
| Text-button edge (soft)               | `action-border` on `action-surface`                                             |
| Hover, pressed, selected              | `action-hover`, `action-pressed`, `secondary`                                   |
| Main action                           | `primary`, `primary-hover`, `primary-foreground`                                |
| Current location, selection marker    | `selection`                                                                     |
| Focus ring                            | `ring`                                                                          |
| Dialog and sheet backdrop             | `overlay`                                                                       |
| State                                 | `success`, `warning`, `info`, `destructive` (tinted surface plus semantic text) |
| Resource type                         | `resource-*`                                                                    |

A missing role is a design-system change in `src/styles.css`, never a local color, arbitrary value, or inline `color-mix`. Tailwind's default palette is disabled.

## Actions

| Tier        | Variant                            | Use for                                                      | Examples                                                       |
| ----------- | ---------------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------- |
| Primary     | `default`                          | The one main action of a view, or the commit ending a flow   | Save, Create, Submit, page-header Create                       |
| Secondary   | `outline`                          | Deliberate actions that change data or open a flow that will | Add files, Choose project, Make private, Cancel                |
| Tertiary    | `ghost`                            | Frequent, reversible, mode-entering, or navigational actions | Card Edit, Edit/Done, Refresh, copy, print, row open, view all |
| Destructive | `destructive`, `destructive-solid` | Remove, revoke, delete; solid only for the final confirm     | Remove access, Confirm delete                                  |
| Warning     | `warning`                          | Administrator view controls only                             | Administrator view                                             |

- One primary per view. The top-bar Create menu is chrome and stays outline.
- Create follows position: solid in a page header, outline in a toolbar, card, or the top bar.
- Pick by stakes and frequency. When in doubt, choose the quieter tier.
- Icon-only buttons need an accessible name and a tooltip; icon-only outline buttons get the strong border automatically.
- Icons beside text use `size-icon-label` (16 px) with 14 px text and `size-icon-supporting` (14 px) with 12 px supporting text; never a raw `size-*` for identity icons.
- No other variants exist. TypeScript rejects anything else.

## Decoration

- No accent stripes, colored top or left bars, gradient glows, or colored card borders to make something look designed.
- Identity comes from the resource icon in its tinted icon well, the title, and content.
- Cards are for contained groups; flat rows and tables are the default for lists.

## Do and don't

| Do                                                                               | Don't                                                    |
| -------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `<Button variant="ghost">Edit</Button>` on a read-first card                     | An outlined or solid Edit competing with the card's data |
| Two equal page-header actions solid side by side (Create sample, Create dataset) | A solid action in the top bar and another in the header  |
| `bg-secondary` via `aria-current="page"` for a selected list item                | A custom selected color in feature code                  |
| Status as `<Badge variant="warning">Retrying</Badge>`                            | Orange text or icons to signal a warning                 |
| Add a role to `src/styles.css` when a job is unserved                            | `bg-[color-mix(...)]` or a hex value in a component      |
| Save, Create, Print                                                              | "Save scientific metadata", filler helper text           |

## Checks

- `npm run design:check`: rejects raw colors, inline styles, arbitrary values, primitive typography, raw buttons, and visual `Button` overrides outside `src/components/ui`, then checks every role pair for WCAG 2.2 AA contrast in both themes.
- `tests/production/design-system.spec.ts`: the fixture page shows the palette, roles, actions, and badges in light and dark.
