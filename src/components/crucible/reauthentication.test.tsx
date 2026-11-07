import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { HubApiClientError } from "@/data/crucible/result"

import {
  REAUTHENTICATION_CHANNEL,
  hubActionError,
  withReauthentication,
} from "./reauthentication"

vi.mock("@/components/crucible/notifications", () => ({
  notifySuccess: vi.fn(),
}))

const stepUpError = new HubApiClientError({
  correlationId: "step-up",
  kind: "reauthentication-required",
  message: "Sign in again to continue.",
  retryable: false,
})

describe("reauthentication prompt", () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it("confirms identity in a pop-up and keeps the page as it is", async () => {
    const open = vi.fn(() => ({}) as Window)
    vi.stubGlobal("open", open)
    render(<>{hubActionError(stepUpError, "Failed.")}</>)

    const link = screen.getByRole("button", { name: "Sign in again" })
    const fallback = new URL(
      link.getAttribute("href") ?? "",
      "https://hub.test"
    )
    expect(fallback.pathname).toBe("/hub/auth/login")
    expect(fallback.searchParams.get("max_age")).toBe("0")
    expect(fallback.searchParams.get("returnTo")).toMatch(/#reauthenticated$/)

    fireEvent.click(link)
    expect(open).toHaveBeenCalledTimes(1)
    const popup = new URL(
      (open.mock.calls[0] as unknown as [string])[0],
      "https://hub.test"
    )
    expect(popup.searchParams.get("returnTo")).toBe("/hub/reauthenticated")

    const channel = new BroadcastChannel(REAUTHENTICATION_CHANNEL)
    await act(async () => {
      channel.postMessage("reauthenticated")
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
    channel.close()
    expect(screen.getByRole("status").textContent).toContain("Signed in again")
  })

  it("retries the action itself after its own pop-up confirms", async () => {
    vi.stubGlobal(
      "open",
      vi.fn(() => ({}) as Window)
    )
    const retry = vi.fn()
    render(<>{hubActionError(stepUpError, "Failed.", "Needed.", retry)}</>)

    const channel = new BroadcastChannel(REAUTHENTICATION_CHANNEL)
    await act(async () => {
      channel.postMessage("reauthenticated")
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
    expect(retry).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: "Sign in again" }))
    await act(async () => {
      channel.postMessage("reauthenticated")
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
    channel.close()
    expect(retry).toHaveBeenCalledTimes(1)
  })
})

describe("withReauthentication", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it("returns the first result without a sign-in", async () => {
    const open = vi.fn()
    vi.stubGlobal("open", open)
    await expect(withReauthentication(async () => "done")).resolves.toBe("done")
    expect(open).not.toHaveBeenCalled()
  })

  it("opens the sign-in pop-up and repeats the action once confirmed", async () => {
    vi.stubGlobal(
      "open",
      vi.fn(() => ({ closed: false }) as Window)
    )
    const attempt = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(stepUpError)
      .mockResolvedValueOnce("created")
    const result = withReauthentication(attempt)
    await new Promise((resolve) => setTimeout(resolve, 0))
    const channel = new BroadcastChannel(REAUTHENTICATION_CHANNEL)
    channel.postMessage("reauthenticated")
    channel.close()

    await expect(result).resolves.toBe("created")
    expect(attempt).toHaveBeenCalledTimes(2)
  })

  it("gives the error back when the pop-up is blocked", async () => {
    vi.stubGlobal(
      "open",
      vi.fn(() => null)
    )
    const attempt = vi.fn(async () => {
      throw stepUpError
    })
    await expect(withReauthentication(attempt)).rejects.toBe(stepUpError)
    expect(attempt).toHaveBeenCalledTimes(1)
  })

  it("gives the error back when the pop-up closes without a sign-in", async () => {
    vi.useFakeTimers()
    vi.stubGlobal(
      "open",
      vi.fn(() => ({ closed: true }) as Window)
    )
    const attempt = vi.fn(async () => {
      throw stepUpError
    })
    const result = withReauthentication(attempt)
    const outcome = expect(result).rejects.toBe(stepUpError)
    await vi.advanceTimersByTimeAsync(1000)
    await outcome
    expect(attempt).toHaveBeenCalledTimes(1)
  })

  it("does not ask for a sign-in after other errors", async () => {
    const open = vi.fn()
    vi.stubGlobal("open", open)
    const failure = new Error("boom")
    await expect(
      withReauthentication(async () => {
        throw failure
      })
    ).rejects.toBe(failure)
    expect(open).not.toHaveBeenCalled()
  })
})
