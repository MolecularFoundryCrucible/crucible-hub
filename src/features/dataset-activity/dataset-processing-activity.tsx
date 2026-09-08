import { useQuery } from "@tanstack/react-query"

import { CollectionRowsPending } from "@/components/crucible/collection-state"
import { StatusFieldIcon } from "@/components/crucible/icons"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { datasetIngestionRequestsQueryOptions } from "@/data/crucible/resources.queries"
import type { IdentityScope } from "@/data/crucible/query-keys"
import { formatLocalDateTime } from "@/lib/format"

export function DatasetProcessingActivity({
  datasetMfid,
  scope,
}: {
  datasetMfid: string
  scope: IdentityScope
}) {
  const result = useQuery(
    datasetIngestionRequestsQueryOptions(scope, datasetMfid)
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Processing activity</CardTitle>
        <CardDescription>
          Recent ingestion work reported for this dataset.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {result.isPending ? (
          <CollectionRowsPending label="processing activity" />
        ) : result.isError ? (
          <div className="flex flex-col items-start gap-3" role="alert">
            <p className="text-body text-muted-foreground">
              Processing activity could not be loaded.
            </p>
            <Button onClick={() => void result.refetch()} variant="outline">
              Try again
            </Button>
          </div>
        ) : result.data.length === 0 ? (
          <p className="text-body text-muted-foreground">
            No processing activity has been reported.
          </p>
        ) : (
          <ul className="flex flex-col" role="list">
            {result.data.map((request, index) => (
              <li
                className="flex min-w-0 items-start gap-3 border-b py-3 first:pt-0 last:border-b-0 last:pb-0"
                key={request.id ?? `${request.fileMfid ?? "request"}-${index}`}
              >
                <StatusFieldIcon
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <p className="text-label break-words">
                      {request.ingestionClass ?? "Dataset ingestion"}
                    </p>
                    <span className="text-label-compact capitalize">
                      {request.status ?? "Unknown status"}
                    </span>
                  </div>
                  {request.timeCreated ? (
                    <p className="mt-1 text-supporting text-muted-foreground">
                      Started {formatLocalDateTime(request.timeCreated)}
                      {request.timeCompleted
                        ? ` · Completed ${formatLocalDateTime(request.timeCompleted)}`
                        : ""}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
