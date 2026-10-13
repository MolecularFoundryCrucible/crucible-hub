import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import { z } from "zod"
import { resourceDisplayName } from "@/lib/resource-name"
import { searchMinQueryLength } from "@/lib/search"

import {
  CollectionLoadError,
  CollectionUpdateError,
  CollectionUpdateStatus,
  ResourceListPending,
} from "@/components/crucible/collection-state"
import { ContentBoundary } from "@/components/crucible/content-layout"
import { BackToProjectIcon, SearchIcon } from "@/components/crucible/icons"
import { MfidValue } from "@/components/crucible/mfid-value"
import { PageHeader } from "@/components/crucible/page-header"
import { PageLayout } from "@/components/crucible/page-layout"
import { SegmentedControl } from "@/components/crucible/segmented-control"
import { PersonLink } from "@/components/crucible/person-link"
import { ResourceIdentity } from "@/components/crucible/resource-identity"
import { ResourceNameLink } from "@/components/crucible/resource-name-link"
import {
  ResourceList,
  ResourceListItem,
  ResourceListItemContent,
} from "@/components/crucible/resource-list"
import { ResourceTypeIcon } from "@/components/crucible/resource-type-icon"
import { SearchRoutePending } from "@/components/crucible/route-content-pending"
import { useWorkspaceScope } from "@/components/crucible/workspace-provider"
import { Badge } from "@/components/ui/badge"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
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
import {
  metadataSearchQueryOptions,
  searchQueryOptions,
} from "@/data/crucible/search.queries"
import { projectSummaryQueryOptions } from "@/data/crucible/projects.queries"
import type {
  WorkspaceSearchKind,
  WorkspaceSearchResult,
} from "@/data/crucible/workspace-source"

const kinds = [
  "person",
  "project",
  "instrument",
  "sample",
  "dataset",
] as const satisfies readonly WorkspaceSearchKind[]

const searchSchema = z.object({
  kind: z.enum(kinds).optional().catch(undefined),
  mode: z.enum(["metadata"]).optional().catch(undefined),
  projectMfid: z.string().trim().min(1).max(255).optional().catch(undefined),
  q: z.string().trim().max(200).optional().catch(undefined),
})

export const Route = createFileRoute("/_app/search")({
  head: () => ({ meta: [{ title: "Search | Crucible Hub" }] }),
  validateSearch: searchSchema,
  pendingComponent: SearchRoutePending,
  component: SearchPage,
})

