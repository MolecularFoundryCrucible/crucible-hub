import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import { SearchIcon } from "lucide-react"
import { z } from "zod"

import {
  CollectionLoadError,
  CollectionUpdateError,
  CollectionUpdateStatus,
} from "@/components/crucible/collection-state"
import { PageHeader } from "@/components/crucible/page-header"
import { PageLayout } from "@/components/crucible/page-layout"
import { ResourceTypeIcon } from "@/components/crucible/resource-type-icon"
import { RouteContentPending } from "@/components/crucible/route-content-pending"
import { useWorkspaceScope } from "@/components/crucible/workspace-provider"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { searchQueryOptions } from "@/data/crucible/search.queries"
import type {
  WorkspaceSearchKind,
  WorkspaceSearchResult,
} from "@/data/crucible/workspace-source"
import { cn } from "@/lib/utils"

const kinds = [
  "person",
  "project",
  "instrument",
  "sample",
  "dataset",
] as const satisfies readonly WorkspaceSearchKind[]

const kindIconClasses = {
  dataset: "text-(--resource-dataset)",
  instrument: "text-(--resource-instrument)",
  person: "text-muted-foreground",
  project: "text-(--resource-project)",
  sample: "text-(--resource-sample)",
} satisfies Record<WorkspaceSearchKind, string>

const searchSchema = z.object({
  kind: z.enum(kinds).optional().catch(undefined),
  q: z.string().trim().max(200).optional().catch(undefined),
})

export const Route = createFileRoute("/_app/search")({
  validateSearch: searchSchema,
  pendingComponent: RouteContentPending,
  component: SearchPage,
})

