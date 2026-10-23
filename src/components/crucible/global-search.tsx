import { privilegeModeFromScope } from "@/data/crucible/query-keys"
import { resolveCollectionAffiliation } from "@/data/crucible/public-data"
import { useIncludePublicByDefault } from "@/features/preferences/public-data"
import { useEffect, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link, useLocation, useNavigate } from "@tanstack/react-router"

import { SearchIcon } from "@/components/crucible/icons"
import { PersonIdentity } from "@/components/crucible/person-identity"
import { QrScannerAction } from "@/components/crucible/qr-scanner-action"
import { ResourceIdentity } from "@/components/crucible/resource-identity"
import { ResourceTypeIcon } from "@/components/crucible/resource-type-icon"
import { SegmentedControl } from "@/components/crucible/segmented-control"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxSeparator,
} from "@/components/ui/combobox"
import { Kbd } from "@/components/ui/kbd"
import { Input } from "@/components/ui/input"
import type { IdentityScope } from "@/data/crucible/query-keys"
import { quickSearchQueryOptions } from "@/data/crucible/search.queries"
import type {
  WorkspaceSearchGroup,
  WorkspaceSearchKind,
  WorkspaceSearchResult,
} from "@/data/crucible/workspace-source"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { searchDebounceMs, searchMinQueryLength } from "@/lib/search"
import {
  isDialogKeyboardTarget,
  isEditableKeyboardTarget,
} from "@/lib/keyboard"
import { cn } from "@/lib/utils"
import { PendingIcon } from "@/components/crucible/pending-icon"

const searchScopeOptions = [
  { label: "This project", value: "project" },
  { label: "All Crucible", value: "global" },
] as const

const globalSearchKinds = [
  "person",
  "project",
  "instrument",
  "sample",
  "dataset",
] as const satisfies readonly WorkspaceSearchKind[]

const projectSearchKinds = [
  "sample",
  "dataset",
] as const satisfies readonly WorkspaceSearchKind[]

type SearchScope = "global" | "project"

export function GlobalSearch({
  projectMfid,
  projectName,
  scope,
}: {
  projectMfid?: string
  projectName?: string
  scope?: IdentityScope
}) {
  const navigate = useNavigate()
  const [query, setQuery] = useState("")
  const [searchScope, setSearchScope] = useState<SearchScope>(
    projectMfid ? "project" : "global"
  )
  const projectLabel = projectName?.trim()

  useEffect(() => {
    if (!projectMfid && searchScope === "project") setSearchScope("global")
  }, [projectMfid, searchScope])

  function showAllResults(includePublic = false) {
    const normalizedQuery = query.trim()
    if (normalizedQuery.length < 3) return
    setQuery("")
    void navigate({
      to: "/search",
      search: {
        kind: undefined,
        projectMfid: searchScope === "project" ? projectMfid : undefined,
        publicData: includePublic ? "include" : undefined,
        q: normalizedQuery,
      },
    })
  }

  const shared = {
    onQueryChange: setQuery,
    onScopeChange: setSearchScope,
    onShowAll: showAllResults,
    projectLabel,
    projectMfid,
    query,
    searchScope,
  }

  return scope ? (
    <QuickSearchControl {...shared} scope={scope} />
  ) : (
    <SearchFallbackControl {...shared} />
  )
}

type SearchControlProps = {
  onQueryChange: (query: string) => void
  onScopeChange: (scope: SearchScope) => void
  onShowAll: (includePublic?: boolean) => void
  projectLabel?: string
  projectMfid?: string
  query: string
  searchScope: SearchScope
}

