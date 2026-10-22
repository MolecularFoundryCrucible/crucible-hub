import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  AdministratorViewProvider,
  AdministratorViewStatus,
  useAdministratorViewControl,
} from "./administrator-view-control"

vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({ invalidate: vi.fn() }),
}))
vi.mock("@/components/crucible/workspace-provider", () => ({
  useAccountPreferencesEnabled: () => false,
}))
vi.mock("@/data/crucible/privilege-mode.functions", () => ({
  updateGlobalPrivilegeMode: () => new Promise(() => {}),
}))

afterEach(cleanup)

function TurnOn() {
  const { setActive } = useAdministratorViewControl()
  return (
    <button onClick={() => setActive(true)} type="button">
      Turn on
    </button>
  )
}

describe("AdministratorViewStatus", () => {
  it("appears at full strength while the switch is pending", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AdministratorViewProvider
          privilegeMode="normal"
          scope={["crucible", "server", "account", "normal"]}
        >
          <TurnOn />
          <AdministratorViewStatus />
        </AdministratorViewProvider>
      </QueryClientProvider>
    )
    expect(screen.queryByRole("button", { name: /Turn off/ })).toBeNull()

    await act(async () => {
      screen.getByRole("button", { name: "Turn on" }).click()
    })

    const status = await screen.findByRole("button", {
      name: "Turn off administrator view",
    })
    expect(status.hasAttribute("disabled")).toBe(false)
    expect(status.getAttribute("aria-busy")).toBe("true")
  })
})
