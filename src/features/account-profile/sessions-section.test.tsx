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

import { SessionsSection } from "./sessions-section"
import type { SessionOwner } from "./sessions-section"
import { identityScope } from "@/data/crucible/query-keys"
import {
  endOtherWorkspaceSessionsFn,
  endWorkspaceSessionFn,
  getWorkspaceSessions,
} from "@/data/crucible/sessions.functions"
import type { WorkspaceSignedInSession } from "@/data/crucible/workspace-source"

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getRouteApi: () => ({
    useLoaderData: () => ({ sessionAuth: true, status: "ready" }),
  }),
}))
vi.mock("@/data/crucible/sessions.functions", () => ({
  endOtherWorkspaceSessionsFn: vi.fn(async () => ({ status: "ok" })),
  endWorkspaceSessionFn: vi.fn(async () => ({ status: "ok" })),
  getWorkspaceSessions: vi.fn(),
}))
vi.mock("@/components/crucible/notifications", () => ({
  notifyError: vi.fn(),
  notifySuccess: vi.fn(),
}))

const hub: WorkspaceSignedInSession = {
  client_id: "crucible-hub",
  client_name: "Crucible Hub",
  created_at: "2026-11-06T10:00:00Z",
  current: true,
  expires_at: "2026-12-06T10:00:00Z",
  id: "s-hub",
  last_used_at: "2026-11-06T12:00:00Z",
  signed_in_at: "2026-11-06T10:00:00Z",
}
const cli: WorkspaceSignedInSession = {
  ...hub,
  client_id: "nano-crucible",
  client_name: "nano-crucible",
  current: false,
  id: "s-cli",
}

function renderSection(owner: SessionOwner = { kind: "self" }) {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <form action="/hub/auth/logout" id="hub-sign-out" method="post" />
      <SessionsSection
        owner={owner}
        scope={identityScope("server-1", "person-1")}
      />
    </QueryClientProvider>
  )
}

describe("SessionsSection", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getWorkspaceSessions).mockResolvedValue({
      data: { items: [hub, cli], nextCursor: null, total: 2 },
      status: "ok",
    })
  })
  afterEach(cleanup)

  it("lists sessions and marks this browser", async () => {
    renderSection()

    const table = await screen.findByRole("table", { name: "Sessions" })
    expect(within(table).getByText("This browser")).toBeTruthy()
    expect(within(table).getByText("nano-crucible")).toBeTruthy()
  })

  it("signs this browser out with the Hub's own sign-out", async () => {
    renderSection()

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Actions for Crucible Hub (this browser)",
      })
    )
    const item = await screen.findByRole("menuitem", { name: "Sign out" })
    expect(item.getAttribute("form")).toBe("hub-sign-out")
    expect(item.getAttribute("type")).toBe("submit")
  })

  it("ends another session after confirming", async () => {
    renderSection()

    fireEvent.click(
      await screen.findByRole("button", { name: "Actions for nano-crucible" })
    )
    fireEvent.click(await screen.findByRole("menuitem", { name: "Sign out" }))
    const dialog = await screen.findByRole("alertdialog", {
      name: "Sign out of nano-crucible?",
    })
    fireEvent.click(within(dialog).getByRole("button", { name: "Sign out" }))

    await waitFor(() =>
      expect(vi.mocked(endWorkspaceSessionFn)).toHaveBeenCalledWith({
        data: { sessionId: "s-cli", userId: undefined },
      })
    )
  })

  it("signs out everywhere else, and hides that with no other session", async () => {
    renderSection()

    fireEvent.click(
      await screen.findByRole("button", { name: "Sign out everywhere else" })
    )
    const dialog = await screen.findByRole("alertdialog", {
      name: "Sign out everywhere else?",
    })
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Sign out everywhere else" })
    )
    await waitFor(() =>
      expect(vi.mocked(endOtherWorkspaceSessionsFn)).toHaveBeenCalledWith({
        data: { userId: undefined },
      })
    )

    cleanup()
    vi.mocked(getWorkspaceSessions).mockResolvedValue({
      data: { items: [hub], nextCursor: null, total: 1 },
      status: "ok",
    })
    renderSection()
    await screen.findByRole("table", { name: "Sessions" })
    expect(
      screen.queryByRole("button", { name: "Sign out everywhere else" })
    ).toBeNull()
  })

  it("lets an administrator sign a person out everywhere", async () => {
    vi.mocked(getWorkspaceSessions).mockResolvedValue({
      data: {
        items: [{ ...cli, current: false }],
        nextCursor: null,
        total: 1,
      },
      status: "ok",
    })
    renderSection({ kind: "person", name: "Avery Chen", userId: "user-1" })

    fireEvent.click(
      await screen.findByRole("button", { name: "Sign out everywhere" })
    )
    const dialog = await screen.findByRole("alertdialog", {
      name: "Sign out Avery Chen everywhere?",
    })
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Sign out everywhere" })
    )
    await waitFor(() =>
      expect(vi.mocked(endOtherWorkspaceSessionsFn)).toHaveBeenCalledWith({
        data: { userId: "user-1" },
      })
    )
  })
})
