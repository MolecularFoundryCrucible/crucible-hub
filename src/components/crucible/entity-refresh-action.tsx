import { useState } from "react"
import { useIsFetching, useQueryClient } from "@tanstack/react-query"
import type { QueryKey } from "@tanstack/react-query"

import { RefreshResourceIcon } from "@/components/crucible/icons"
import { Button } from "@/components/ui/button"
import { formatLocalDateTime } from "@/lib/format"

export function EntityRefreshAction({
  label,
  queryKey,
  refreshedAt,
}: {
  label: string
  queryKey: QueryKey
  refreshedAt: number
}) {
  const queryClient = useQueryClient()
  const refreshing =
    useIsFetching({ exact: true, queryKey, fetchStatus: "fetching" }) > 0
  const [failed, setFailed] = useState(false)
  const timestamp = refreshedAt
    ? formatLocalDateTime(new Date(refreshedAt).toISOString())
    : null

  async function refresh() {
    setFailed(false)
    try {
      await queryClient.refetchQueries(
        { exact: true, queryKey },
        { throwOnError: true }
      )
    } catch {
      setFailed(true)
    }
  }

  return (
    <div className="flex flex-col items-start gap-1 lg:items-end">
      <Button
        aria-label={label}
        disabled={refreshing}
        onClick={() => void refresh()}
        size="sm"
        variant="outline"
      >
        <RefreshResourceIcon
          aria-hidden="true"
          className={refreshing ? "animate-spin" : undefined}
          data-icon="inline-start"
        />
        {refreshing ? "Refreshing" : "Refresh"}
      </Button>
      {timestamp ? (
        <time
          className="text-supporting text-muted-foreground"
          dateTime={new Date(refreshedAt).toISOString()}
        >
          Last refreshed {timestamp}
        </time>
      ) : null}
      {failed ? (
        <p className="text-supporting text-destructive" role="alert">
          Refresh failed. Existing details are still shown.
        </p>
      ) : null}
    </div>
  )
}
