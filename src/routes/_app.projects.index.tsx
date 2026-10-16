import { useEffect, useMemo, useState } from "react"
import {
  useInfiniteQuery,
  useQuery,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { Link, createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import { resourceDisplayName } from "@/lib/resource-name"

import { CollectionToolbar } from "@/components/crucible/collection-browser"
import {
  CollectionFilterPanel,
  collectionActiveFilter,
  collectionActiveFilters,
} from "@/components/crucible/collection-filter-panel"
import { CollectionPagination } from "@/components/crucible/collection-pagination"
import {
  CollectionLoadError,
  CollectionTablePending,
  CollectionUpdateError,
  CollectionUpdateStatus,
} from "@/components/crucible/collection-state"
import { PageHeader } from "@/components/crucible/page-header"
import { PageLayout } from "@/components/crucible/page-layout"
import { PersonLink } from "@/components/crucible/person-link"
import { ProjectRoleBadge } from "@/components/crucible/project-members"
import { RefreshButton } from "@/components/crucible/refresh-button"
import {
  ResourceCreatedCell,
  ResourceOpenCell,
  ResourceActivityCell,
} from "@/components/crucible/resource-collection-cells"
import { ResourceCreationLink } from "@/components/crucible/resource-creation-actions"
import { ResourceDirectoryNameCell } from "@/components/crucible/resource-directory-name-cell"
import { useWorkspaceScope } from "@/components/crucible/workspace-provider"
import { accountQueryOptions } from "@/data/crucible/account.queries"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { SortableTableHead } from "@/components/crucible/sortable-table-head"
import { dateOnlySchema } from "@/data/crucible/collection-filters"
import {
  capitalize,
  defaultOrderLabel,
  sortLabel,
} from "@/data/crucible/filter-draft"
import {
  projectPageLimit,
  projectsCursorQueryOptions,
} from "@/data/crucible/projects.queries"
import type { SortDirection } from "@/data/crucible/collection-query"
import {
  collectionAffiliationSchema,
  collectionCursorSchema,
  sortDirectionSchema,
} from "@/data/crucible/collection-query"
import {
  cursorPageTotal,
  flattenCursorPages,
} from "@/data/crucible/cursor-pages"
import type { WorkspaceProject } from "@/data/crucible/workspace-source"
import { prefetchInfiniteQueryWithReadableCache } from "@/data/query-prefetch"
import {
  loadDefaultSort,
  useDefaultSort,
} from "@/features/preferences/data-group-by"

const projectSortFieldSchema = z.enum([
  "name",
  "created",
  "updated",
  "activity",
])
export type ProjectSortField = z.infer<typeof projectSortFieldSchema>

const projectRoleFilterSchema = z.enum([
  "admin",
  "editor",
  "contributor",
  "viewer",
])
export type ProjectRoleFilter = z.infer<typeof projectRoleFilterSchema>

const projectSearchSchema = z.object({
  activeSince: dateOnlySchema.optional().catch(undefined),
  affiliation: collectionAffiliationSchema.optional().catch(undefined),
  cursor: collectionCursorSchema,
  direction: sortDirectionSchema.optional().catch(undefined),
  role: projectRoleFilterSchema.optional().catch(undefined),
  sort: projectSortFieldSchema.optional().catch(undefined),
})
type ProjectSearch = z.infer<typeof projectSearchSchema>

export const Route = createFileRoute("/_app/projects/")({
  head: () => ({ meta: [{ title: "Projects | Crucible Hub" }] }),
  validateSearch: projectSearchSchema,
  loaderDeps: ({ search }) => ({
    activeSince: search.activeSince,
    affiliation: search.affiliation,
    cursor: search.cursor,
    direction: search.direction,
    role: search.role,
    sort: search.sort,
  }),
  loader: async ({ cause, context, deps, parentMatchPromise }) => {
    const source = (await parentMatchPromise).loaderData
    if (!source || source.status === "unavailable") return

    const defaultSort = await loadDefaultSort(
      context.queryClient,
      source.scope,
      source.accountPreferencesEnabled
    )
    const preferredSort = defaultSort?.projects
    const effectiveSort = deps.sort ?? preferredSort?.sort
    const effectiveDirection =
      deps.direction ?? (deps.sort ? undefined : preferredSort?.direction)
    const apiSort = effectiveSort === "name" ? "title" : effectiveSort
    const accountUserMfid = source.scope[2]

    const options = projectsCursorQueryOptions(source.scope, {
      activeSince: deps.activeSince,
      affiliation: deps.role ? undefined : deps.affiliation,
      cursor: deps.cursor,
      direction: apiSort ? effectiveDirection : undefined,
      includeTotal: true,
      limit: projectPageLimit,
      memberRef: deps.role ? accountUserMfid : undefined,
      memberRole: deps.role,
      sort: apiSort,
    })
    const request = prefetchInfiniteQueryWithReadableCache(
      context.queryClient,
      options
    )
    if (cause !== "stay" && request) {
      await request
    }
    return { defaultSort }
  },
  pendingComponent: ProjectsRoutePending,
  staleTime: Infinity,
  component: ProjectsPage,
})

function ProjectsPage() {
  const scope = useWorkspaceScope()
  const { data: account } = useSuspenseQuery(accountQueryOptions(scope))
  const loaderData = Route.useLoaderData()
  const defaultSort = useDefaultSort(loaderData?.defaultSort)
  const preferredSort = defaultSort?.projects
  const search = Route.useSearch()
  const navigate = Route.useNavigate()

  const effectiveSort = search.sort ?? preferredSort?.sort
  const queryDirection =
    search.direction ?? (search.sort ? undefined : preferredSort?.direction)
  const apiSort = effectiveSort === "name" ? "title" : effectiveSort

  const projectResult = useInfiniteQuery(
    projectsCursorQueryOptions(scope, {
      activeSince: search.activeSince,
      affiliation: search.role ? undefined : search.affiliation,
      cursor: search.cursor,
      direction: apiSort ? queryDirection : undefined,
      includeTotal: true,
      limit: projectPageLimit,
      memberRef: search.role ? account.unique_id : undefined,
      memberRole: search.role,
      sort: apiSort,
    })
  )

  const projects = useMemo(
    () => flattenCursorPages(projectResult.data?.pages),
    [projectResult.data]
  )
  const total = cursorPageTotal(projectResult.data?.pages)
  const updating = projectResult.isFetching && !projectResult.isFetchingNextPage

  const sort = effectiveSort
  const direction = queryDirection ?? "asc"
  const hasActiveFilters = Boolean(
    search.activeSince || search.affiliation || search.role
  )

  function handleSortChange(
    nextField: ProjectSortField,
    nextDirection: SortDirection
  ) {
    void navigate({
      replace: true,
      search: (previous) => ({
        ...previous,
        cursor: undefined,
        direction: nextDirection,
        sort: nextField,
      }),
      state: {},
      to: "/projects",
    })
  }

  return (
    <PageLayout>
      <ProjectsPageHeader canCreate={account.capabilities.can_create_project} />
      <CollectionToolbar
        actions={
          <>
            <ProjectDirectoryFilters
              defaultOrdering={preferredSort}
              values={search}
            />
            <RefreshButton
              label="Refresh projects"
              onClick={() => void projectResult.refetch()}
              refreshing={updating}
            />
          </>
        }
      />
      {projectResult.isPending ? (
        <CollectionTablePending label="projects" presentation="projects" />
      ) : projectResult.isError && !projectResult.data ? (
        <>
          <CollectionLoadError
            label="Projects"
            retry={() => void projectResult.refetch()}
          />
        </>
      ) : (
        <>
          {projectResult.isError && !projectResult.isFetchNextPageError ? (
            <CollectionUpdateError
              label="Projects"
              preserved
              retry={() => void projectResult.refetch()}
            />
          ) : null}
          <ProjectCollection
            accountUserMfid={account.unique_id}
            affiliation={search.affiliation}
            direction={direction}
            hasActiveFilters={hasActiveFilters}
            hasNextPage={Boolean(projectResult.hasNextPage)}
            isLoadingMore={projectResult.isFetchingNextPage}
            loadMoreError={projectResult.isFetchNextPageError}
            onLoadMore={() => void projectResult.fetchNextPage()}
            onSortChange={handleSortChange}
            projects={projects}
            sort={sort}
            total={total}
            updating={updating}
          />
        </>
      )}
    </PageLayout>
  )
}

function ProjectsRoutePending() {
  const scope = useWorkspaceScope()
  const { data: account } = useQuery(accountQueryOptions(scope))
  return (
    <PageLayout>
      <ProjectsPageHeader
        canCreate={account?.capabilities.can_create_project === true}
      />
      <CollectionToolbar
        actions={
          <>
            <ProjectDirectoryFilters values={Route.useSearch()} />
            <RefreshButton
              label="Refresh projects"
              onClick={() => undefined}
              refreshing={false}
            />
          </>
        }
      />
      <CollectionTablePending label="projects" presentation="projects" />
    </PageLayout>
  )
}

function ProjectsPageHeader({ canCreate }: { canCreate: boolean }) {
  return (
    <PageHeader
      actions={
        canCreate ? (
          <ResourceCreationLink
            label="Create project"
            render={<Link to="/projects/new" />}
          />
        ) : null
      }
      title="Your projects"
    />
  )
}

type ProjectFilterValues = Omit<ProjectSearch, "cursor">

function ProjectDirectoryFilters({
  defaultOrdering,
  values,
}: {
  defaultOrdering?: { direction: SortDirection; sort: ProjectSortField }
  values: ProjectFilterValues
}) {
  const navigate = Route.useNavigate()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<ProjectFilterValues>(values)
  const valuesKey = JSON.stringify({
    activeSince: values.activeSince,
    affiliation: values.affiliation,
    direction: values.direction,
    role: values.role,
    sort: values.sort,
  })

  useEffect(() => {
    setDraft(JSON.parse(valuesKey) as ProjectFilterValues)
  }, [valuesKey])

  const effectiveDirection =
    values.direction ?? (values.sort === "name" ? "asc" : "desc")
  const active = collectionActiveFilters(
    collectionActiveFilter(
      "role",
      values.role
        ? `Role: ${capitalize(values.role)}`
        : values.affiliation === "owner"
          ? "Role: Led by me"
          : undefined
    ),
    collectionActiveFilter(
      "active-since",
      values.activeSince
        ? `Active since (UTC): ${values.activeSince}`
        : undefined
    ),
    collectionActiveFilter(
      "order",
      values.sort
        ? `Order: ${sortLabel(values.sort)} (${effectiveDirection === "asc" ? "ascending" : "descending"})`
        : undefined
    )
  )

  function updateSearch(next: ProjectFilterValues) {
    void navigate({
      search: () => ({
        activeSince: next.activeSince || undefined,
        affiliation: next.role ? undefined : next.affiliation,
        cursor: undefined,
        direction: next.sort ? next.direction : undefined,
        role: next.role,
        sort: next.sort,
      }),
      state: {},
      to: "/projects",
    })
  }

  function apply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setOpen(false)
    updateSearch(draft)
  }

  function clear() {
    const empty: ProjectFilterValues = {}
    setDraft(empty)
    setOpen(false)
    updateSearch(empty)
  }

  function changeOpen(nextOpen: boolean) {
    setOpen(nextOpen)
    if (nextOpen) setDraft(values)
  }

  function removeFilter(id: string) {
    if (id === "role") {
      updateSearch({ ...values, affiliation: undefined, role: undefined })
    } else if (id === "active-since") {
      updateSearch({ ...values, activeSince: undefined })
    } else if (id === "order") {
      updateSearch({ ...values, direction: undefined, sort: undefined })
    }
  }

  const draftRoleValue =
    draft.role ?? (draft.affiliation === "owner" ? "owner" : "")
  const draftDirection =
    draft.direction ?? (draft.sort === "name" ? "asc" : "desc")

  return (
    <CollectionFilterPanel
      activeFilters={active}
      footer={
        <>
          <Button onClick={clear} type="button" variant="outline">
            Clear filters
          </Button>
          <Button form="project-filters" type="submit">
            Apply filters
          </Button>
        </>
      }
      onClearFilters={clear}
      onOpenChange={changeOpen}
      onRemoveFilter={removeFilter}
      open={open}
      title="Project filters"
    >
      <form
        className="flex flex-col gap-4"
        id="project-filters"
        onSubmit={apply}
      >
        <FieldSet>
          <FieldLegend className="sr-only">Project filters</FieldLegend>
          <FieldGroup className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="project-filter-role">Your role</FieldLabel>
              <NativeSelect
                className="w-full"
                id="project-filter-role"
                onChange={(event) => {
                  const nextValue = event.target.value
                  setDraft((current) => ({
                    ...current,
                    affiliation: nextValue === "owner" ? "owner" : undefined,
                    role: projectRoleFilterSchema.safeParse(nextValue).success
                      ? (nextValue as ProjectRoleFilter)
                      : undefined,
                  }))
                }}
                value={draftRoleValue}
              >
                <NativeSelectOption value="">All projects</NativeSelectOption>
                <NativeSelectOption value="owner">Led by me</NativeSelectOption>
                <NativeSelectOption value="admin">Admin</NativeSelectOption>
                <NativeSelectOption value="editor">Editor</NativeSelectOption>
                <NativeSelectOption value="contributor">
                  Contributor
                </NativeSelectOption>
                <NativeSelectOption value="viewer">Viewer</NativeSelectOption>
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="project-filter-active-since">
                Active since (UTC)
              </FieldLabel>
              <Input
                id="project-filter-active-since"
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    activeSince: event.target.value || undefined,
                  }))
                }
                type="date"
                value={draft.activeSince ?? ""}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="project-filter-sort">Order by</FieldLabel>
              <NativeSelect
                className="w-full"
                id="project-filter-sort"
                onChange={(event) => {
                  const parsed = projectSortFieldSchema.safeParse(
                    event.target.value
                  )
                  const nextSort = parsed.success ? parsed.data : undefined
                  setDraft((current) => ({
                    ...current,
                    direction: nextSort
                      ? (current.direction ??
                        (nextSort === "name" ? "asc" : "desc"))
                      : undefined,
                    sort: nextSort,
                  }))
                }}
                value={draft.sort ?? ""}
              >
                <NativeSelectOption value="">
                  {defaultOrderLabel(
                    defaultOrdering ?? { direction: "asc", sort: "name" }
                  )}
                </NativeSelectOption>
                <NativeSelectOption value="name">Name</NativeSelectOption>
                <NativeSelectOption value="created">Created</NativeSelectOption>
                <NativeSelectOption value="updated">Updated</NativeSelectOption>
                <NativeSelectOption value="activity">
                  Last activity
                </NativeSelectOption>
              </NativeSelect>
            </Field>
            {draft.sort ? (
              <Field>
                <FieldLabel htmlFor="project-filter-direction">
                  Direction
                </FieldLabel>
                <NativeSelect
                  className="w-full"
                  id="project-filter-direction"
                  onChange={(event) => {
                    const parsed = sortDirectionSchema.safeParse(
                      event.target.value
                    )
                    if (parsed.success) {
                      setDraft((current) => ({
                        ...current,
                        direction: parsed.data,
                      }))
                    }
                  }}
                  value={draftDirection}
                >
                  <NativeSelectOption value="asc">Ascending</NativeSelectOption>
                  <NativeSelectOption value="desc">
                    Descending
                  </NativeSelectOption>
                </NativeSelect>
              </Field>
            ) : null}
          </FieldGroup>
        </FieldSet>
      </form>
    </CollectionFilterPanel>
  )
}

