import { act, cleanup, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { DelayedPendingIcon } from "./pending-icon"

vi.mock("@/lib/motion", () => ({ motionDuration: () => 200 }))

describe("DelayedPendingIcon", () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it("shows the spinner only after the indicator delay", () => {
    const { container, rerender } = render(<DelayedPendingIcon pending />)
    act(() => vi.advanceTimersByTime(199))
    expect(container.querySelector("svg")).toBeNull()
    act(() => vi.advanceTimersByTime(1))
    expect(container.querySelector("svg")).not.toBeNull()

    rerender(<DelayedPendingIcon pending={false} />)
    expect(container.querySelector("svg")).toBeNull()
  })
})