function QuickSearchControl({
  onQueryChange,
  onScopeChange,
  onShowAll,
  projectLabel,
  projectMfid,
  query,
  scope,
  searchScope,
}: SearchControlProps & { scope: IdentityScope }) {
  const navigate = useNavigate()
  const location = useLocation()
  const formRef = useRef<HTMLFormElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const shortcutFocus = useRef(false)
  const highlightedItemRef = useRef<WorkspaceSearchResult | undefined>(
    undefined
  )
  const navigatedResultRef = useRef<string | undefined>(undefined)
  const [open, setOpen] = useState(false)
  const previousHrefRef = useRef(location.href)
  const normalizedQuery = query.trim()
  const debouncedQuery = useDebouncedValue(normalizedQuery, searchDebounceMs)
  const activeProjectMfid = searchScope === "project" ? projectMfid : undefined
  const kinds = activeProjectMfid ? projectSearchKinds : globalSearchKinds
  const includePublicByDefault = useIncludePublicByDefault()
  const affiliation =
    resolveCollectionAffiliation({
      elevated: privilegeModeFromScope(scope) === "elevated",
      includePublicByDefault,
    }) === "member"
      ? "member"
      : undefined
  const result = useQuery({
    ...quickSearchQueryOptions(
      scope,
      debouncedQuery,
      kinds,
      activeProjectMfid,
      affiliation
    ),
    enabled: open && debouncedQuery.length >= searchMinQueryLength,
  })
  const response =
    result.data?.query === debouncedQuery ? result.data : undefined
  const groups =
    response?.groups.filter(
      (group) => !group.error && group.items.length > 0
    ) ?? []
  const items = groups.flatMap((group) => group.items)
  const waitingForDebounce =
    normalizedQuery.length >= searchMinQueryLength &&
    normalizedQuery !== debouncedQuery
  const searching =
    normalizedQuery.length >= searchMinQueryLength &&
    (waitingForDebounce || result.isPending || !response)
  const partialFailure = response?.groups.some((group) => group.error) ?? false

  useEffect(() => {
    if (previousHrefRef.current !== location.href) {
      previousHrefRef.current = location.href
      if (open || query.length > 0) {
        finishSearch()
      }
    }
  }, [location.href])

  useSearchShortcut({
    inputRef,
    onOpen: setOpen,
    onScopeChange,
    projectMfid,
    shortcutFocus,
  })

  function finishSearch() {
    setOpen(false)
    highlightedItemRef.current = undefined
    inputRef.current?.blur()
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
    onQueryChange("")
  }

  function navigateToResult(item: WorkspaceSearchResult) {
    if (navigatedResultRef.current === item.unique_id) return
    navigatedResultRef.current = item.unique_id
    if (item.kind === "person") {
      void navigate({
        to: "/users/$userId",
        params: { userId: item.unique_id },
      })
      return
    }
    if (item.kind === "project") {
      void navigate({
        to: "/projects/$projectMfid",
        params: { projectMfid: item.unique_id },
        search: { preview: undefined },
        state: {},
      })
      return
    }
    if (item.kind === "instrument") {
      void navigate({
        to: "/instruments/$instrumentMfid",
        params: { instrumentMfid: item.unique_id },
        search: {},
        state: {},
      })
      return
    }
    if (item.kind === "sample") {
      void navigate({
        to: "/samples/$sampleMfid",
        params: { sampleMfid: item.unique_id },
        search: { fromProject: activeProjectMfid, preview: undefined },
      })
      return
    }
    void navigate({
      to: "/datasets/$datasetMfid",
      params: { datasetMfid: item.unique_id },
      search: { fromProject: activeProjectMfid, preview: undefined },
    })
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (normalizedQuery.length < 3) return
    finishSearch()
    onShowAll()
  }

  function includePublicData() {
    finishSearch()
    onShowAll(true)
  }

  return (
    <form
      aria-label="Quick search"
      className="min-w-0 flex-1 sm:max-w-sm"
      onSubmit={submit}
      ref={formRef}
      role="search"
    >
      <Button
        aria-hidden="true"
        className="sr-only"
        tabIndex={-1}
        type="submit"
      >
        Search
      </Button>
      <Combobox<WorkspaceSearchResult>
        autoHighlight={false}
        filter={null}
        inputValue={query}
        isItemEqualToValue={(item, selected) =>
          item.unique_id === selected.unique_id
        }
        itemToStringLabel={(item) => item.name}
        items={items}
        onInputValueChange={(nextQuery, details) => {
          if (
            details.reason === "input-change" ||
            details.reason === "clear-press"
          ) {
            onQueryChange(nextQuery)
            navigatedResultRef.current = undefined
            highlightedItemRef.current = undefined
            if (nextQuery.trim().length >= searchMinQueryLength) {
              setOpen(true)
            } else if (!projectMfid && details.reason === "clear-press") {
              setOpen(false)
            }
          }
        }}
        onItemHighlighted={(item) => {
          highlightedItemRef.current = item ?? undefined
        }}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen)
          if (!nextOpen) {
            highlightedItemRef.current = undefined
          }
        }}
        onValueChange={(selectedItem) => {
          if (selectedItem) {
            finishSearch()
            navigateToResult(selectedItem)
          }
        }}
        open={open}
        value={null}
      >
        <ComboboxInput
          aria-label={
            activeProjectMfid
              ? `Search ${projectLabel || "this project"}`
              : "Search Crucible"
          }
          autoComplete="off"
          className="w-full"
          maxLength={200}
          onFocus={() => {
            if (!shortcutFocus.current) {
              onScopeChange(projectMfid ? "project" : "global")
            }
            if (normalizedQuery.length >= searchMinQueryLength || projectMfid) {
              setOpen(true)
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              if (highlightedItemRef.current) {
                const target = highlightedItemRef.current
                finishSearch()
                navigateToResult(target)
              } else if (normalizedQuery.length >= searchMinQueryLength) {
                finishSearch()
                onShowAll()
              }
            }
          }}
          placeholder={
            activeProjectMfid
              ? `Search ${projectLabel || "this project"}`
              : "Search Crucible"
          }
          ref={inputRef}
          showClear={query.length > 0}
          showTrigger={false}
          endAdornment={
            <>
              {query.length === 0 ? (
                <Kbd aria-hidden="true" className="hidden sm:inline-flex">
                  {activeProjectMfid ? "Ctrl Shift K" : "Ctrl K"}
                </Kbd>
              ) : null}
              <QrScannerAction />
            </>
          }
          startAdornment={<SearchIcon aria-hidden="true" />}
        />
        <ComboboxContent
          anchor={formRef}
          className="w-(--available-width) sm:w-[max(var(--anchor-width),var(--container-md))] sm:max-w-(--available-width) lg:w-[max(var(--anchor-width),var(--container-2xl))]"
          collisionPadding={16}
        >
          {projectMfid ? (
            <div className="border-b p-2">
              <SegmentedControl
                ariaLabel="Search scope"
                onValueChange={(nextScope) => {
                  onScopeChange(nextScope)
                  setOpen(true)
                }}
                options={searchScopeOptions}
                value={searchScope}
              />
            </div>
          ) : null}
          {normalizedQuery.length < 3 ? (
            <QuickSearchStatus>
              {activeProjectMfid
                ? `Type at least 3 characters to search ${projectLabel || "this project"}.`
                : "Type at least 3 characters to search Crucible."}
            </QuickSearchStatus>
          ) : searching ? (
            <QuickSearchStatus
              className="flex items-center gap-2"
              role="status"
            >
              <PendingIcon className="size-4" />
              <span>Searching…</span>
            </QuickSearchStatus>
          ) : result.isError ? (
            <QuickSearchStatus role="alert">
              Search results are unavailable.
            </QuickSearchStatus>
          ) : items.length === 0 ? (
            <QuickSearchStatus>No matching resources.</QuickSearchStatus>
          ) : (
            <ComboboxList aria-label="Quick search results">
              {groups.map((group, index) => (
                <QuickSearchGroup
                  group={group}
                  key={group.kind}
                  onSelect={finishSearch}
                  projectMfid={activeProjectMfid}
                  separated={index > 0}
                />
              ))}
            </ComboboxList>
          )}
          {affiliation &&
          response?.groups.some(
            (group) => group.kind === "sample" || group.kind === "dataset"
          ) &&
          response.groups.every(
            (group) =>
              (group.kind !== "sample" && group.kind !== "dataset") ||
              (!group.error && group.items.length === 0)
          ) ? (
            <div className="px-1 pt-1">
              <Button
                className="w-full justify-start"
                onClick={includePublicData}
                type="button"
                variant="ghost"
              >
                Include public data
              </Button>
            </div>
          ) : null}
          {partialFailure && items.length > 0 ? (
            <QuickSearchStatus role="status">
              Some resource types could not be searched.
            </QuickSearchStatus>
          ) : null}
          <div className="border-t p-1">
            <Button
              className="w-full justify-between"
              disabled={normalizedQuery.length < 3}
              onClick={() => {
                finishSearch()
                onShowAll()
              }}
              type="button"
              variant="ghost"
            >
              <span className="flex min-w-0 items-center gap-2 truncate">
                <SearchIcon aria-hidden="true" data-icon="inline-start" />
                <span className="truncate">
                  {normalizedQuery.length >= searchMinQueryLength
                    ? `View all results for “${normalizedQuery}”`
                    : "View all results"}
                </span>
              </span>
              {normalizedQuery.length >= searchMinQueryLength ? (
                <Kbd aria-hidden="true" className="ml-2 max-sm:hidden">
                  Enter
                </Kbd>
              ) : null}
            </Button>
          </div>
        </ComboboxContent>
      </Combobox>
    </form>
  )
}

