# 0003: Own the Hub Design System with shadcn/ui

Status: Accepted

Date: 2026-09-02

## Context

Hub needs a polished and consistent interface inspired by Crucible Lens without reproducing a phone layout or inheriting the visual defaults of a large packaged component framework. The system must remain understandable and maintainable as resource management, metadata, tables, graphs, uploads, and administrative workflows expand.

shadcn/ui distributes component source into the application rather than hiding it behind a package API. This enables direct design-system ownership but also makes Hub responsible for accessibility, consistency, and maintenance of the installed components.

## Decision

Use shadcn/ui and Tailwind CSS as the component foundation, governed by an owned Crucible design system.

The design system has five layers:

1. Primitive scales for palette, typography, spacing, radius, elevation, motion, breakpoint, and density values.
2. Semantic tokens for roles such as background, surface, foreground, primary, muted, warning, destructive, border, focus, and resource identities.
3. Controlled shadcn primitives under `components/ui`.
4. Reusable Crucible domain components under `components/crucible`.
5. Feature screens that compose domain components.

Feature code must not introduce hardcoded colors, shadows, font sizes, spacing, radii, breakpoints, z-index values, or motion durations. A missing value is a design-system gap to resolve, not permission to add a local constant.

Semantic foreground and background pairs define contrast. Light, dark, and system themes use the same semantic roles. Domain state such as error, warning, success, permission, lifecycle, and resource type must not be communicated by color alone.

## Consequences

- Hub can develop a distinct Crucible identity without extensive third-party overrides.
- The application owns and reviews installed component code.
- Upstream shadcn changes do not arrive automatically.
- Accessibility regression testing is mandatory after modifying primitives.
- Domain components become the primary consistency mechanism across screens.
- Tailwind utility use requires policy so feature code does not become an undocumented token system.
- An automated check must restrict primitive values to designated token and theme files.

## Alternatives considered

### Material UI

Broad, mature, and centrally maintained with strong theme support. It reduces internal component ownership but makes a distinctive non-default visual language more dependent on framework overrides.

### Handwritten components without a foundation

Provides maximum control but duplicates accessible interaction patterns and creates unnecessary implementation and maintenance risk.

### Unrestricted shadcn component use

Fast initially but allows generated components and page-local Tailwind values to diverge. The controlled primitive and domain-component layers are required.

## Required follow-up

Create `docs/design-system.md` before the first product screen. It must define token names and ownership, supported component variants and states, responsive behavior, accessibility checks, icon policy, data-visualization tokens, and automated enforcement.

## References

- [shadcn/ui introduction](https://ui.shadcn.com/docs)
- [shadcn/ui theming](https://ui.shadcn.com/docs/theming)
