import { useState } from "react"
import { useIsFetching, useQueryClient } from "@tanstack/react-query"
import type { QueryKey } from "@tanstack/react-query"

import { LocalDateTime } from "@/components/crucible/local-date-time"
import { notifySuccess } from "@/components/crucible/notifications"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { RefreshButton } from "@/components/crucible/refresh-button"

export function EntityRefreshAction({
  exact = true,
  label,
  queryKey,
  refreshedAt,
  relatedQueryKeys = [],
  subject,
}: {
  exact?: boolean
  label: string
  queryKey: QueryKey
  refreshedAt: number
  relatedQueryKeys?: readonly QueryKey[]
  subject: string
}) {
  const queryClient = useQueryClient()
  const [refreshRequested, setRefreshRequested] = useState(false)
  const refreshing =
    useIsFetching({ exact, queryKey, fetchStatus: "fetching" }) > 0 ||
    refreshRequested
  const [failed, setFailed] = useState(false)
  const timestamp = refreshedAt ? new Date(refreshedAt).toISOString() : null

  async function refresh() {
    setFailed(false)
    setRefreshRequested(true)
    try {
      await Promise.all([
        queryClient.refetchQueries({ exact, queryKey }, { throwOnError: true }),
        ...relatedQueryKeys.map((related) =>
          queryClient.invalidateQueries(
            { queryKey: related },
            { throwOnError: true }
          )
        ),
      ])
      notifySuccess(`${subject} refreshed`)
    } catch {
      setFailed(true)
    } finally {
      setRefreshRequested(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
      <Tooltip>
        <TooltipTrigger render={<span className="inline-flex" />} tabIndex={-1}>
          <RefreshButton
            failed={failed}
            label={failed ? `${label}. Refresh failed. Try again.` : label}
            onClick={() => void refresh()}
            refreshing={refreshing}
          />
        </TooltipTrigger>
        <TooltipContent>
          {failed ? (
            `${subject} could not be refreshed. Try again.`
          ) : timestamp ? (
            <>
              {subject} last refreshed <LocalDateTime value={timestamp} />
            </>
          ) : (
            label
          )}
        </TooltipContent>
      </Tooltip>
      {failed ? (
        <p
          className="basis-full text-right text-supporting text-destructive"
          role="alert"
        >
          {subject} could not be refreshed. Existing details are still shown.
        </p>
      ) : null}
    </div>
  )
}