function SearchPage() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: "/search" })
  const [query, setQuery] = useState(search.q ?? "")
  const selectedKinds = search.kind ? [search.kind] : kinds
  const validQuery = search.q && search.q.length >= 3 ? search.q : null

  useEffect(() => {
    setQuery(search.q ?? "")
  }, [search.q])

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalizedQuery = query.trim()
    if (normalizedQuery.length < 3) return
    void navigate({
      to: "/search",
      search: (previous) => ({ ...previous, q: normalizedQuery }),
    })
  }

  return (
    <PageLayout>
      <PageHeader eyebrow="Search" title="Find anything in Crucible" />
      <form className="flex max-w-2xl gap-2" onSubmit={submit} role="search">
        {search.kind ? (
          <input name="kind" type="hidden" value={search.kind} />
        ) : null}
        <label className="sr-only" htmlFor="search-query">
          Search query
        </label>
        <Input
          autoComplete="off"
          id="search-query"
          maxLength={200}
          minLength={3}
          name="q"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search names, identifiers, and scientific data"
          required
          type="search"
          value={query}
        />
        <Button type="submit">
          <SearchIcon data-icon="inline-start" />
          Search
        </Button>
      </form>
      <nav className="flex flex-wrap gap-2" aria-label="Resource type filter">
        <KindLink active={!search.kind} kind={undefined} label="All" />
        {kinds.map((kind) => (
          <KindLink
            active={search.kind === kind}
            key={kind}
            kind={kind}
            label={kindLabel(kind)}
          />
        ))}
      </nav>
      {validQuery ? (
        <SearchResults kinds={selectedKinds} query={validQuery} />
      ) : (
        <Empty className="min-h-state border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchIcon />
            </EmptyMedia>
            <EmptyTitle>Start with a name or MFID</EmptyTitle>
            <EmptyDescription>
              Enter at least three characters. Search results are grouped by
              resource type.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </PageLayout>
  )
}

function SearchResultsPending() {
  return (
    <div
      aria-label="Loading search results"
      className="min-h-state flex flex-col gap-6"
      role="status"
    >
      <Skeleton className="h-4 w-48" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-6 w-32" />
        <Card>
          <CardContent className="flex flex-col gap-4 py-4">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-5 w-3/4" />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function SearchResults({
  kinds: selectedKinds,
  query,
}: {
  kinds: readonly WorkspaceSearchKind[]
  query: string
}) {
  const scope = useWorkspaceScope()
  const result = useQuery(searchQueryOptions(scope, query, selectedKinds))

  if (result.isPending) return <SearchResultsPending />
  if (result.isError && !result.data) {
    return (
      <CollectionLoadError
        label="Search results"
        retry={() => void result.refetch()}
      />
    )
  }

  const data = result.data
  const resultCount = data.groups.reduce(
    (total, current) => total + current.items.length,
    0
  )

  const content =
    resultCount === 0 && data.groups.every((group) => !group.error) ? (
      <Empty className="min-h-state border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SearchIcon />
          </EmptyMedia>
          <EmptyTitle>No matches for “{data.query}”</EmptyTitle>
          <EmptyDescription>
            Try another name, identifier, or complete MFID.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    ) : (
      <div className="flex flex-col gap-6" aria-live="polite">
        <p className="text-supporting text-muted-foreground">
          {resultCount} {resultCount === 1 ? "result" : "results"} for “
          {data.query}”
        </p>
        {data.groups
          .filter((group) => group.error || group.items.length > 0)
          .map((group) => (
            <section className="flex flex-col gap-2" key={group.kind}>
              <div className="flex items-center gap-2">
                <ResourceTypeIcon
                  className={kindIconClasses[group.kind]}
                  type={group.kind}
                />
                <h2 className="text-section-title">{kindLabel(group.kind)}</h2>
                {!group.error && group.total !== null ? (
                  <Badge variant="secondary">{group.total}</Badge>
                ) : null}
              </div>
              {group.error ? (
                <p className="text-body text-muted-foreground" role="status">
                  {kindLabel(group.kind)} could not be searched. Other results
                  remain available.
                </p>
              ) : group.items.length > 0 ? (
                <Card>
                  <CardContent className="px-0">
                    <ul className="divide-y">
                      {group.items.map((item) => (
                        <SearchResult item={item} key={item.unique_id} />
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ) : (
                <p className="text-body text-muted-foreground">
                  No {kindLabel(group.kind).toLocaleLowerCase()} matched.
                </p>
              )}
            </section>
          ))}
      </div>
    )

  return (
    <>
      <CollectionUpdateStatus
        label="search results"
        updating={result.isFetching}
      />
      {result.isError ? (
        <CollectionUpdateError
          label="Search results"
          preserved
          retry={() => void result.refetch()}
        />
      ) : null}
      <div aria-busy={result.isFetching}>{content}</div>
    </>
  )
}

function SearchResult({ item }: { item: WorkspaceSearchResult }) {
  const link =
    item.kind === "person" ? (
      <Link
        className="text-label hover:underline"
        params={{ personId: item.unique_id }}
        to="/people/$personId"
      >
        {item.name}
      </Link>
    ) : item.kind === "project" ? (
      <Link
        className="text-label hover:underline"
        params={{ projectMfid: item.unique_id }}
        to="/projects/$projectMfid"
      >
        {item.name}
      </Link>
    ) : item.kind === "instrument" ? (
      <Link
        className="text-label hover:underline"
        params={{ instrumentMfid: item.unique_id }}
        to="/instruments/$instrumentMfid"
      >
        {item.name}
      </Link>
    ) : item.kind === "sample" ? (
      <Link
        className="text-label hover:underline"
        params={{ sampleMfid: item.unique_id }}
        to="/samples/$sampleMfid"
      >
        {item.name}
      </Link>
    ) : (
      <Link
        className="text-label hover:underline"
        params={{ datasetMfid: item.unique_id }}
        to="/datasets/$datasetMfid"
      >
        {item.name}
      </Link>
    )

  return (
    <li className="flex min-w-0 items-start gap-3 px-4 py-3 sm:px-5">
      <ResourceTypeIcon
        className={cn("mt-0.5 shrink-0", kindIconClasses[item.kind])}
        type={item.kind}
      />
      <div className="min-w-0 flex-1">
        {link}
        {item.context ? (
          <p className="truncate text-supporting text-muted-foreground">
            {item.context}
          </p>
        ) : null}
      </div>
      <span className="hidden font-mono text-supporting text-muted-foreground lg:block">
        {item.unique_id}
      </span>
    </li>
  )
}

function KindLink({
  active,
  kind,
  label,
}: {
  active: boolean
  kind: WorkspaceSearchKind | undefined
  label: string
}) {
  return (
    <Link
      className={buttonVariants({ variant: active ? "secondary" : "ghost" })}
      from="/search"
      search={(previous) => ({ ...previous, kind })}
      to="/search"
    >
      {label}
    </Link>
  )
}

function kindLabel(kind: WorkspaceSearchKind) {
  if (kind === "person") return "People"
  return `${kind[0].toLocaleUpperCase()}${kind.slice(1)}s`
}
