# Public Data Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hide samples and datasets that are readable only because they are public, unless the viewer includes them through a filter whose starting value is a saved preference.

**Architecture:** The API's `affiliation=member` narrows lists, facets, and searches. The Hub computes one effective affiliation per request from three inputs (ownership filter, public-data filter or preference, privilege mode) in a pure resolver, passes it through the existing `affiliation` collection option (so it is part of every query key), and adds the UI: a Filters-panel checkbox and **Public** pill, a Preferences toggle, and empty-state offers.

**Tech Stack:** TanStack Start/Router/Query, zod, openapi-fetch, Vitest, Playwright (production config).

**Spec:** `docs/superpowers/specs/2026-10-20-public-data-filter-design.md`

## Global Constraints

- Contract pinned at crucible-api production `e37a512` (metadata search affiliation; includes `member` on lists, facets, search).
- Default for every viewer is public data excluded (`affiliation=member`); preference `hub.include_public_data` (boolean, absent = false) flips the starting value.
- Administrator view (`privilegeModeFromScope(scope) === "elevated"`) never sends `member`; the checkbox and pill are hidden there.
- Ownership ("Owned by me", Home "Mine") sends only `owner`; the Public checkbox is disabled while it is active.
- URL parameter `publicData`: `"include" | "exclude"`, absent means the viewer's default. Written only when it differs from the default.
- Pill text exactly `Public`; checkbox label exactly `Include public data`; offer button exactly `Include public data`; preference title exactly `Include public data`.
- Projects, instruments, recently viewed, detail pages, graph, relationships, QR and direct links are unchanged.
- No em dashes; no filler UI text; no code comments unless the why is non-obvious.
- Before pushing: `npm run validate:static`, `npm run audit`, `npm run test:production`. Never `npm run test:browser` or a second Vite dev server.

## Review Focus

- A public dataset inside the viewer's own project must still appear with the default filter (fixture must include one).
- Switching the filter must never show the other mode's cached rows or counts (affiliation in query keys, cursor chains, facets).
- Clear all with a default of "include" must leave the Public pill visible; with a default of "exclude" it must remove it.
- Admin view must show public-only records even when the preference is off.
- Opening a public-only record by MFID, link or search result must still work with the filter off.

---

### Task 1: Contract, resolver, and query plumbing

**Files:**

- Modify: `contracts/crucible-api.json`, `contracts/crucible-api.lock.json`, `src/generated/crucible-api.ts` (pin `e37a512`, `npm run api:generate`)
- Create: `src/data/crucible/public-data.ts`, `src/data/crucible/public-data.test.ts`
- Modify: `src/data/crucible/collection-query.ts` (`collectionAffiliationSchema = z.enum(["owner", "member"])`)
- Modify: `src/data/crucible/data.server.ts` (pass `affiliation` on `/samples`, `/datasets`, `/samples/facets`, `/datasets/facets`; fixture readers honor `member`)
- Modify: `src/data/crucible/search.server.ts`, `src/data/crucible/search.functions.ts` (`affiliation?: "member"` in search and metadata search input; passed to `/samples/search`, `/datasets/search`, `/resources/metadata/search`)
- Modify: `src/data/crucible/fixtures/demo-workspace.ts` (export `fixturePublicOnlyMfids: ReadonlySet<string>`; add one public-only sample and one public-only dataset owned by another person outside the viewer's projects, and mark an existing dataset in the viewer's project `public: true`)
- Test: `src/data/crucible/data.server.test.ts`, `src/data/crucible/search.server.test.ts`

**Interfaces:**

- Produces: `resolveCollectionAffiliation(input: { ownership?: "owner"; publicData?: "include" | "exclude"; includePublicByDefault: boolean; elevated: boolean }): "owner" | "member" | undefined`
- Produces: `effectivePublicData(publicData: "include" | "exclude" | undefined, includePublicByDefault: boolean): boolean` (true when public data is included)
- Produces: `publicDataSearchValue(include: boolean, includePublicByDefault: boolean): "include" | "exclude" | undefined` (undefined when equal to the default)
- Produces: collection and search inputs accept `affiliation: "owner" | "member"`.

