import {
  QueryClient,
  QueryClientProvider,
  dehydrate,
  hydrate,
} from "@tanstack/react-query"
import { act, cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  AdministratorViewProvider,
  AdministratorViewStatus,
  removeElevatedQueries,
  useAdministratorViewControl,
} from "./administrator-view-control"
import { crucibleKeys, identityScope } from "@/data/crucible/query-keys"

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

describe("removeElevatedQueries", () => {
  it("drops elevated entries that arrived with the page", async () => {
    const normal = identityScope("staging", "user-a")
    const elevated = identityScope("staging", "user-a", "elevated")
    const server = new QueryClient()
    server.setQueryData(crucibleKeys.accountProfile(normal), { id: "normal" })
    server.setQueryData(crucibleKeys.accountProfile(elevated), {
      id: "elevated",
    })
    const browser = new QueryClient()
    hydrate(browser, dehydrate(server))

    await removeElevatedQueries(browser, normal)

    expect(browser.getQueryData(crucibleKeys.accountProfile(elevated))).toBe(
      undefined
    )
    expect(browser.getQueryData(crucibleKeys.accountProfile(normal))).toEqual({
      id: "normal",
    })
  })
})
