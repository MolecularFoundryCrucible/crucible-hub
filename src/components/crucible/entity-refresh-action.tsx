import { useState } from "react"
import {
  matchQuery,
  useIsFetching,
  useQueryClient,
} from "@tanstack/react-query"
import type { QueryKey } from "@tanstack/react-query"

import { RefreshResourceIcon } from "@/components/crucible/icons"
import { LocalDateTime } from "@/components/crucible/local-date-time"
import { notifySuccess } from "@/components/crucible/notifications"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

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
  const refreshing =
    useIsFetching({
      fetchStatus: "fetching",
      predicate: (query) =>
        matchQuery({ exact, queryKey }, query) ||
        relatedQueryKeys.some((related) =>
          matchQuery({ queryKey: related }, query)
        ),
    }) > 0
  const [failed, setFailed] = useState(false)
  const timestamp = refreshedAt ? new Date(refreshedAt).toISOString() : null

  async function refresh() {
    setFailed(false)
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
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
      <Tooltip>
        <TooltipTrigger render={<span className="inline-flex" />}>
          <Button
            aria-label={failed ? `${label}. Refresh failed. Try again.` : label}
            aria-pressed={refreshing || undefined}
            className={refreshing ? "translate-y-px" : undefined}
            onClick={() => void refresh()}
            variant={failed ? "destructive" : "outline"}
          >
            <RefreshResourceIcon
              aria-hidden="true"
              className={
                refreshing
                  ? "animate-spin motion-reduce:animate-none"
                  : undefined
              }
              data-icon="inline-start"
            />
            Refresh
          </Button>
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