function resolveProjectRole(
  project: WorkspaceProject,
  accountUserMfid?: string
): string | null {
  return (
    project.role ??
    (accountUserMfid &&
    (project.lead?.unique_id === accountUserMfid ||
      project.project_lead_orcid === accountUserMfid)
      ? "owner"
      : (project.members?.find((m) => m.unique_id === accountUserMfid)?.role ??
        null))
  )
}

function ProjectCollection({
  accountUserMfid,
  affiliation,
  direction = "asc",
  hasActiveFilters,
  hasNextPage,
  isLoadingMore,
  loadMoreError,
  onLoadMore,
  onSortChange,
  projects,
  sort,
  total,
  updating,
}: {
  accountUserMfid?: string
  affiliation?: "owner"
  direction?: SortDirection
  hasActiveFilters: boolean
  hasNextPage: boolean
  isLoadingMore: boolean
  loadMoreError: boolean
  onLoadMore: () => void
  onSortChange: (field: ProjectSortField, direction: SortDirection) => void
  projects: readonly WorkspaceProject[]
  sort?: ProjectSortField
  total: number | null
  updating: boolean
}) {
  return (
    <>
      <CollectionUpdateStatus label="projects" updating={updating} />
      {projects.length > 0 ? (
        <Card aria-busy={updating}>
          <CardContent className="px-0">
            <Table
              aria-label="Project collection"
              className="resource-directory-table resource-directory-project-table table-fixed"
            >
              <colgroup>
                <col className="resource-directory-name-column" />
                <col className="resource-directory-person-column" />
                <col className="resource-directory-role-column hidden xl:table-column" />
                <col className="resource-directory-date-column hidden xl:table-column" />
                <col className="resource-directory-date-column" />
                <col className="resource-directory-action-column" />
              </colgroup>
              <TableHeader>
                <TableRow>
                  <SortableTableHead
                    active={sort === "name"}
                    direction={direction}
                    field="name"
                    label="Project"
                    onChange={onSortChange}
                    preferredDirection="asc"
                  />
                  <TableHead>Lead</TableHead>
                  <TableHead className="hidden xl:table-cell">Role</TableHead>
                  <SortableTableHead
                    active={sort === "created"}
                    className="hidden xl:table-cell"
                    direction={direction}
                    field="created"
                    kind="date"
                    label="Created"
                    onChange={onSortChange}
                    preferredDirection="desc"
                  />
                  <SortableTableHead
                    active={sort === "activity"}
                    direction={direction}
                    field="activity"
                    kind="date"
                    label="Last activity"
                    onChange={onSortChange}
                    preferredDirection="desc"
                  />
                  <TableHead kind="action">
                    <span className="sr-only">Open</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => {
                  const complete = "status" in project
                  const title = project.title?.trim()
                  const name = resourceDisplayName("project", project.title, {
                    identifier: project.project_id,
                    mfid: project.unique_id,
                  })
                  const effectiveRole = resolveProjectRole(
                    project,
                    accountUserMfid
                  )
                  return (
                    <TableRow key={project.unique_id}>
                      <ResourceDirectoryNameCell
                        identifier={title ? project.project_id : null}
                        kind="project"
                        mfid={project.unique_id}
                        name={name}
                      />
                      <TableCell
                        className="resource-directory-person"
                        data-label="Lead"
                      >
                        {complete && project.lead ? (
                          <PersonLink
                            nameStyle="abbreviated"
                            person={project.lead}
                            presentation="collection"
                          />
                        ) : (
                          <span aria-label="Not available">-</span>
                        )}
                      </TableCell>
                      <TableCell
                        className="resource-directory-role hidden xl:table-cell"
                        data-label="Role"
                      >
                        {effectiveRole ? (
                          <ProjectRoleBadge role={effectiveRole} />
                        ) : (
                          <span aria-label="Not available">-</span>
                        )}
                      </TableCell>
                      <ResourceCreatedCell
                        className="hidden xl:table-cell"
                        value={complete ? project.creation_time : undefined}
                      />
                      <ResourceActivityCell
                        value={complete ? project.last_activity_at : undefined}
                      />
                      <ResourceOpenCell
                        kind="project"
                        mfid={project.unique_id}
                        name={name}
                      />
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Empty className="min-h-state border">
          <EmptyHeader>
            <EmptyTitle>No projects found</EmptyTitle>
            <EmptyDescription>
              {affiliation
                ? "You do not lead any projects."
                : hasActiveFilters
                  ? "No projects match the current filters."
                  : "No projects are available to this account."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
      {projects.length ? (
        <CollectionPagination
          disabled={updating}
          hasNextPage={hasNextPage}
          isError={loadMoreError}
          isLoading={isLoadingMore}
          label="projects"
          loaded={projects.length}
          onLoadMore={onLoadMore}
          total={total}
        />
      ) : null}
    </>
  )
}
