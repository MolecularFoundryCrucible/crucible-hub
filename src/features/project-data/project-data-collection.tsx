import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"

import {
  CollectionTablePending,
  CollectionUpdateError,
  CollectionUpdateStatus,
} from "@/components/crucible/collection-state"
import {
  ResourceOpenCell,
  ResourceOwnerCell,
  ResourceProjectCell,
  ResourceUpdatedCell,
} from "@/components/crucible/resource-collection-cells"
import { ResourceCollectionNameCell } from "@/components/crucible/resource-collection-name-cell"
import { useWorkspaceScope } from "@/components/crucible/workspace-provider"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  dataPageLimit,
  datasetsQueryOptions,
  samplesQueryOptions,
} from "@/data/crucible/data.queries"
import type { ProjectScope } from "@/data/crucible/data.queries"
import { HubApiClientError } from "@/data/crucible/result"
import type {
  WorkspaceDataset,
  WorkspaceSample,
} from "@/data/crucible/workspace-source"

import { ProjectDataFilters } from "./project-data-filters"
import type {
  ProjectDataFilterResolution,
  ProjectDataFilterSearch,
  ProjectDataCollectionFilters,
} from "./project-data-filter-state"

export type ProjectDataKind = "datasets" | "samples"

export function ProjectDataCollection({
  cursor,
  filterResolution,
  filterValues,
  kind,
  projectMfid,
  projectScope,
}: {
  cursor: string | undefined
  filterResolution: ProjectDataFilterResolution
  filterValues: ProjectDataFilterSearch
  kind: ProjectDataKind
  projectMfid: string
  projectScope: ProjectScope
}) {
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <ProjectDataTypeFilters
        kind={kind}
        projectMfid={projectMfid}
        projectScope={projectScope}
      />
      <ProjectDataFilters
        errors={filterResolution.valid ? [] : filterResolution.errors}
        kind={kind}
        projectMfid={projectMfid}
        projectScope={projectScope}
        values={filterValues}
      />
      {!filterResolution.valid ? (
        <Empty className="min-h-state border" role="alert">
          <EmptyHeader>
            <EmptyTitle>Project data filters are not valid</EmptyTitle>
            <EmptyDescription>
              Correct or clear the filters before loading project data.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : kind === "samples" ? (
        <ProjectSamples
          cursor={cursor}
          filters={filterResolution.filters}
          projectMfid={projectMfid}
          projectScope={projectScope}
        />
      ) : (
        <ProjectDatasets
          cursor={cursor}
          filters={filterResolution.filters}
          projectMfid={projectMfid}
          projectScope={projectScope}
        />
      )}
    </div>
  )
}

function ProjectSamples({
  cursor,
  filters,
  projectMfid,
  projectScope,
}: {
  cursor: string | undefined
  filters: ProjectDataCollectionFilters
  projectMfid: string
  projectScope: ProjectScope
}) {
  const scope = useWorkspaceScope()
  const result = useQuery(
    samplesQueryOptions(scope, {
      cursor,
      ...filters,
      limit: dataPageLimit,
      projectMfid,
      projectScope,
    })
  )

  if (result.isPending) return <CollectionTablePending label="samples" />
  if (result.isError && !result.data) {
    return (
      <ProjectDataLoadError
        cursor={cursor}
        error={result.error}
        kind="samples"
        projectMfid={projectMfid}
        retry={() => void result.refetch()}
      />
    )
  }

  return (
    <ProjectDataResult
      cursor={cursor}
      error={result.isError}
      items={result.data.items}
      kind="samples"
      nextCursor={result.data.nextCursor}
      projectMfid={projectMfid}
      retry={() => void result.refetch()}
      updating={result.isFetching}
    />
  )
}

function ProjectDatasets({
  cursor,
  filters,
  projectMfid,
  projectScope,
}: {
  cursor: string | undefined
  filters: ProjectDataCollectionFilters
  projectMfid: string
  projectScope: ProjectScope
}) {
  const scope = useWorkspaceScope()
  const result = useQuery(
    datasetsQueryOptions(scope, {
      cursor,
      ...filters,
      limit: dataPageLimit,
      projectMfid,
      projectScope,
    })
  )

  if (result.isPending) return <CollectionTablePending label="datasets" />
  if (result.isError && !result.data) {
    return (
      <ProjectDataLoadError
        cursor={cursor}
        error={result.error}
        kind="datasets"
        projectMfid={projectMfid}
        retry={() => void result.refetch()}
      />
    )
  }

  return (
    <ProjectDataResult
      cursor={cursor}
      error={result.isError}
      items={result.data.items}
      kind="datasets"
      nextCursor={result.data.nextCursor}
      projectMfid={projectMfid}
      retry={() => void result.refetch()}
      updating={result.isFetching}
    />
  )
}

