import { useState } from "react"
import { useIsFetching, useQueryClient } from "@tanstack/react-query"
import type { QueryKey } from "@tanstack/react-query"

import { RefreshResourceIcon } from "@/components/crucible/icons"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
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
    <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
      <Tooltip>
        <TooltipTrigger render={<span className="inline-flex" />}>
          <Button
            aria-label={label}
            disabled={refreshing}
            onClick={() => void refresh()}
            size="default"
            variant="outline"
          >
            <RefreshResourceIcon
              aria-hidden="true"
              className={refreshing ? "animate-spin" : undefined}
              data-icon="inline-start"
            />
            {refreshing ? "Refreshing" : "Refresh"}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {timestamp ? `Last refreshed ${timestamp}` : label}
        </TooltipContent>
      </Tooltip>
      {failed ? (
        <p
          className="basis-full text-right text-supporting text-destructive"
          role="alert"
        >
          Refresh failed. Existing details are still shown.
        </p>
      ) : null}
    </div>
  )
}