- [ ] **Step 1: Write failing tests.** `public-data.test.ts`: ownership wins (`{ ownership: "owner", publicData: "include" }` → `"owner"`); elevated returns `undefined` for any public value; default exclude → `"member"`; `publicData: "include"` → `undefined`; `includePublicByDefault: true` with no value → `undefined`, with `"exclude"` → `"member"`; `publicDataSearchValue(true, true)` → `undefined`, `(false, true)` → `"exclude"`, `(true, false)` → `"include"`. `data.server.test.ts`: fixture `readWorkspaceDatasets({ affiliation: "member" })` excludes every MFID in `fixturePublicOnlyMfids` and keeps the public dataset in the viewer's project; API mode sends `affiliation=member` in the query for `/datasets`, `/samples/facets`. `search.server.test.ts`: API mode sends `affiliation=member` to `/datasets/search` and `/resources/metadata/search`.
- [ ] **Step 2:** `npx vitest run src/data/crucible/public-data.test.ts src/data/crucible/data.server.test.ts src/data/crucible/search.server.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Pin the contract, extend the enum, implement the resolver and pass-through, extend fixtures. Fixture `member` filter: exclude items whose MFID is in `fixturePublicOnlyMfids`.
- [ ] **Step 4:** Same command. Expected: PASS. Then `npx tsc --noEmit` clean.
- [ ] **Step 5:** Commit `feat(data): add the member affiliation for public data filtering`.

### Task 2: Preference

**Files:**

- Modify: `src/data/crucible/preferences.ts` (`include_public_data: z.boolean().optional().catch(undefined)` in `hub`; patch schema `z.boolean().nullable().optional()`)
- Create: `src/features/preferences/public-data.ts` (`useIncludePublicByDefault(): boolean`)
- Modify: `src/routes/_app.preferences.tsx` (Switch row in the Data section)
- Test: `src/data/crucible/preferences.test.ts` (or existing preferences test), `src/routes/_app.preferences` test if present

**Interfaces:**

- Consumes: `useAccountPreferences()`.
- Produces: `useIncludePublicByDefault(): boolean` (false when unset).

- [ ] **Step 1: Write failing tests.** Schema parses `{ hub: { include_public_data: true } }` and drops invalid values; the hook returns false with no preferences and true when set.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement; Preferences row title `Include public data`, description `Sample and dataset lists and search start with public data included.`, Switch updates `hub.include_public_data`.
- [ ] **Step 4:** Run tests and `npx tsc --noEmit`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(preferences): add the include public data default`.

### Task 3: Data page

**Files:**

- Modify: `src/features/data/data-filter-state.ts` (search field `publicData`; resolution exposes `publicData`), `src/features/data/data-filters.tsx` (Include section checkbox, disabled when ownership is set, hidden when elevated; pill `Public`), `src/routes/_app.data.tsx` (loader and component compute affiliation with `resolveCollectionAffiliation`; empty state offers `Include public data` when lists are empty and public data is excluded)
- Test: `src/features/data/data-filter-state.test.ts`, `src/features/data/data-filters.test.tsx` (create if absent)

**Interfaces:**

- Consumes: Task 1 resolver and helpers; Task 2 hook.

- [ ] **Step 1: Write failing tests.** Filter state round-trips `publicData`; pill `Public` shows when the effective value is include (both explicit and default-on); removing the pill writes `exclude` when the default is include and clears the param when the default is exclude; Clear all removes `publicData`; checkbox disabled when `affiliation: "owner"`; checkbox and pill absent when elevated.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. The loader and the component must compute the same affiliation (both read the preference through the query cache) so SSR dehydration keys match.
- [ ] **Step 4:** Run tests, `npx tsc --noEmit`, `npm run design:check`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(data): filter public data on the Data page`.

### Task 4: Project and instrument data

**Files:**

- Modify: `src/features/project-data/project-data-filter-state.ts`, `src/features/project-data/project-data-filters.tsx`, `src/routes/_app.projects.$projectMfid.index.tsx`, `src/routes/_app.instruments.$instrumentMfid.index.tsx`
- Test: `src/features/project-data/project-data-filter-state.test.ts`

**Interfaces:**

- Consumes: Task 1 and Task 2; follow Task 3's pill and checkbox behavior exactly (no ownership filter exists on these pages).

- [ ] **Step 1: Write failing tests** mirroring Task 3's state and pill cases for project data, plus an instrument page case for the loader affiliation.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run tests, `npx tsc --noEmit`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(data): filter public data on project and instrument pages`.

### Task 5: Search and Home

**Files:**

- Modify: `src/routes/_app.search.tsx` (search param `publicData`; `Public` pill above results; empty state offer when sample and dataset groups are empty; metadata mode included), `src/components/crucible/global-search.tsx` (sends the default-derived affiliation; empty state offer navigates to `/search?q=<query>&publicData=include`), `src/routes/_app.index.tsx` (Recently added uses the preference; empty state offer links to `/data?publicData=include`)
- Test: `src/routes/_app.search` tests if present, `src/components/crucible/global-search.test.tsx`, `src/routes/_app.index` tests if present
- Create: `tests/production/public-data.spec.ts`

**Interfaces:**

- Consumes: Tasks 1 and 2.

- [ ] **Step 1: Write failing tests.** Global search: empty sample and dataset groups with the filter off render `Include public data`, whose href is `/hub/search?q=tf000069&publicData=include`. Production spec: Data hides the fixture public-only dataset by default, shows it after checking `Include public data` (pill `Public` visible), and the public-only dataset still opens by direct URL; search for its name shows `Include public data` and, after clicking, the result.
- [ ] **Step 2:** Run `npx vitest run` for the unit tests and `npm run test:production` for the spec. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run both. Expected: PASS.
- [ ] **Step 5:** Commit `feat(search): filter public data in search and Home`.

### Task 6: Docs, changelog, full verification

**Files:**

- Modify: `docs/api-integration.md` (affiliation member, pin), `docs/information-architecture.md` (Data, project, instrument, search, Home behavior), `docs/design-system.md` only if a new pattern is introduced, `CHANGELOG.md`

- [ ] **Step 1:** Update docs and add the CHANGELOG Unreleased entry.
- [ ] **Step 2:** Run `npm run validate:static`, `npm run audit`, `npm run test:production`, and the database-backed server tests against a throwaway `postgres:17` on a free port. Expected: all pass.
- [ ] **Step 3:** Commit `docs: public data filter`.
