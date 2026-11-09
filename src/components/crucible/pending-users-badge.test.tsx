import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { PendingUsersBadge } from "./pending-users-badge"
import { identityScope } from "@/data/crucible/query-keys"
import { getWorkspacePendingUsers } from "@/data/crucible/user-approvals.functions"

vi.mock("@/data/crucible/user-approvals.functions", () => ({
  getWorkspacePendingUsers: vi.fn(),
}))
vi.mock("./workspace-provider", () => ({
  useOptionalWorkspaceScope: () =>
    identityScope("server-1", "admin-1", "normal"),
}))

function renderBadge(enabled: boolean) {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <PendingUsersBadge enabled={enabled} />
    </QueryClientProvider>
  )
}

describe("PendingUsersBadge", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getWorkspacePendingUsers).mockResolvedValue({
      status: "ok",
      data: { items: [], total: 3 },
    } as never)
  })
  afterEach(cleanup)

  it("waits until administrator view is confirmed before asking", () => {
    renderBadge(false)
    expect(vi.mocked(getWorkspacePendingUsers)).not.toHaveBeenCalled()
  })

  it("shows how many accounts are waiting", async () => {
    renderBadge(true)
    expect(
      await screen.findByLabelText("3 accounts waiting for approval")
    ).toBeTruthy()
    await waitFor(() =>
      expect(vi.mocked(getWorkspacePendingUsers)).toHaveBeenCalledTimes(1)
    )
  })
})
