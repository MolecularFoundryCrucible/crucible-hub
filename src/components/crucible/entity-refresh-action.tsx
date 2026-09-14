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
  presentation = "default",
  queryKey,
  refreshedAt,
}: {
  label: string
  presentation?: "default" | "icon"
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
            aria-label={failed ? `${label}. Refresh failed. Try again.` : label}
            disabled={refreshing}
            onClick={() => void refresh()}
            size={presentation === "icon" ? "icon-sm" : "default"}
            variant={
              failed
                ? "destructive"
                : presentation === "icon"
                  ? "ghost"
                  : "outline"
            }
          >
            <RefreshResourceIcon
              aria-hidden="true"
              className={
                refreshing
                  ? "animate-spin motion-reduce:animate-none"
                  : undefined
              }
              data-icon={
                presentation === "default" ? "inline-start" : undefined
              }
            />
            {presentation === "default"
              ? refreshing
                ? "Refreshing"
                : "Refresh"
              : null}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {failed
            ? "Refresh failed. Try again."
            : timestamp
              ? `Last refreshed ${timestamp}`
              : label}
        </TooltipContent>
      </Tooltip>
      {failed && presentation === "default" ? (
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
