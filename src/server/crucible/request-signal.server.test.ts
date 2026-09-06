import { describe, expect, it } from "vitest"

import { crucibleRequestSignal } from "./request-signal.server"

describe("Crucible request signal", () => {
  it("propagates caller cancellation into the upstream signal", () => {
    const controller = new AbortController()
    const signal = crucibleRequestSignal(controller.signal)

    controller.abort("query cancelled")

    expect(signal.aborted).toBe(true)
    expect(signal.reason).toBe("query cancelled")
  })
})