function SearchPage() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: "/search" })
  const scope = useWorkspaceScope()
  const [query, setQuery] = useState(search.q ?? "")
  const projectResult = useQuery({
    ...projectSummaryQueryOptions(scope, search.projectMfid ?? ""),
    enabled: Boolean(search.projectMfid),
  })
  const project = projectResult.data
  const projectKinds = ["sample", "dataset"] as const
  const selectedProjectKind =
    search.kind === "sample" || search.kind === "dataset"
      ? search.kind
      : undefined
  const selectedKinds = search.projectMfid
    ? selectedProjectKind
      ? [selectedProjectKind]
      : projectKinds
    : search.kind
      ? [search.kind]
      : kinds
  const metadataMode = !search.projectMfid && search.mode === "metadata"
  const validQuery =
    search.q && search.q.length >= searchMinQueryLength ? search.q : null

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
      <SearchBreadcrumb
        projectMfid={search.projectMfid}
        projectName={
          project
            ? resourceDisplayName("project", project.title, {
                identifier: project.project_id,
                mfid: project.unique_id,
              })
            : search.projectMfid
        }
      />
      <PageHeader
        actions={
          search.projectMfid ? (
            <div className="flex flex-wrap gap-2">
              <Link
                className={buttonVariants({ variant: "outline" })}
                search={{
                  kind: undefined,
                  projectMfid: undefined,
                  q: search.q,
                }}
                to="/search"
              >
                <SearchIcon aria-hidden="true" data-icon="inline-start" />
                Search all Crucible
              </Link>
              <Link
                className={buttonVariants({ variant: "outline" })}
                params={{ projectMfid: search.projectMfid }}
                search={{
                  datasetCursor: undefined,
                  kind: undefined,
                  preview: undefined,
                  sampleCursor: undefined,
                  scope: undefined,
                }}
                state={{}}
                to="/projects/$projectMfid"
              >
                <BackToProjectIcon
                  aria-hidden="true"
                  data-icon="inline-start"
                />
                Back to project
              </Link>
            </div>
          ) : null
        }
        description={
          search.projectMfid
            ? `Samples and datasets related to ${project ? resourceDisplayName("project", project.title, { identifier: project.project_id, mfid: project.unique_id }) : search.projectMfid}.`
            : undefined
        }
        title={
          search.projectMfid
            ? "Find data in this project"
            : "Find anything in Crucible"
        }
      />
      <ContentBoundary width="reading">
        <form
          aria-label="Resource search"
          className="flex gap-2"
          onSubmit={submit}
          role="search"
        >
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
            minLength={searchMinQueryLength}
            name="q"
            onChange={(event) => setQuery(event.target.value)}
            placeholder={
              metadataMode
                ? "Search scientific metadata"
                : search.projectMfid
                  ? "Search sample and dataset names"
                  : "Search names, identifiers, and scientific data"
            }
            required
            type="search"
            value={query}
          />
          <Button type="submit">
            <SearchIcon data-icon="inline-start" />
            Search
          </Button>
        </form>
      </ContentBoundary>
      <div className="overflow-x-auto pb-1">
        <SegmentedControl
          ariaLabel="Resource type filter"
          className="flex-wrap"
          onValueChange={(nextValue) => {
            void navigate({
              search: (previous) => ({
                ...previous,
                kind:
                  nextValue === "all" || nextValue === "metadata"
                    ? undefined
                    : (nextValue as WorkspaceSearchKind),
                mode: nextValue === "metadata" ? "metadata" : undefined,
              }),
              to: "/search",
            })
          }}
          options={[
            { label: "All", value: "all" },
            ...(search.projectMfid ? projectKinds : kinds).map((kind) => ({
              label: kindLabel(kind),
              value: kind,
            })),
            ...(!search.projectMfid
              ? [{ label: "Scientific metadata", value: "metadata" }]
              : []),
          ]}
          value={metadataMode ? "metadata" : (search.kind ?? "all")}
        />
      </div>
      {validQuery ? (
        <SearchResults
          kinds={selectedKinds}
          metadataMode={metadataMode}
          projectMfid={search.projectMfid}
          query={validQuery}
        />
      ) : (
        <Empty className="min-h-state border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchIcon />
            </EmptyMedia>
            <EmptyTitle>
              {search.projectMfid
                ? "Start with a resource name"
                : "Start with a name or MFID"}
            </EmptyTitle>
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

function SearchBreadcrumb({
  projectMfid,
  projectName,
}: {
  projectMfid?: string
  projectName?: string
}) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        {projectMfid ? (
          <>
            <BreadcrumbItem>
              <BreadcrumbLink render={<Link to="/projects" />}>
                Projects
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem className="max-w-breadcrumb-ancestor min-w-0 shrink">
              <BreadcrumbLink
                render={
                  <Link
                    params={{ projectMfid }}
                    search={{
                      datasetCursor: undefined,
                      kind: undefined,
                      preview: undefined,
                      sampleCursor: undefined,
                      scope: undefined,
                    }}
                    state={{}}
                    to="/projects/$projectMfid"
                  />
                }
              >
                {projectName ?? projectMfid}
              </BreadcrumbLink>
            </BreadcrumbItem>
          </>
        ) : (
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link to="/" />}>Home</BreadcrumbLink>
          </BreadcrumbItem>
        )}
        <BreadcrumbSeparator />
        <BreadcrumbItem className="min-w-0 shrink-0">
          <BreadcrumbPage>Search</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )
}

function SearchResultsPending() {
  return (
    <div aria-busy="true" className="min-h-state flex flex-col gap-6">
      <Skeleton className="h-4 w-48" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-6 w-32" />
        <Card>
          <CardContent className="px-0">
            <ResourceListPending label="search results" />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function SearchResults({
  kinds: selectedKinds,
  metadataMode,
  projectMfid,
  query,
}: {
  kinds: readonly WorkspaceSearchKind[]
  metadataMode: boolean
  projectMfid?: string
  query: string
}) {
  const scope = useWorkspaceScope()
  const result = useQuery(
    metadataMode
      ? metadataSearchQueryOptions(scope, query)
      : searchQueryOptions(scope, query, selectedKinds, projectMfid)
  )

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
                <ResourceTypeIcon type={group.kind} />
                <h2 className="text-title-section">{kindLabel(group.kind)}</h2>
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
                    <ResourceList>
                      {group.items.map((item) => (
                        <SearchResult
                          item={item}
                          key={item.unique_id}
                          projectMfid={projectMfid}
                        />
                      ))}
                    </ResourceList>
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

function SearchResult({
  item,
  projectMfid,
}: {
  item: WorkspaceSearchResult
  projectMfid?: string
}) {
  const link =
    item.kind === "person" ? (
      <PersonLink person={item} presentation="avatar" size="sm" />
    ) : (
      <ResourceIdentity
        context={item.context}
        kind={item.kind}
        name={item.name}
        nameContent={
          <ResourceNameLink
            fromProject={projectMfid}
            kind={item.kind}
            mfid={item.unique_id}
            name={item.name}
          />
        }
        presentation="collection"
        projectId={item.projectId}
      />
    )

  return (
    <ResourceListItem>
      <ResourceListItemContent className="sm:px-5" layout="start">
        <div className="min-w-0 flex-1">{link}</div>
        <MfidValue
          className="hidden shrink-0 lg:flex"
          presentation="supporting"
          value={item.unique_id}
        />
      </ResourceListItemContent>
    </ResourceListItem>
  )
}

function kindLabel(kind: WorkspaceSearchKind) {
  if (kind === "person") return "People"
  return `${kind[0].toLocaleUpperCase()}${kind.slice(1)}s`
}
