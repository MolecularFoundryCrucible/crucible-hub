import { QueryClientProvider, useInfiniteQuery } from "@tanstack/react-query"
import { render, waitFor } from "@testing-library/react"
import { expect, it, vi } from "vitest"

import { HubApiClientError } from "./crucible/result"
import { createQueryClient } from "./query-client"
import { prefetchInfiniteQueryWithReadableCache } from "./query-prefetch"

it("shows a loader-cached access error on mount without asking again", async () => {
  const client = createQueryClient()
  const queryFn = vi.fn(async () => {
    throw new HubApiClientError({
      correlationId: "test",
      kind: "forbidden",
      message: "You do not have permission to view this project data.",
      retryable: false,
    })
  })
  const options = {
    getNextPageParam: () => undefined,
    initialPageParam: undefined,
    queryFn,
    queryKey: ["crucible", "project-data"],
  }
  await prefetchInfiniteQueryWithReadableCache(client, options)
  const statuses: string[] = []
  function ProjectData() {
    const result = useInfiniteQuery(options)
    statuses.push(result.status)
    return <span>{result.status}</span>
  }

  const view = render(
    <QueryClientProvider client={client}>
      <ProjectData />
    </QueryClientProvider>
  )

  await waitFor(() => expect(view.container.textContent).toBe("error"))
  expect(statuses[0]).toBe("error")
  expect(queryFn).toHaveBeenCalledTimes(1)
})
