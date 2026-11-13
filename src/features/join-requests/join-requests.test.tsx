import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { isProjectMember } from "./join-request-messages"
import { JoinRequestQueue } from "./join-request-review"
import { RequestToJoinProject } from "./request-to-join"
import {
  createJoinRequestFn,
  getJoinRequests,
  reviewJoinRequestFn,
  withdrawJoinRequestFn,
} from "@/data/crucible/join-requests.functions"
import { HubApiClientError } from "@/data/crucible/result"
import type { WorkspaceJoinRequest } from "@/data/crucible/workspace-source"

vi.mock("@/components/crucible/workspace-provider", () => ({
  useWorkspaceScope: () => ["server-1", "person-1", "normal"],
}))

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}))

vi.mock("@/data/crucible/join-requests.functions", () => ({
  createJoinRequestFn: vi.fn(),
  getJoinRequests: vi.fn(),
  reviewJoinRequestFn: vi.fn(),
  withdrawJoinRequestFn: vi.fn(),
}))

const pendingRequest: WorkspaceJoinRequest = {
  capabilities: { can_review: true, can_withdraw: true },
  granted_role: null,
  id: 41,
  project: {
    project_id: "operando",
    title: "Operando Catalyst Mapping",
    unique_id: "project-1",
  },
  project_mfid: "project-1",
  reason: "I run the in-situ cell.",
  request_time: "2026-11-10T09:00:00Z",
  requester: {
    first_name: "Riley",
    is_service_account: false,
    last_name: "Park",
    unique_id: "person-42",
    username: "riley.park",
  },
  requester_id: "person-42",
  review_time: null,
  reviewer: null,
  reviewer_id: null,
  reviewer_notes: null,
  status: "pending",
}

function wrap(children: React.ReactNode) {
  return (
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      {children}
    </QueryClientProvider>
  )
}

describe("isProjectMember", () => {
  it("counts a role, the owner or a member listing", () => {
    expect(isProjectMember({ role: "viewer" }, "me")).toBe(true)
    expect(isProjectMember({ owner: { unique_id: "me" } }, "me")).toBe(true)
    expect(isProjectMember({ members: [{ unique_id: "me" }] }, "me")).toBe(true)
    expect(isProjectMember({ role: null, members: [] }, "me")).toBe(false)
  })
})

describe("RequestToJoinProject", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getJoinRequests).mockResolvedValue({
      data: { items: [], nextCursor: null, total: 0 },
      status: "ok",
    })
    vi.mocked(createJoinRequestFn).mockResolvedValue({
      data: pendingRequest,
      status: "ok",
    })
    vi.mocked(withdrawJoinRequestFn).mockResolvedValue({
      data: undefined,
      status: "ok",
    })
  })
  afterEach(cleanup)

  it("sends a request with a reason", async () => {
    render(
      wrap(
        <RequestToJoinProject
          projectMfid="project-1"
          projectName="Operando Catalyst Mapping"
        />
      )
    )

    fireEvent.click(
      await screen.findByRole("button", { name: "Request to join" })
    )
    const dialog = await screen.findByRole("dialog", {
      name: "Request to join",
    })
    fireEvent.change(within(dialog).getByLabelText(/Reason/), {
      target: { value: "I run the in-situ cell." },
    })
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Send request" })
    )

    await waitFor(() =>
      expect(vi.mocked(createJoinRequestFn)).toHaveBeenCalledWith({
        data: expect.objectContaining({
          projectRef: "project-1",
          reason: "I run the in-situ cell.",
        }),
      })
    )
  })

  it("explains why a request was refused", async () => {
    vi.mocked(createJoinRequestFn).mockRejectedValue(
      new HubApiClientError({
        conflictCode: "project_not_accepting_requests",
        correlationId: "c",
        kind: "conflict",
        message: "conflict",
        retryable: false,
      })
    )
    render(
      wrap(<RequestToJoinProject projectMfid="project-1" projectName="P" />)
    )

    fireEvent.click(
      await screen.findByRole("button", { name: "Request to join" })
    )
    const dialog = await screen.findByRole("dialog", {
      name: "Request to join",
    })
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Send request" })
    )

    expect(
      await within(dialog).findByText(
        "This project isn't accepting requests to join."
      )
    ).toBeTruthy()
  })

  it("shows a pending request and withdraws it", async () => {
    vi.mocked(getJoinRequests).mockResolvedValue({
      data: { items: [pendingRequest], nextCursor: null, total: 1 },
      status: "ok",
    })
    render(
      wrap(<RequestToJoinProject projectMfid="project-1" projectName="P" />)
    )

    expect(await screen.findByText("Request pending")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Withdraw" }))

    await waitFor(() =>
      expect(vi.mocked(withdrawJoinRequestFn)).toHaveBeenCalledWith({
        data: expect.objectContaining({ requestId: 41 }),
      })
    )
  })
})

describe("JoinRequestQueue", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getJoinRequests).mockResolvedValue({
      data: { items: [pendingRequest], nextCursor: null, total: 1 },
      status: "ok",
    })
    vi.mocked(reviewJoinRequestFn).mockResolvedValue({
      data: { ...pendingRequest, status: "approved" },
      status: "ok",
    })
  })
  afterEach(cleanup)

  function renderQueue() {
    render(
      wrap(
        <JoinRequestQueue
          emptyTitle="No requests need review"
          filters={{ scope: "reviewable", status: "pending" }}
        />
      )
    )
  }

  it("lists requests in the shared table with a count", async () => {
    renderQueue()

    const table = await screen.findByRole("table", {
      name: "Requests to join",
    })
    expect(within(table).getByText("R. Park")).toBeTruthy()
    expect(within(table).getByText("Operando Catalyst Mapping")).toBeTruthy()
    expect(screen.getByText("All 1 join requests shown")).toBeTruthy()
  })

  it("approves with the chosen role", async () => {
    renderQueue()

    fireEvent.click(await screen.findByRole("button", { name: "Review" }))
    const dialog = await screen.findByRole("dialog", {
      name: "Review request",
    })
    expect(within(dialog).getByText("I run the in-situ cell.")).toBeTruthy()
    fireEvent.change(within(dialog).getByLabelText("Role if approved"), {
      target: { value: "editor" },
    })
    fireEvent.click(within(dialog).getByRole("button", { name: "Approve" }))

    await waitFor(() =>
      expect(vi.mocked(reviewJoinRequestFn)).toHaveBeenCalledWith({
        data: expect.objectContaining({
          requestId: 41,
          role: "editor",
          status: "approved",
        }),
      })
    )
  })

  it("rejects without a role", async () => {
    renderQueue()

    fireEvent.click(await screen.findByRole("button", { name: "Review" }))
    const dialog = await screen.findByRole("dialog", {
      name: "Review request",
    })
    fireEvent.click(within(dialog).getByRole("button", { name: "Reject" }))

    await waitFor(() =>
      expect(vi.mocked(reviewJoinRequestFn)).toHaveBeenCalledWith({
        data: expect.objectContaining({ role: undefined, status: "rejected" }),
      })
    )
  })

  it("shows the empty state", async () => {
    vi.mocked(getJoinRequests).mockResolvedValue({
      data: { items: [], nextCursor: null, total: 0 },
      status: "ok",
    })
    renderQueue()

    expect(await screen.findByText("No requests need review")).toBeTruthy()
  })
})
