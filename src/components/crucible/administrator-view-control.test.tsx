import { QueryClient, dehydrate, hydrate } from "@tanstack/react-query"
import { describe, expect, it, vi } from "vitest"

import { removeElevatedQueries } from "./administrator-view-control"
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
