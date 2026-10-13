import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { HubApiClientError } from "@/data/crucible/result"

import { REAUTHENTICATION_CHANNEL, hubActionError } from "./reauthentication"

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

    const link = screen.getByRole("button", { name: /Sign in with ORCID/ })
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
})
