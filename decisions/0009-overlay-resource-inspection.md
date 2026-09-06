# 0009: Overlay Resource Inspection

Status: Accepted

Date: 2026-09-04

Supersedes: The responsive modality and reserved desktop space choice in [decision 0008](0008-inspect-linked-resources-in-place.md). Its navigation, Query ownership, and privacy decisions remain unchanged.

## Context

User review clarified that inspecting a relationship should not resize or rearrange the working page. Clicking outside the inspector should close it on desktop as well as compact screens.

## Decision

Use the owned Sheet as a modal right-side overlay at every viewport width. Preserve the main page's layout and scroll position without reserved panel space or preview-dependent column changes. The semantic inspector width token controls only the panel, bounded by the viewport.

Use Base UI's native backdrop, outside dismissal, focus containment, scroll locking, and Escape handling. Outside dismissal follows the same validated close navigation as the Close control. The first outside click dismisses the panel without activating an obscured page control. Restore focus to the initiating control or stable main heading. Do not implement custom click-away listeners or breakpoint-dependent modality.

## Consequences and validation

The main page stays mounted and visible behind the overlay but cannot be operated until the inspector closes. Native preview links inside the inspector still support relationship exploration and full-page navigation. Existing URL, bounded history, cache, and privacy behavior is unchanged.

Browser coverage must assert unchanged main-content geometry, outside-click dismissal, focus restoration, Escape, compact reflow, and persistent main-page identity. Review wide-light and compact-dark visual baselines. The [roadmap](../docs/roadmap.md#resource-inspector-slice) owns completion evidence.
