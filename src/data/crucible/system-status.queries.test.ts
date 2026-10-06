import { describe, expect, it } from "vitest"

import { crucibleKeys } from "./query-keys"
import { systemStatusQueryOptions } from "./system-status.queries"

describe("system status query options", () => {
  it("creates query options with global system status key", () => {
    const options = systemStatusQueryOptions({ enabled: false })

    expect(options.queryKey).toEqual(crucibleKeys.systemStatus())
    expect(options.enabled).toBe(false)
    expect(options.staleTime).toBe(15_000)
    expect(options.gcTime).toBe(60_000)
    expect(options.refetchOnWindowFocus).toBe(false)
  })

  it("defaults enabled to true when not specified", () => {
    const options = systemStatusQueryOptions()

    expect(options.enabled).toBe(true)
  })
})
