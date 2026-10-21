# Public data filter

Date: 2026-10-20

## Intent

Lists in the Hub currently include every sample and dataset the viewer can read, including records that are readable only because someone made them public. For an active Crucible user, those scattered public samples and datasets from strangers are noise in their first impression of Data and Home.

By default, lists should show what the viewer is actually involved in. Public data from others stays fully reachable: a shared MFID, link or QR code opens normally, and anyone (especially people with no data of their own) can deliberately include public data to browse what others have published.

## Goals

- Sample and dataset lists, group directories and search hide public-only records by default.
- One filter, "Public data from others", brings them back in any of those places.
- A saved account preference decides whether that filter starts on or off.
- Direct access never changes.

## Non-goals

- Project and instrument lists: the API already limits non-admin project lists to the viewer's projects, and instruments are a shared directory. No change.
- Recently viewed: it lists what the viewer opened, so no filter.
- Access control: this only changes which records lists show, never what can be opened.
- A separate "public data" section or page.

## Anti-goals

- A shared MFID, link, QR code, graph node or relationship that stops opening a public record.
- Counts (totals, group counts) that disagree with the rows shown.
- Confusing the new filter with the existing Visibility filter, which is about how a record is shared, not why the viewer can see it.
- A new user with no data facing empty lists with no hint that public data exists.

## API (decided with crucible-api, live on staging 55ae502 and production 6c76f13)

- Query parameter `affiliation`, repeatable; new value `member`. Absent means no narrowing (public data included). The Hub sends `affiliation=member` to exclude public-only records.
- `member` means the caller reaches the record through their own grant: personal, a project they belong to, an instrument group, or a custom group. A public record in the caller's own project counts as member.
- Supported on GET `/datasets`, `/samples` (including cursor pagination; part of the cursor fingerprint), `/datasets/search`, `/samples/search`, `/datasets/facets`, `/samples/facets`.
- Totals (`include_total=true`) and facet counts use the same predicate as the items.
- Independent of `visibility` and `project_scope`; they combine with AND.
- Applies to platform admins in normal and elevated mode (narrows to their own grants). User decision: in Administrator view the Hub never sends `member`, and the checkbox and pill are hidden, so admin view always shows everything readable.
- Not derivable from capabilities: `effective_role` includes the public path. The Hub relies on the filter only.
- `/resources/metadata/search` also accepts `affiliation` (`owner`, `member`; staging aff4ab8, production e37a512). It narrows dataset and sample results only; project and instrument results are unchanged. The route is slow for common terms, so metadata mode keeps its loading state.
- The Hub pins the contract at production e37a512.

## User decisions

- **Placement:** the filter lives in the Filters panel, in an "Include" section, as a "Public data from others" checkbox.
- **Pill:** whenever public data is included, whether from the viewer's default or chosen on that list, the active-filter row shows a short removable pill: **Public ×**. The × turns it off for that list. A viewer whose default is on therefore always sees the pill, which is honest about what the list contains.
- **Clearing:** "Clear" and "Clear all" remove it like any other filter, which returns it to the viewer's saved default.
- **Preference:** Preferences gets an "Include public data from others" toggle, off by default, in the Data section. It sets the filter's starting value everywhere it applies. It never locks the filter.
- **Links:** like the Hub's other filters, an explicit value is part of the URL. A link without it uses the opener's own default.
- **Empty search:** when a search returns no samples or datasets and the filter is off, the empty state offers **Include public data**, which retries that search with the filter on. It does not change the saved preference.

## Where it applies

| Surface                                                                               | Endpoint                              | Behavior                                                                                                           |
| ------------------------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Data (samples, datasets), flat and grouped                                            | `/samples`, `/datasets`, `/…/facets`  | Filter in the Filters panel; default from preference                                                               |
| Project data                                                                          | same, with `project_scope`            | Same filter; combines with the project scope filter                                                                |
| Instrument data                                                                       | same, scoped by instrument            | Same filter                                                                                                        |
| Home "Recently added data"                                                            | `/samples`, `/datasets`               | Follows the preference (no Filters panel on Home); the existing "everyone / only mine" choice keeps working on top |
| Top-bar search and search page, name search                                           | `/samples/search`, `/datasets/search` | Follows the preference; empty-state retry offers Include public data                                               |
| Search page, metadata mode                                                            | `/resources/metadata/search`          | Same as name search                                                                                                |
| Projects, instruments, recently viewed, detail pages, graph, relationships, QR, links | unchanged                             | No filter                                                                                                          |

## Behavior details

- **URL value:** the filter's URL value is tri-state: absent (use the preference), on, or off. Applying filters or removing the pill writes an explicit value only when it differs from the viewer's default, so URLs stay clean for the common case. My call; the builder may choose a different encoding if it keeps these three states.
- **Pill naming:** the new pill reads **Public**; the existing Visibility pill reads **Visibility: Public**. Both can appear together.
- **New users:** when a viewer's sample and dataset lists are empty with the filter off, the empty state offers **Include public data** (same action as search). My call, from the anti-goal about empty lists.
- **Group directories:** group counts come from facets with the same filter, so counts match rows.
- **Caching:** the filter value is part of every affected query key, so switching it never shows the other mode's cached rows.
- **Fixtures:** fixture mode must model public-only records (a few samples and datasets readable only through the public group) so the filter is testable without the API.

## Designer calls (reviewable)

- **Ownership filter:** "Owned by me" (Data) and Home's "Mine" already send `affiliation=owner`, and repeated values OR together, so sending `member` alongside would undo them. When an ownership filter is active, the Hub sends only `owner`, and the Public checkbox is disabled (owned records are never public-only).
- **Search state:** the search page keeps the filter in its URL like other filters, and shows the same **Public ×** pill above results when it is on. The top-bar quick search does not filter inline; its empty state's **Include public data** opens the search page with the filter on. The offer appears when the sample and dataset groups are empty, even if people, projects or instruments matched, because only samples and datasets are affected. Empty-query browse mode counts as a search.
- **Home empty state:** when Home's "Recently added data" is empty with the filter off, it offers **Include public data**, which opens Data with the filter on. Home itself follows only the preference.

## Left to the builder

- Exact wording of the Preferences description and empty states, within the "no filler text" rule.
- Exact URL parameter name and encoding, within the tri-state rule above.
- Whether the "Include" section sits first or last in the Filters panel.
- Fixture data layout for public-only records.
