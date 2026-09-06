# 0006: Use Base UI Primitives for shadcn/ui

Status: Accepted

Date: 2026-09-02

## Context

shadcn/ui supports multiple primitive libraries whose composition APIs and component implementations differ. Hub needs one explicit baseline before components are installed because mixing implicit defaults would make component updates, accessibility validation, and domain-component composition harder to reason about.

The current supported choices include Base UI, Radix UI, and React Aria. Radix is mature and remains supported. React Aria has strong accessibility foundations but became a first-class shadcn base recently. Base UI is the current shadcn default and recommendation for greenfield projects.

## Decision

Use Base UI as the primitive base for Hub's shadcn/ui components.

- Pin the base explicitly in `components.json` rather than relying on a changing CLI default.
- Use Base UI composition APIs such as `render` and `nativeButton` as generated and documented for the pinned shadcn version.
- Keep Base UI imports behind owned `components/ui` primitives and `components/crucible` domain components.
- Treat generated shadcn source as reviewed application code.
- Do not mix Radix or React Aria implementations into the same component layer without a new decision.

## Consequences

- Hub follows the maintained greenfield path recommended by shadcn/ui.
- Component generation and documentation have one predictable API shape.
- Hub must test focus, keyboard, pointer, screen-reader, overlay, and form behavior rather than assuming the primitive choice guarantees the complete experience.
- Domain components reduce the cost of a future primitive migration, but they do not make such a migration automatic.
- Upstream component updates require a reviewed diff because Hub owns the installed source.

## Alternatives considered

### Radix UI

Radix is mature, widely used, and fully supported by shadcn/ui. It is not selected because Hub is greenfield and has no installed Radix surface to preserve while shadcn recommends Base UI for new projects.

### React Aria

React Aria offers a strong accessibility-oriented model and is now a first-class shadcn base. It is not selected because that integration is newer and Hub does not currently require behavior that outweighs following the default supported path. It remains a valid reconsideration if Phase 0 exposes a Base UI accessibility or interaction blocker.

### Mix primitive libraries by component

This can select a local favorite for each interaction but creates inconsistent composition, state, styling, testing, and update behavior. Hub uses one base unless a future exception has a documented boundary and migration cost.

## Validation

- Initialize shadcn with Base UI explicitly and record the resolved configuration.
- Verify every installed primitive used by the shell and first vertical slice through keyboard, focus, pointer, screen-reader, theme, and responsive checks.
- Preview upstream component diffs before updates and preserve reviewed Hub adaptations.
- Reconsider this decision if a required interaction cannot meet accessibility, performance, or maintenance criteria without bypassing the primitive.

## References

- [shadcn Base UI default announcement](https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default)
- [shadcn React Aria announcement](https://ui.shadcn.com/docs/changelog/2026-07-react-aria)
- [shadcn skills](https://ui.shadcn.com/docs/skills)
