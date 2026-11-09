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

import { ApiKeysSection } from "./api-keys-section"
import { getWorkspaceAccount } from "@/data/crucible/account.functions"
import {
  createWorkspaceApiKeyFn,
  getWorkspaceApiKeys,
  renameWorkspaceApiKeyFn,
} from "@/data/crucible/api-keys.functions"
import { identityScope } from "@/data/crucible/query-keys"
import type { WorkspaceApiKey } from "@/data/crucible/workspace-source"

vi.mock("@/data/crucible/api-keys.functions", () => ({
  createWorkspaceApiKeyFn: vi.fn(),
  getWorkspaceApiKeys: vi.fn(),
  renameWorkspaceApiKeyFn: vi.fn(),
  revokeWorkspaceApiKeyFn: vi.fn(),
}))
vi.mock("@/data/crucible/account.functions", () => ({
  getWorkspaceAccount: vi.fn(),
}))
vi.mock("@/components/crucible/notifications", () => ({
  notifyError: vi.fn(),
  notifySuccess: vi.fn(),
}))

const workstation: WorkspaceApiKey = {
  created_at: "2026-10-01T00:00:00Z",
  expires_at: "2027-10-01T00:00:00Z",
  id: 3,
  last4: "7f3a",
  last_used_at: null,
  name: "Analysis workstation",
  older_routes: false,
  revoked_at: null,
  status: "active",
}

const oldLaptop: WorkspaceApiKey = {
  ...workstation,
  id: 1,
  last4: "9d04",
  name: "Old laptop",
  revoked_at: "2026-09-01T00:00:00Z",
  status: "revoked",
}

const page = (items: WorkspaceApiKey[]) => ({
  data: { items, nextCursor: null, total: items.length },
  status: "ok" as const,
})

function renderSection() {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <ApiKeysSection
        owner={{ canCreate: true, kind: "self" }}
        scope={identityScope("server-1", "person-1")}
      />
    </QueryClientProvider>
  )
}

async function openNewKeyDialog(name: string) {
  fireEvent.click(await screen.findByRole("button", { name: "New key" }))
  const dialog = await screen.findByRole("dialog", { name: "New API key" })
  fireEvent.change(within(dialog).getByLabelText("Name"), {
    target: { value: name },
  })
  return dialog
}

describe("ApiKeysSection", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getWorkspaceApiKeys).mockImplementation(async ({ data }) =>
      page(data.state === "active" ? [workstation] : [oldLaptop])
    )
    vi.mocked(getWorkspaceAccount).mockResolvedValue({
      data: { unique_id: "person-1", username: "achen" },
      status: "ok",
    } as never)
  })
  afterEach(cleanup)

  it("lists active keys by name and last four characters", async () => {
    renderSection()

    const table = await screen.findByRole("table", { name: "Active API keys" })
    expect(within(table).getByText("Analysis workstation")).toBeTruthy()
    expect(within(table).getByText("7f3a")).toBeTruthy()
    expect(document.getElementById("api-keys")?.textContent).toContain(
      "API keys"
    )
    expect(within(table).getByRole("columnheader", { name: "Expires" }))
  })

  it("shows revoked and expired keys without actions", async () => {
    renderSection()

    fireEvent.click(await screen.findByRole("button", { name: "Inactive" }))
    const table = await screen.findByRole("table", {
      name: "Inactive API keys",
    })
    expect(within(table).getByText("Old laptop")).toBeTruthy()
    expect(within(table).getByText("Revoked")).toBeTruthy()
    expect(within(table).queryByRole("button")).toBeNull()
  })

  it("creates a key that lasts a year by default and shows it once", async () => {
    vi.mocked(createWorkspaceApiKeyFn).mockResolvedValue({
      data: { ...workstation, api_key: "crucible_secret", id: 4 },
      status: "ok",
    })
    renderSection()

    const dialog = await openNewKeyDialog("  Beamline laptop ")
    fireEvent.click(within(dialog).getByRole("button", { name: "Create key" }))

    expect(
      await screen.findByRole("dialog", { name: "API key created" })
    ).toBeTruthy()
    expect(screen.getByDisplayValue("crucible_secret")).toBeTruthy()
    expect(vi.mocked(createWorkspaceApiKeyFn)).toHaveBeenCalledWith({
      data: { expiresAt: null, name: "Beamline laptop", scenario: undefined },
    })
  })

  it("sends a shorter expiry when one is chosen", async () => {
    vi.mocked(createWorkspaceApiKeyFn).mockResolvedValue({
      data: { ...workstation, api_key: "crucible_secret", id: 4 },
      status: "ok",
    })
    renderSection()

    const dialog = await openNewKeyDialog("Short")
    fireEvent.change(within(dialog).getByLabelText("Expires after"), {
      target: { value: "30" },
    })
    fireEvent.click(within(dialog).getByRole("button", { name: "Create key" }))

    await waitFor(() =>
      expect(vi.mocked(createWorkspaceApiKeyFn)).toHaveBeenCalled()
    )
    const { expiresAt } = vi.mocked(createWorkspaceApiKeyFn).mock.calls[0][0]
      .data
    const days = (Date.parse(expiresAt!) - Date.now()) / 86_400_000
    expect(days).toBeGreaterThan(29.9)
    expect(days).toBeLessThanOrEqual(30)
  })

  it("explains the active key limit", async () => {
    vi.mocked(createWorkspaceApiKeyFn).mockResolvedValue({
      error: {
        conflictCode: "too_many_keys",
        correlationId: "test",
        kind: "conflict",
        message: "Conflict.",
        retryable: false,
      },
      status: "error",
    })
    renderSection()

    const dialog = await openNewKeyDialog("Eleventh")
    fireEvent.click(within(dialog).getByRole("button", { name: "Create key" }))

    expect(
      await within(dialog).findByText(
        "You already have 10 active API keys. Revoke one before creating another."
      )
    ).toBeTruthy()
  })

  it("renames a key from its menu", async () => {
    vi.mocked(renameWorkspaceApiKeyFn).mockResolvedValue({
      data: { ...workstation, name: "Workstation" },
      status: "ok",
    })
    renderSection()

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Actions for Analysis workstation",
      })
    )
    fireEvent.click(await screen.findByRole("menuitem", { name: "Rename" }))
    const dialog = await screen.findByRole("dialog", {
      name: "Rename API key",
    })
    fireEvent.change(within(dialog).getByLabelText("Name"), {
      target: { value: "Workstation" },
    })
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }))

    await waitFor(() =>
      expect(vi.mocked(renameWorkspaceApiKeyFn)).toHaveBeenCalledWith({
        data: { keyId: 3, name: "Workstation", scenario: undefined },
      })
    )
  })
})
