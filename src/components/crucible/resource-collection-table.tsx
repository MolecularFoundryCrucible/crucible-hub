import { memo } from "react"

import {
  ResourceCreatedCell,
  ResourceOpenCell,
  ResourceOwnerCell,
  ResourceProjectCell,
  ResourceUpdatedCell,
} from "@/components/crucible/resource-collection-cells"
import { ResourceCollectionNameCell } from "@/components/crucible/resource-collection-name-cell"
import { SortableTableHead } from "@/components/crucible/sortable-table-head"
import { TableSortControl } from "@/components/crucible/table-sort-control"
import type { TableSortField } from "@/components/crucible/table-sort-control"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type {
  ResourceSort,
  SortDirection,
} from "@/data/crucible/collection-query"
import type {
  WorkspaceDataset,
  WorkspaceSample,
} from "@/data/crucible/workspace-source"
import { resourceDisplayName } from "@/lib/resource-name"

type SharedProps = {
  ariaLabel?: string
  direction: SortDirection
  fromProject?: string
  onSort: (sort: ResourceSort, direction: SortDirection) => void
  showProjectColumn?: boolean
  showSubtypeColumn?: boolean
  sort?: ResourceSort
  subtypeLabel?: string
  subtypeVisibility?: "always" | "compact"
}

type ResourceCollectionTableProps = SharedProps &
  (
    | { items: readonly WorkspaceDataset[]; kind: "dataset" }
    | { items: readonly WorkspaceSample[]; kind: "sample" }
  )

export function ResourceCollectionTable({
  ariaLabel,
  direction,
  fromProject,
  items,
  kind,
  onSort,
  showProjectColumn = true,
  showSubtypeColumn = false,
  sort,
  subtypeLabel = kind === "dataset" ? "Measurement" : "Sample type",
  subtypeVisibility = "always",
}: ResourceCollectionTableProps) {
  return (
    <Table
      aria-label={ariaLabel}
      before={
        <TableSortControl
          direction={direction}
          fields={resourceSortFields}
          onChange={onSort}
          sort={sort}
        />
      }
      className="resource-collection-table table-fixed"
    >
      <colgroup>
        <col />
        {showSubtypeColumn ? (
          <col className="hidden w-column-label @collection-wide:table-column" />
        ) : null}
        {showProjectColumn ? (
          <col className="resource-collection-project-column w-column-secondary" />
        ) : null}
        <col className="resource-collection-owner-column w-column-person" />
        <col className="hidden w-column-date @collection-wide:table-column" />
        <col className="w-column-date" />
        <col className="w-column-action" />
      </colgroup>
      <TableHeader>
        <TableRow>
          <SortableTableHead
            active={sort === "name"}
            direction={direction}
            field="name"
            label="Name"
            onChange={onSort}
          />
          {showSubtypeColumn ? (
            <TableHead className="hidden @collection-wide:table-cell">
              {subtypeLabel}
            </TableHead>
          ) : null}
          {showProjectColumn ? (
            <TableHead className="resource-collection-project">
              Project
            </TableHead>
          ) : null}
          <TableHead className="resource-collection-owner">Owner</TableHead>
          <SortableTableHead
            active={sort === "created"}
            className="hidden @collection-wide:table-cell"
            direction={direction}
            field="created"
            kind="date"
            label="Created"
            onChange={onSort}
          />
          <SortableTableHead
            active={sort === "updated"}
            direction={direction}
            field="updated"
            kind="date"
            label="Updated"
            onChange={onSort}
          />
          <TableHead kind="action">
            <span className="sr-only">Open</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {kind === "sample"
          ? items.map((sample) => (
              <SampleCollectionRow
                fromProject={fromProject}
                key={sample.unique_id}
                sample={sample}
                showProjectColumn={showProjectColumn}
                showSubtypeColumn={showSubtypeColumn}
                subtypeVisibility={subtypeVisibility}
              />
            ))
          : items.map((dataset) => (
              <DatasetCollectionRow
                dataset={dataset}
                fromProject={fromProject}
                key={dataset.unique_id}
                showProjectColumn={showProjectColumn}
                showSubtypeColumn={showSubtypeColumn}
                subtypeVisibility={subtypeVisibility}
              />
            ))}
      </TableBody>
    </Table>
  )
}

const resourceSortFields = [
  { field: "name", label: "Name" },
  { field: "created", kind: "date", label: "Created" },
  { field: "updated", kind: "date", label: "Updated" },
] as const satisfies readonly TableSortField<ResourceSort>[]

type CollectionRowProps = {
  fromProject?: string
  showProjectColumn: boolean
  showSubtypeColumn: boolean
  subtypeVisibility: "always" | "compact"
}

const SampleCollectionRow = memo(function SampleRow({
  fromProject,
  sample,
  showProjectColumn,
  showSubtypeColumn,
  subtypeVisibility,
}: CollectionRowProps & { sample: WorkspaceSample }) {
  const name = resourceDisplayName("sample", sample.sample_name)
  return (
    <TableRow>
      <ResourceCollectionNameCell
        className="resource-collection-name"
        kind="sample"
        mfid={sample.unique_id}
        name={name}
        subtype={sample.sample_type ?? "Unspecified sample type"}
        subtypeVisibility={subtypeVisibility}
      />
      {showSubtypeColumn ? <SubtypeCell value={sample.sample_type} /> : null}
      {showProjectColumn ? (
        <ResourceProjectCell
          project={sample.project}
          projectId={sample.project_id}
          relation={sample.project_relation}
        />
      ) : null}
      <ResourceOwnerCell owner={sample.owner} />
      <ResourceCreatedCell
        className="hidden @collection-wide:table-cell"
        value={sample.creation_time}
      />
      <ResourceUpdatedCell value={sample.modification_time} />
      <ResourceOpenCell
        fromProject={fromProject}
        kind="sample"
        mfid={sample.unique_id}
        name={name}
      />
    </TableRow>
  )
})

const DatasetCollectionRow = memo(function DatasetRow({
  dataset,
  fromProject,
  showProjectColumn,
  showSubtypeColumn,
  subtypeVisibility,
}: CollectionRowProps & { dataset: WorkspaceDataset }) {
  const name = resourceDisplayName("dataset", dataset.dataset_name)
  return (
    <TableRow>
      <ResourceCollectionNameCell
        className="resource-collection-name"
        kind="dataset"
        mfid={dataset.unique_id}
        name={name}
        subtype={dataset.measurement ?? "Unspecified measurement"}
        subtypeVisibility={subtypeVisibility}
      />
      {showSubtypeColumn ? <SubtypeCell value={dataset.measurement} /> : null}
      {showProjectColumn ? (
        <ResourceProjectCell
          project={dataset.project}
          projectId={dataset.project_id}
          relation={dataset.project_relation}
        />
      ) : null}
      <ResourceOwnerCell owner={dataset.owner} />
      <ResourceCreatedCell
        className="hidden @collection-wide:table-cell"
        value={dataset.creation_time}
      />
      <ResourceUpdatedCell value={dataset.modification_time} />
      <ResourceOpenCell
        fromProject={fromProject}
        kind="dataset"
        mfid={dataset.unique_id}
        name={name}
      />
    </TableRow>
  )
})

function SubtypeCell({ value }: { value?: string | null }) {
  return (
    <TableCell className="resource-collection-type hidden @collection-wide:table-cell">
      <span className="block truncate" title={value ?? undefined}>
        {value ?? "Unspecified"}
      </span>
    </TableCell>
  )
}
