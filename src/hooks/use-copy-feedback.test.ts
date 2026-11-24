import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { useCopyFeedback } from "./use-copy-feedback"

const writeText = vi.fn<(text: string) => Promise<void>>()

describe("useCopyFeedback", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    })
  })
  afterEach(() => {
    vi.useRealTimers()
    writeText.mockReset()
  })

  it("shows success, then resets after two seconds", async () => {
    writeText.mockResolvedValue()
    const { result } = renderHook(() => useCopyFeedback())

    await act(() => result.current.copy("mfid"))
    expect(writeText).toHaveBeenCalledWith("mfid")
    expect(result.current.state).toBe("success")

    act(() => vi.advanceTimersByTime(1999))
    expect(result.current.state).toBe("success")
    act(() => vi.advanceTimersByTime(1))
    expect(result.current.state).toBe("idle")
  })
})
