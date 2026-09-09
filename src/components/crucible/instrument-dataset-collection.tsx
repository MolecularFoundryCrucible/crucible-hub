import { Link } from "@tanstack/react-router"

import {
  ResourceOpenCell,
  ResourceOwnerCell,
  ResourceProjectCell,
  ResourceUpdatedCell,
} from "@/components/crucible/resource-collection-cells"
import { ResourceCollectionNameCell } from "@/components/crucible/resource-collection-name-cell"
import { buttonVariants } from "@/components/ui/button"
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
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type {
  WorkspaceCursorPage,
  WorkspaceDataset,
} from "@/data/crucible/workspace-source"

export function InstrumentDatasetCollection({
  cursor,
  instrumentMfid,
  page,
  updating,
}: {
  cursor: string | undefined
  instrumentMfid: string
  page: WorkspaceCursorPage<WorkspaceDataset>
  updating: boolean
}) {
  return (
    <>
      <Card aria-busy={updating}>
        <CardContent className="px-0">
          {page.items.length ? (
            <Table
              className="resource-collection-table table-fixed"
              aria-label="Instrument datasets"
            >
              <colgroup>
                <col className="w-data-name-column-with-action xl:w-data-name-column-wide-with-action" />
                <col className="hidden xl:table-column xl:w-data-type-column-wide-with-action" />
                <col className="w-data-project-column-with-action xl:w-data-project-column-wide-with-action" />
                <col className="w-data-owner-column-with-action xl:w-data-owner-column-wide-with-action" />
                <col className="w-data-date-column-with-action xl:w-data-date-column-wide-with-action" />
                <col className="w-data-action-column" />
              </colgroup>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden xl:table-cell">
                    Measurement
                  </TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-center">
                    <span className="sr-only">Open</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {page.items.map((dataset) => (
                  <TableRow key={dataset.unique_id}>
                    <ResourceCollectionNameCell
                      className="resource-collection-name"
                      kind="dataset"
                      mfid={dataset.unique_id}
                      name={dataset.dataset_name ?? "Untitled dataset"}
                      subtype={dataset.measurement ?? "Unspecified measurement"}
                      subtypeVisibility="compact"
                    />
                    <TableCell className="resource-collection-type hidden xl:table-cell">
                      <span
                        className="block truncate"
                        title={dataset.measurement ?? undefined}
                      >
                        {dataset.measurement ?? "Unspecified"}
                      </span>
                    </TableCell>
                    <ResourceProjectCell
                      project={dataset.project}
                      projectId={dataset.project_id}
                      relation={dataset.project_relation}
                    />
                    <ResourceOwnerCell owner={dataset.owner} />
                    <ResourceUpdatedCell
                      value={dataset.modification_time ?? dataset.creation_time}
                    />
                    <ResourceOpenCell
                      kind="dataset"
                      mfid={dataset.unique_id}
                      name={dataset.dataset_name ?? "Untitled dataset"}
                    />
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>No datasets found</EmptyTitle>
                <EmptyDescription>
                  No accessible datasets are assigned to this instrument.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </CardContent>
      </Card>

      {!updating && (cursor || page.nextCursor) ? (
        <nav
          className="flex flex-wrap items-center justify-end gap-2"
          aria-label="Instrument dataset pages"
        >
          {cursor ? (
            <Link
              className={buttonVariants({ variant: "outline" })}
              from="/instruments/$instrumentMfid/datasets"
              params={{ instrumentMfid }}
              search={(previous) => ({ ...previous, cursor: undefined })}
              to="/instruments/$instrumentMfid/datasets"
            >
              First datasets
            </Link>
          ) : null}
          {page.nextCursor ? (
            <Link
              className={buttonVariants({ variant: "outline" })}
              from="/instruments/$instrumentMfid/datasets"
              params={{ instrumentMfid }}
              search={(previous) => ({
                ...previous,
                cursor: page.nextCursor ?? undefined,
              })}
              to="/instruments/$instrumentMfid/datasets"
            >
              Next datasets
            </Link>
          ) : null}
        </nav>
      ) : null}
    </>
  )
}
