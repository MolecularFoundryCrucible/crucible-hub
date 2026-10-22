# 0013: Use Resource Identity for Collection Preview

Status: Accepted

Date: 2026-09-05

Updated: 2026-10-22

Amends: [decision 0010](0010-inspect-project-data-in-place.md) and [decision 0012](0012-inspect-global-data-in-place.md)

## Context

Project and global Data tables currently place a canonical resource-name link and a visible Preview link inside the same Name cell. This gives equal visual weight to two destinations, crowds the most important column, and makes the common exploratory action feel secondary. The collection still needs native full-page navigation with an unambiguous destination and ordinary browser modifier behavior.

Projects and instruments also appear as contextual entities around samples and datasets. Leaving the current collection just to confirm their identity, status, or location interrupts exploration, while loading their members, samples, or datasets inside the inspector would make one contextual action unexpectedly expensive.

## Decision

In project and global Data tables, the resource name opens the existing preview inspector. The semantic type icon and the supporting sample type or dataset measurement stay plain, selectable text, so identifiers can be selected and copied; this replaced the original whole-identity link on 2026-09-23. Do not attach navigation to the table row because other cells may contain independent links or selectable content.

Add one fixed, narrow trailing action column. Its header is visually hidden but named Open for assistive technology. Each row contains a centered forward-navigation icon with a tooltip and resource-specific accessible name. It is a native canonical link, supports ordinary browser modifier behavior, and does not carry preview or collection search state into the resource page. The column reserves stable geometry and must not introduce horizontal page scrolling.

The inspector footer continues to use the same canonical destination component in a labeled Open presentation followed by the forward-navigation icon. The shared component owns resource-kind routing for samples, datasets, projects, and instruments while presentation remains appropriate to its location.

Projects and instruments may be inspected when they are encountered as sample or dataset context. Their preview is intentionally bounded to already supported detail fields and does not request project members, project collections, instrument datasets, files, or speculative counts. Project and instrument directory names remain canonical full-page links because entering that entity workspace is the primary action in those directories.

## Privacy review

This change adds no URL fields, stored data, telemetry, third-party hosts, personal-data projections, or credential handling. The existing validated preview MFID, identity-scoped Query, bounded browser history trail, and independent API authorization continue to apply.

## Validation

- Verify clicking the resource identity opens preview while the trailing arrow follows the canonical full page.
- Verify keyboard access, focus restoration, accessible names, tooltip behavior, and native new-tab semantics.
- Verify the action column and all icon states reserve stable geometry without horizontal page overflow.
- Verify project and instrument preview reads reuse the generic resource-detail Query and never initiate their collection, member, dataset, file, or download requests.
- Verify project and instrument directories retain canonical full-page navigation.
