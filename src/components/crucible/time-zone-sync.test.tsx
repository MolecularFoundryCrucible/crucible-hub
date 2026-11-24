import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { cleanup, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { timeZoneCookie } from "@/lib/time-zone"

import { TimeZoneSync } from "./time-zone-sync"

function renderSync(timeZone: string) {
  vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockReturnValue({
    timeZone,
  } as Intl.ResolvedDateTimeFormatOptions)
  const client = new QueryClient()
  const invalidate = vi.spyOn(client, "invalidateQueries")
  render(
    <QueryClientProvider client={client}>
      <TimeZoneSync />
    </QueryClientProvider>
  )
  return invalidate
}

describe("TimeZoneSync", () => {
  beforeEach(() => {
    document.cookie = `${timeZoneCookie}=; Path=/; Max-Age=0`
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it("refetches date-filtered data only when the browser time zone differs", () => {
    expect(renderSync("UTC")).not.toHaveBeenCalled()
    cleanup()
    vi.restoreAllMocks()

    expect(renderSync("America/Los_Angeles")).toHaveBeenCalledTimes(1)
  })
})
