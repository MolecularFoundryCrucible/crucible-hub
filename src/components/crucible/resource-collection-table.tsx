import {
  ResourceCreatedCell,
  ResourceOpenCell,
  ResourceOwnerCell,
  ResourceProjectCell,
  ResourceUpdatedCell,
} from "@/components/crucible/resource-collection-cells"
import { ResourceCollectionNameCell } from "@/components/crucible/resource-collection-name-cell"
import { SortableTableHead } from "@/components/crucible/sortable-table-head"
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
      className="resource-collection-table table-fixed"
    >
      <colgroup>
        <col className="w-data-name-column-with-action xl:w-data-name-column-wide-with-action" />
        {showSubtypeColumn ? (
          <col className="hidden xl:table-column xl:w-data-type-column-wide-with-action" />
        ) : null}
        {showProjectColumn ? (
          <col className="w-data-project-column-with-action xl:w-data-project-column-wide-with-action" />
        ) : null}
        <col className="w-data-owner-column-with-action xl:w-data-owner-column-wide-with-action" />
        <col className="hidden w-data-date-column-with-action xl:table-column xl:w-data-date-column-wide-with-action" />
        <col className="w-data-date-column-with-action xl:w-data-date-column-wide-with-action" />
        <col className="w-data-action-column" />
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
            <TableHead className="hidden xl:table-cell">
              {subtypeLabel}
            </TableHead>
          ) : null}
          {showProjectColumn ? <TableHead>Project</TableHead> : null}
          <TableHead>Owner</TableHead>
          <SortableTableHead
            active={sort === "created"}
            className="hidden xl:table-cell"
            direction={direction}
            field="created"
            label="Created"
            onChange={onSort}
          />
          <SortableTableHead
            active={sort === "updated"}
            direction={direction}
            field="updated"
            label="Updated"
            onChange={onSort}
          />
          <TableHead className="text-center">
            <span className="sr-only">Open</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {kind === "sample"
          ? items.map((sample) => (
              <TableRow key={sample.unique_id}>
                <ResourceCollectionNameCell
                  className="resource-collection-name"
                  kind="sample"
                  mfid={sample.unique_id}
                  name={sample.sample_name}
                  subtype={sample.sample_type ?? "Unspecified sample type"}
                  subtypeVisibility={subtypeVisibility}
                />
                {showSubtypeColumn ? (
                  <SubtypeCell value={sample.sample_type} />
                ) : null}
                {showProjectColumn ? (
                  <ResourceProjectCell
                    project={sample.project}
                    projectId={sample.project_id}
                    relation={sample.project_relation}
                  />
                ) : null}
                <ResourceOwnerCell owner={sample.owner} />
                <ResourceCreatedCell
                  className="hidden xl:table-cell"
                  value={sample.creation_time}
                />
                <ResourceUpdatedCell value={sample.modification_time} />
                <ResourceOpenCell
                  fromProject={fromProject}
                  kind="sample"
                  mfid={sample.unique_id}
                  name={sample.sample_name}
                />
              </TableRow>
            ))
          : items.map((dataset) => (
              <TableRow key={dataset.unique_id}>
                <ResourceCollectionNameCell
                  className="resource-collection-name"
                  kind="dataset"
                  mfid={dataset.unique_id}
                  name={dataset.dataset_name ?? "Untitled dataset"}
                  subtype={dataset.measurement ?? "Unspecified measurement"}
                  subtypeVisibility={subtypeVisibility}
                />
                {showSubtypeColumn ? (
                  <SubtypeCell value={dataset.measurement} />
                ) : null}
                {showProjectColumn ? (
                  <ResourceProjectCell
                    project={dataset.project}
                    projectId={dataset.project_id}
                    relation={dataset.project_relation}
                  />
                ) : null}
                <ResourceOwnerCell owner={dataset.owner} />
                <ResourceCreatedCell
                  className="hidden xl:table-cell"
                  value={dataset.creation_time}
                />
                <ResourceUpdatedCell value={dataset.modification_time} />
                <ResourceOpenCell
                  fromProject={fromProject}
                  kind="dataset"
                  mfid={dataset.unique_id}
                  name={dataset.dataset_name ?? "Untitled dataset"}
                />
              </TableRow>
            ))}
      </TableBody>
    </Table>
  )
}

function SubtypeCell({ value }: { value?: string | null }) {
  return (
    <TableCell className="resource-collection-type hidden xl:table-cell">
      <span className="block truncate" title={value ?? undefined}>
        {value ?? "Unspecified"}
      </span>
    </TableCell>
  )
}
