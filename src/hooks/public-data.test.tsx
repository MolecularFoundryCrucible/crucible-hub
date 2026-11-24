import { QueryClient } from "@tanstack/react-query"
import { describe, expect, it, vi } from "vitest"

import { accountPreferencesQueryOptions } from "@/data/crucible/preferences.queries"
import { identityScope } from "@/data/crucible/query-keys"

import { loadIncludePublicByDefault } from "./public-data"

vi.mock("@/data/crucible/preferences.functions", () => ({
  getAccountPreferences: vi.fn(),
  updateAccountPreferences: vi.fn(),
}))

const scope = identityScope("crucible-fixture:populated", "account")

describe("loadIncludePublicByDefault", () => {
  it("excludes public data when the preference is unset and follows the saved one", async () => {
    const client = new QueryClient()
    client.setQueryData(accountPreferencesQueryOptions(scope).queryKey, {
      preferences: {},
    } as never)
    await expect(loadIncludePublicByDefault(client, scope)).resolves.toBe(false)

    const saved = new QueryClient()
    saved.setQueryData(accountPreferencesQueryOptions(scope).queryKey, {
      preferences: { hub: { include_public_data: true } },
    } as never)
    await expect(loadIncludePublicByDefault(saved, scope)).resolves.toBe(true)
  })
})
