import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { PendingUserActions, PendingUsersCard } from "./pending-users-card"
import { identityScope } from "@/data/crucible/query-keys"
import {
  approveWorkspaceUserFn,
  getWorkspacePendingUsers,
  rejectWorkspaceUserFn,
} from "@/data/crucible/user-approvals.functions"
import type { WorkspaceAdminUser } from "@/data/crucible/workspace-source"

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}))
vi.mock("@/data/crucible/user-approvals.functions", () => ({
  approveWorkspaceUserFn: vi.fn(),
  getWorkspacePendingUsers: vi.fn(),
  rejectWorkspaceUserFn: vi.fn(),
}))
vi.mock("@/components/crucible/notifications", () => ({
  notifyError: vi.fn(),
  notifySuccess: vi.fn(),
}))

const waiting: WorkspaceAdminUser = {
  email: "jo.rivera@example.invalid",
  first_name: "Jo",
  is_service_account: false,
  last_name: "Rivera",
  pending_at: "2026-11-05T10:00:00Z",
  unique_id: "01JBQ0000000000000000000JR",
  username: "jo.rivera",
}

function renderCard() {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <PendingUsersCard
        scope={identityScope("server-1", "admin-1", "elevated")}
      />
    </QueryClientProvider>
  )
}

const conflict = (conflictCode: string) => ({
  status: "error" as const,
  error: {
    conflictCode,
    correlationId: "test",
    kind: "conflict",
    message: "Conflict.",
    retryable: false,
  },
})

describe("PendingUsersCard", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getWorkspacePendingUsers).mockResolvedValue({
      status: "ok",
      data: { items: [waiting], total: 1 },
    } as never)
  })
  afterEach(cleanup)

  it("shows nothing when nobody is waiting", async () => {
    vi.mocked(getWorkspacePendingUsers).mockResolvedValue({
      status: "ok",
      data: { items: [], total: 0 },
    } as never)
    renderCard()
    await waitFor(() =>
      expect(vi.mocked(getWorkspacePendingUsers)).toHaveBeenCalled()
    )
    expect(screen.queryByText("Waiting for approval")).toBeNull()
  })

  it("lists waiting accounts and approves one", async () => {
    vi.mocked(approveWorkspaceUserFn).mockResolvedValue({
      status: "ok",
      data: { ...waiting, pending_at: null },
    } as never)
    renderCard()

    expect(await screen.findByText("Waiting for approval")).toBeTruthy()
    expect(screen.getByText(/jo\.rivera@example\.invalid/)).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Approve" }))
    await waitFor(() =>
      expect(vi.mocked(approveWorkspaceUserFn)).toHaveBeenCalledWith({
        data: { userId: waiting.unique_id },
      })
    )
  })

  it("asks before rejecting and explains when the account is still referenced", async () => {
    vi.mocked(rejectWorkspaceUserFn).mockResolvedValue(
      conflict("still_referenced") as never
    )
    renderCard()

    fireEvent.click(await screen.findByRole("button", { name: "Reject" }))
    expect(await screen.findByText(/frees its username and login/)).toBeTruthy()
    fireEvent.click(
      screen
        .getAllByRole("button", { name: "Reject" })
        .find((button) => button.closest("[role=alertdialog]"))!
    )
    expect(
      await screen.findByText(/Other records refer to this account/)
    ).toBeTruthy()
  })

  it("explains an account that is no longer waiting", async () => {
    vi.mocked(approveWorkspaceUserFn).mockResolvedValue(
      conflict("not_pending") as never
    )
    renderCard()

    fireEvent.click(await screen.findByRole("button", { name: "Approve" }))
    expect(
      await screen.findByText("This account is no longer waiting for approval.")
    ).toBeTruthy()
  })

  it("leaves the deleted account unfetched when rejecting navigates away", async () => {
    vi.mocked(rejectWorkspaceUserFn).mockResolvedValue({
      status: "ok",
      data: null,
    } as never)
    const client = new QueryClient()
    const invalidate = vi.spyOn(client, "invalidateQueries")
    const onRejected = vi.fn()
    render(
      <QueryClientProvider client={client}>
        <PendingUserActions
          onRejected={onRejected}
          scope={identityScope("server-1", "admin-1", "elevated")}
          user={waiting}
        />
      </QueryClientProvider>
    )

    fireEvent.click(screen.getByRole("button", { name: "Reject" }))
    fireEvent.click(
      (await screen.findAllByRole("button", { name: "Reject" })).find(
        (button) => button.closest("[role=alertdialog]")
      )!
    )
    await waitFor(() => expect(onRejected).toHaveBeenCalled())
    expect(invalidate).toHaveBeenCalledWith(
      expect.objectContaining({ refetchType: "none" })
    )
  })
})
