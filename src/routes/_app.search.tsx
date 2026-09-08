import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import { z } from "zod"

import {
  CollectionLoadError,
  CollectionUpdateError,
  CollectionUpdateStatus,
} from "@/components/crucible/collection-state"
import { ContentBoundary } from "@/components/crucible/content-layout"
import { BackToProjectIcon, SearchIcon } from "@/components/crucible/icons"
import { MfidValue } from "@/components/crucible/mfid-value"
import { PageHeader } from "@/components/crucible/page-header"
import { PageLayout } from "@/components/crucible/page-layout"
import { ResourceTypeIcon } from "@/components/crucible/resource-type-icon"
import { RouteContentPending } from "@/components/crucible/route-content-pending"
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
import { projectQueryOptions } from "@/data/crucible/projects.queries"
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
  pendingComponent: RouteContentPending,
  component: SearchPage,
})

function SearchPage() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: "/search" })
  const scope = useWorkspaceScope()
  const [query, setQuery] = useState(search.q ?? "")
  const projectResult = useQuery({
    ...projectQueryOptions(scope, search.projectMfid ?? ""),
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
      <SearchBreadcrumb
        projectMfid={search.projectMfid}
        projectName={
          project ? (project.title ?? project.project_id) : search.projectMfid
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
            ? `Samples and datasets related to ${project ? (project.title ?? project.project_id) : search.projectMfid}.`
            : undefined
        }
        eyebrow={search.projectMfid ? "Project search" : "Search"}
        title={
          search.projectMfid
            ? "Find data in this project"
            : "Find anything in Crucible"
        }
      />
      <ContentBoundary width="reading">
        <form className="flex gap-2" onSubmit={submit} role="search">
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
      <nav className="flex flex-wrap gap-2" aria-label="Resource type filter">
        <KindLink
          active={
            !metadataMode &&
            (search.projectMfid ? !selectedProjectKind : !search.kind)
          }
          kind={undefined}
          label="All"
        />
        {(search.projectMfid ? projectKinds : kinds).map((kind) => (
          <KindLink
            active={!metadataMode && search.kind === kind}
            key={kind}
            kind={kind}
            label={kindLabel(kind)}
          />
        ))}
        {!search.projectMfid ? (
          <ModeLink active={metadataMode} label="Scientific metadata" />
        ) : null}
      </nav>
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
            <BreadcrumbItem>
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
        <BreadcrumbItem>
          <BreadcrumbPage>Search</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
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
                        <SearchResult
                          item={item}
                          key={item.unique_id}
                          projectMfid={projectMfid}
                        />
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

function SearchResult({
  item,
  projectMfid,
}: {
  item: WorkspaceSearchResult
  projectMfid?: string
}) {
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
        search={{ fromProject: projectMfid }}
        to="/samples/$sampleMfid"
      >
        {item.name}
      </Link>
    ) : (
      <Link
        className="text-label hover:underline"
        params={{ datasetMfid: item.unique_id }}
        search={{ fromProject: projectMfid }}
        to="/datasets/$datasetMfid"
      >
        {item.name}
      </Link>
    )

  return (
    <li className="flex min-w-0 items-start gap-3 px-4 py-3 sm:px-5">
      <ResourceTypeIcon className="mt-0.5 shrink-0" type={item.kind} />
      <div className="min-w-0 flex-1">
        {link}
        {item.context ? (
          <p className="truncate text-supporting text-muted-foreground">
            {item.context}
          </p>
        ) : null}
      </div>
      <MfidValue className="hidden max-w-64 lg:flex" value={item.unique_id} />
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
      search={(previous) => ({ ...previous, kind, mode: undefined })}
      to="/search"
    >
      {label}
    </Link>
  )
}

function ModeLink({ active, label }: { active: boolean; label: string }) {
  return (
    <Link
      className={buttonVariants({ variant: active ? "secondary" : "ghost" })}
      from="/search"
      search={(previous) => ({
        ...previous,
        kind: undefined,
        mode: active ? undefined : "metadata",
      })}
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
