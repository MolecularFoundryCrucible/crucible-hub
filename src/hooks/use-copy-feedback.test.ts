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

  it("restarts the timer when copying again", async () => {
    writeText.mockResolvedValue()
    const { result } = renderHook(() => useCopyFeedback())

    await act(() => result.current.copy("mfid"))
    act(() => vi.advanceTimersByTime(1500))
    await act(() => result.current.copy("mfid"))
    act(() => vi.advanceTimersByTime(1500))
    expect(result.current.state).toBe("success")
  })

  it("keeps an error until the next attempt", async () => {
    writeText.mockRejectedValue(new Error("denied"))
    const { result } = renderHook(() => useCopyFeedback())

    await act(() => result.current.copy("mfid"))
    act(() => vi.advanceTimersByTime(5000))
    expect(result.current.state).toBe("error")

    act(() => result.current.reset())
    expect(result.current.state).toBe("idle")
  })
})