function ProjectDataResult({
  cursor,
  error,
  items,
  kind,
  nextCursor,
  projectMfid,
  retry,
  updating,
}:
  | {
      cursor: string | undefined
      error: boolean
      items: readonly WorkspaceSample[]
      kind: "samples"
      nextCursor: string | null
      projectMfid: string
      retry: () => void
      updating: boolean
    }
  | {
      cursor: string | undefined
      error: boolean
      items: readonly WorkspaceDataset[]
      kind: "datasets"
      nextCursor: string | null
      projectMfid: string
      retry: () => void
      updating: boolean
    }) {
  const label = kind === "samples" ? "Samples" : "Datasets"
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <CollectionUpdateStatus label={label.toLowerCase()} updating={updating} />
      {error ? (
        <CollectionUpdateError label={label} preserved retry={retry} />
      ) : null}
      {items.length ? (
        <Card aria-busy={updating}>
          <CardContent className="px-0">
            {kind === "samples" ? (
              <ProjectSampleTable items={items} projectMfid={projectMfid} />
            ) : (
              <ProjectDatasetTable items={items} projectMfid={projectMfid} />
            )}
          </CardContent>
        </Card>
      ) : (
        <Empty className="min-h-state border">
          <EmptyHeader>
            <EmptyTitle>
              No {label.toLowerCase()} match these filters
            </EmptyTitle>
            <EmptyDescription>
              Try changing the filters or data type.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
      {!updating && nextCursor ? (
        <nav className="flex justify-end" aria-label={`Project ${kind} pages`}>
          <Link
            className={buttonVariants({ variant: "outline" })}
            from="/projects/$projectMfid"
            params={{ projectMfid }}
            search={(previous) => ({
              ...previous,
              [kind === "samples" ? "sampleCursor" : "datasetCursor"]:
                nextCursor,
              preview: undefined,
            })}
            state={{}}
            to="/projects/$projectMfid"
          >
            Next {kind}
          </Link>
        </nav>
      ) : null}
      {cursor && !nextCursor && !items.length ? (
        <FirstPageLink kind={kind} projectMfid={projectMfid} />
      ) : null}
    </div>
  )
}

function ProjectSampleTable({
  items,
  projectMfid,
}: {
  items: readonly WorkspaceSample[]
  projectMfid: string
}) {
  return (
    <ProjectTable>
      {items.map((sample) => (
        <TableRow key={sample.unique_id}>
          <ResourceCollectionNameCell
            className="resource-collection-name"
            kind="sample"
            mfid={sample.unique_id}
            name={sample.sample_name}
            subtype={sample.sample_type ?? "Unspecified sample type"}
            subtypeVisibility="always"
          />
          <ResourceProjectCell
            project={sample.project}
            projectId={sample.project_id}
            relation={sample.project_relation}
          />
          <ResourceOwnerCell username={sample.owner?.username} />
          <ResourceUpdatedCell
            value={sample.modification_time ?? sample.creation_time}
          />
          <ResourceOpenCell
            fromProject={projectMfid}
            kind="sample"
            mfid={sample.unique_id}
            name={sample.sample_name}
          />
        </TableRow>
      ))}
    </ProjectTable>
  )
}

function ProjectDatasetTable({
  items,
  projectMfid,
}: {
  items: readonly WorkspaceDataset[]
  projectMfid: string
}) {
  return (
    <ProjectTable>
      {items.map((dataset) => (
        <TableRow key={dataset.unique_id}>
          <ResourceCollectionNameCell
            className="resource-collection-name"
            kind="dataset"
            mfid={dataset.unique_id}
            name={dataset.dataset_name ?? "Untitled dataset"}
            subtype={dataset.measurement ?? "Unspecified measurement"}
            subtypeVisibility="always"
          />
          <ResourceProjectCell
            project={dataset.project}
            projectId={dataset.project_id}
            relation={dataset.project_relation}
          />
          <ResourceOwnerCell username={dataset.owner?.username} />
          <ResourceUpdatedCell
            value={dataset.modification_time ?? dataset.creation_time}
          />
          <ResourceOpenCell
            fromProject={projectMfid}
            kind="dataset"
            mfid={dataset.unique_id}
            name={dataset.dataset_name ?? "Untitled dataset"}
          />
        </TableRow>
      ))}
    </ProjectTable>
  )
}

function ProjectTable({ children }: { children: React.ReactNode }) {
  return (
    <Table className="resource-collection-table table-fixed">
      <colgroup>
        <col className="w-data-name-column-with-action xl:w-data-name-column-wide-with-action" />
        <col className="w-data-project-column-with-action xl:w-data-project-column-wide-with-action" />
        <col className="w-data-owner-column-with-action xl:w-data-owner-column-wide-with-action" />
        <col className="w-data-date-column-with-action xl:w-data-date-column-wide-with-action" />
        <col className="w-data-action-column" />
      </colgroup>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Project</TableHead>
          <TableHead>Owner</TableHead>
          <TableHead>Updated</TableHead>
          <TableHead className="text-center">
            <span className="sr-only">Open</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>{children}</TableBody>
    </Table>
  )
}

function ProjectDataTypeFilters({
  kind,
  projectMfid,
  projectScope,
}: {
  kind: ProjectDataKind
  projectMfid: string
  projectScope: ProjectScope
}) {
  return (
    <div className="flex flex-wrap gap-2" aria-label="Project data type">
      <ProjectDataFilterLink
        active={kind === "samples"}
        kind="samples"
        label="Samples"
        projectMfid={projectMfid}
        projectScope={projectScope}
      />
      <ProjectDataFilterLink
        active={kind === "datasets"}
        kind="datasets"
        label="Datasets"
        projectMfid={projectMfid}
        projectScope={projectScope}
      />
    </div>
  )
}

function ProjectDataFilterLink({
  active,
  kind,
  label,
  projectMfid,
  projectScope,
}: {
  active: boolean
  kind: ProjectDataKind
  label: string
  projectMfid: string
  projectScope: ProjectScope
}) {
  return (
    <Link
      activeOptions={{ exact: true, explicitUndefined: true }}
      aria-current={active ? "page" : undefined}
      className={buttonVariants({ variant: active ? "secondary" : "ghost" })}
      from="/projects/$projectMfid/"
      params={{ projectMfid }}
      search={(previous) => ({
        ...previous,
        datasetCursor: undefined,
        instrumentMfid:
          kind === "samples" ? undefined : previous.instrumentMfid,
        kind: kind === "samples" ? undefined : kind,
        preview: undefined,
        sampleCursor: undefined,
        scope: projectScope === "all" ? undefined : projectScope,
      })}
      state={{}}
      to="/projects/$projectMfid"
    >
      {label}
    </Link>
  )
}

function ProjectDataLoadError({
  cursor,
  error,
  kind,
  projectMfid,
  retry,
}: {
  cursor: string | undefined
  error: Error
  kind: ProjectDataKind
  projectMfid: string
  retry: () => void
}) {
  const message =
    error instanceof HubApiClientError && error.details.kind === "forbidden"
      ? "You do not have permission to view this project data."
      : error instanceof HubApiClientError && error.details.kind === "conflict"
        ? "This project data selection could not be resolved."
        : "Project data could not be loaded."
  return (
    <div className="flex flex-col gap-4">
      <Empty className="min-h-state border" role="alert">
        <EmptyHeader>
          <EmptyTitle>{message}</EmptyTitle>
          <EmptyDescription>
            The selected project data filters remain unchanged.
          </EmptyDescription>
          <Button onClick={retry} variant="outline">
            Try again
          </Button>
        </EmptyHeader>
      </Empty>
      {cursor ? <FirstPageLink kind={kind} projectMfid={projectMfid} /> : null}
    </div>
  )
}

function FirstPageLink({
  kind,
  projectMfid,
}: {
  kind: ProjectDataKind
  projectMfid: string
}) {
  return (
    <nav className="flex justify-end" aria-label={`Project ${kind} pages`}>
      <Link
        className={buttonVariants({ variant: "outline" })}
        from="/projects/$projectMfid"
        params={{ projectMfid }}
        search={(previous) => ({
          ...previous,
          [kind === "samples" ? "sampleCursor" : "datasetCursor"]: undefined,
          preview: undefined,
        })}
        state={{}}
        to="/projects/$projectMfid"
      >
        First {kind}
      </Link>
    </nav>
  )
}
