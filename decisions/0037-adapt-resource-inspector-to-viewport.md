# 0037: Adapt the Resource Inspector to the Viewport

Status: Accepted

Date: 2026-10-22

Supersedes: [decision 0009](0009-overlay-resource-inspection.md). The navigation, Query ownership, and privacy decisions of [decision 0008](0008-inspect-linked-resources-in-place.md) remain unchanged.

## Context

[Decision 0009](0009-overlay-resource-inspection.md) made the inspector a modal overlay at every width, so the page behind it could not be used until the inspector closed. In use, people inspect one resource after another from a collection or graph and want to keep working with the page while the inspector is open. Wide screens have room to show both side by side. Docking on wide screens shipped in October 2026, and the design system reference already describes a non-modal inspector at medium widths, so 0009 no longer matches the Hub.

## Decision

The inspector is one owned Sheet whose modality follows the viewport:

- **Compact (below 48 rem):** a modal sheet that covers the page, with Base UI's backdrop, focus containment, scroll locking, and Escape handling.
- **Medium (48 rem up to the `--breakpoint-inspector` of 90 rem):** a non-modal overlay without a backdrop. The page stays interactive. Pressing a non-interactive area outside closes the inspector; pressing a link, control, or graph node outside completes that action without a competing close. Moving focus out of the inspector does not close it. Escape closes it.
- **Wide (90 rem and above):** docked beside the content. The page reserves `--spacing-inspector-width` for the panel, and outside presses do not close it.

Every mode uses the same preview URL, history, Query, and privacy behavior from [decision 0008](0008-inspect-linked-resources-in-place.md), the `sheet` motion role from [decision 0036](0036-centralize-motion.md), and keeps its content while it slides out. Focus moves to the inspector title on open and returns to the initiating control or the main heading on close, unless the close came from activating something on the page.

## Consequences

- People can work through a collection or graph with the inspector open on medium and wide screens.
- The inspector has three behaviors to test instead of one, and outside-press handling distinguishes interactive targets.
- Compact screens keep the focused, modal experience where the inspector covers the page.

## Validation

Browser checks cover each mode: modal focus containment and backdrop on compact widths, outside dismissal and interactive pass-through on medium widths, docked layout without dismissal on wide widths, Escape in every mode, focus restoration, and that the content stays visible through the close animation.

## Alternatives considered

- **Keep the modal overlay at every width (decision 0009):** simple and consistent, but blocks the page that people are working through.
- **Always dock:** loses too much width on medium screens and does not fit compact screens.
