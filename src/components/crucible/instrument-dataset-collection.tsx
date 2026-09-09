import { Link } from "@tanstack/react-router"

import { ResourceFullPageLink } from "@/components/crucible/resource-full-page-link"
import { ResourceTypeIcon } from "@/components/crucible/resource-type-icon"
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
import { formatDate } from "@/lib/format"

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
                    <TableCell className="resource-collection-name">
                      <div className="flex min-w-0 items-center gap-2">
                        <ResourceTypeIcon className="shrink-0" type="dataset" />
                        <div className="min-w-0">
                          <Link
                            className="block truncate text-label hover:underline"
                            params={{ datasetMfid: dataset.unique_id }}
                            title={dataset.dataset_name ?? undefined}
                            to="/datasets/$datasetMfid"
                          >
                            <span className="sr-only">Dataset: </span>
                            {dataset.dataset_name ?? "Untitled dataset"}
                          </Link>
                          <p className="truncate text-supporting text-muted-foreground xl:hidden">
                            {dataset.measurement ?? "Unspecified measurement"}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="resource-collection-type hidden xl:table-cell">
                      <span
                        className="block truncate"
                        title={dataset.measurement ?? undefined}
                      >
                        {dataset.measurement ?? "Unspecified"}
                      </span>
                    </TableCell>
                    <TableCell
                      className="resource-collection-project"
                      data-label="Project"
                    >
                      <span
                        className="block truncate"
                        title={
                          dataset.project?.title ??
                          dataset.project_id ??
                          undefined
                        }
                      >
                        {dataset.project?.title ??
                          dataset.project_id ??
                          "Unassigned"}
                      </span>
                    </TableCell>
                    <TableCell
                      className="resource-collection-owner"
                      data-label="Owner"
                    >
                      <span
                        className="block truncate"
                        title={dataset.owner?.username ?? undefined}
                      >
                        {dataset.owner?.username ?? "Unknown owner"}
                      </span>
                    </TableCell>
                    <TableCell
                      className="resource-collection-date"
                      data-label="Updated"
                    >
                      {formatDate(
                        dataset.modification_time ?? dataset.creation_time
                      )}
                    </TableCell>
                    <TableCell className="resource-collection-action text-center">
                      <ResourceFullPageLink
                        kind="dataset"
                        mfid={dataset.unique_id}
                        name={dataset.dataset_name ?? "Untitled dataset"}
                        presentation="table"
                      />
                    </TableCell>
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