function SearchFallbackControl({
  onQueryChange,
  onScopeChange,
  onShowAll,
  projectLabel,
  projectMfid,
  query,
}: SearchControlProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const shortcutFocus = useRef(false)

  useSearchShortcut({
    inputRef,
    onScopeChange,
    projectMfid,
    shortcutFocus,
  })

  return (
    <form
      aria-label="Quick search"
      className="min-w-0 flex-1 sm:max-w-sm"
      onSubmit={(event) => {
        event.preventDefault()
        onShowAll()
      }}
      role="search"
    >
      <label className="sr-only" htmlFor="global-search-fallback">
        Search query
      </label>
      <Input
        id="global-search-fallback"
        maxLength={200}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder={
          projectMfid
            ? `Search ${projectLabel || "this project"}`
            : "Search Crucible"
        }
        ref={inputRef}
        type="search"
        value={query}
      />
    </form>
  )
}

function useSearchShortcut({
  inputRef,
  onOpen,
  onScopeChange,
  projectMfid,
  shortcutFocus,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>
  onOpen?: (open: boolean) => void
  onScopeChange: (scope: SearchScope) => void
  projectMfid?: string
  shortcutFocus: React.MutableRefObject<boolean>
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        isEditableKeyboardTarget(event.target) ||
        isDialogKeyboardTarget(event.target)
      ) {
        return
      }
      if (
        event.key.toLocaleLowerCase() !== "k" ||
        (!event.metaKey && !event.ctrlKey)
      ) {
        return
      }
      if (event.shiftKey && !projectMfid) return
      event.preventDefault()
      shortcutFocus.current = true
      onScopeChange(event.shiftKey ? "project" : "global")
      onOpen?.(true)
      inputRef.current?.focus()
      inputRef.current?.select()
      shortcutFocus.current = false
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [inputRef, onOpen, onScopeChange, projectMfid, shortcutFocus])
}

