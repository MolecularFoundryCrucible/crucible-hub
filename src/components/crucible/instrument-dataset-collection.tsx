import { Link } from "@tanstack/react-router"

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
            <Table className="table-fixed" aria-label="Instrument datasets">
              <colgroup>
                <col className="w-data-name-column xl:w-data-name-column-wide" />
                <col className="hidden lg:table-column lg:w-data-type-column-wide" />
                <col className="hidden md:table-column md:w-data-project-column-wide" />
                <col className="hidden xl:table-column xl:w-data-owner-column-wide" />
                <col className="hidden xl:table-column xl:w-data-date-column-wide" />
              </colgroup>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden lg:table-cell">
                    Measurement
                  </TableHead>
                  <TableHead className="hidden md:table-cell">
                    Project
                  </TableHead>
                  <TableHead className="hidden xl:table-cell">Owner</TableHead>
                  <TableHead className="hidden xl:table-cell">
                    Updated
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {page.items.map((dataset) => (
                  <TableRow key={dataset.unique_id}>
                    <TableCell>
                      <div className="flex min-w-0 items-center gap-2">
                        <ResourceTypeIcon
                          className="shrink-0 text-(--resource-dataset)"
                          type="dataset"
                        />
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
                          <p className="truncate text-supporting text-muted-foreground lg:hidden">
                            {dataset.measurement ?? "Unspecified measurement"}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <span
                        className="block truncate"
                        title={dataset.measurement ?? undefined}
                      >
                        {dataset.measurement ?? "Unspecified"}
                      </span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
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
                    <TableCell className="hidden xl:table-cell">
                      <span
                        className="block truncate"
                        title={dataset.owner?.username ?? undefined}
                      >
                        {dataset.owner?.username ?? "Unknown owner"}
                      </span>
                    </TableCell>
                    <TableCell className="hidden xl:table-cell">
                      {formatDate(
                        dataset.modification_time ?? dataset.creation_time
                      )}
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