function QuickSearchGroup({
  group,
  onSelect,
  projectMfid,
  separated,
}: {
  group: WorkspaceSearchGroup
  onSelect: () => void
  projectMfid?: string
  separated: boolean
}) {
  return (
    <>
      {separated ? <ComboboxSeparator /> : null}
      <ComboboxGroup items={group.items}>
        <ComboboxLabel>
          <span className="flex items-center gap-2">
            <ResourceTypeIcon type={group.kind} />
            <span>{searchKindLabel(group.kind)}</span>
            {group.total !== null ? (
              <Badge variant="secondary">{group.total}</Badge>
            ) : null}
          </span>
        </ComboboxLabel>
        <ComboboxCollection>
          {(item: WorkspaceSearchResult) => (
            <ComboboxItem
              key={item.unique_id}
              render={quickSearchResultLink(item, projectMfid, onSelect)}
              value={item}
            >
              <QuickSearchResult item={item} />
            </ComboboxItem>
          )}
        </ComboboxCollection>
      </ComboboxGroup>
    </>
  )
}

function QuickSearchResult({ item }: { item: WorkspaceSearchResult }) {
  if (item.kind === "person") {
    return (
      <PersonIdentity
        className="min-w-0"
        person={item}
        presentation="avatar"
        size="sm"
      />
    )
  }
  return (
    <ResourceIdentity
      className="min-w-0 flex-1"
      context={item.context}
      kind={item.kind}
      name={item.name}
      presentation="collection"
      projectId={item.projectId}
    />
  )
}

function quickSearchResultLink(
  item: WorkspaceSearchResult,
  projectMfid: string | undefined,
  onSelect: () => void
) {
  if (item.kind === "person") {
    return (
      <Link
        onClick={onSelect}
        params={{ userId: item.unique_id }}
        to="/users/$userId"
      />
    )
  }
  if (item.kind === "project") {
    return (
      <Link
        onClick={onSelect}
        params={{ projectMfid: item.unique_id }}
        search={{ preview: undefined }}
        state={{}}
        to="/projects/$projectMfid"
      />
    )
  }
  if (item.kind === "instrument") {
    return (
      <Link
        onClick={onSelect}
        params={{ instrumentMfid: item.unique_id }}
        search={{}}
        state={{}}
        to="/instruments/$instrumentMfid"
      />
    )
  }
  if (item.kind === "sample") {
    return (
      <Link
        onClick={onSelect}
        params={{ sampleMfid: item.unique_id }}
        search={{ fromProject: projectMfid, preview: undefined }}
        to="/samples/$sampleMfid"
      />
    )
  }
  return (
    <Link
      onClick={onSelect}
      params={{ datasetMfid: item.unique_id }}
      search={{ fromProject: projectMfid, preview: undefined }}
      to="/datasets/$datasetMfid"
    />
  )
}

function QuickSearchStatus({
  children,
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("px-3 py-3 text-body text-muted-foreground", className)}
      {...props}
    >
      {children}
    </p>
  )
}

function searchKindLabel(kind: WorkspaceSearchKind) {
  if (kind === "person") return "People"
  return `${kind[0].toLocaleUpperCase()}${kind.slice(1)}s`
}
