import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { cleanup, renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { identityScope } from "@/data/crucible/query-keys"
import type { WorkspaceResourceDetail } from "@/data/crucible/workspace-source"

import type { ActiveResourceSiblingNavigation } from "./resource-sibling-navigation"
import { useDefaultResourceSequence } from "./use-default-resource-sequence"

const mocks = vi.hoisted(() => ({
  activate: vi.fn(),
  clear: vi.fn(),
  clearedMfid: null as string | null,
  create: vi.fn(),
  preferences: {},
}))

vi.mock("./anchored-resource-siblings", () => ({
  createAnchoredResourceSiblingCollection: mocks.create,
}))
vi.mock("./resource-sibling-navigation", () => ({
  useAutomaticResourceSiblingSession: () => ({
    activate: mocks.activate,
    clear: mocks.clear,
    clearedMfid: mocks.clearedMfid,
  }),
}))
vi.mock("@/features/preferences/use-account-preferences", () => ({
  useAccountPreferences: () => ({
    enabled: true,
    error: null,
    loaded: true,
    preferences: mocks.preferences,
  }),
}))

const resource = {
  kind: "dataset",
  public: false,
  unique_id: "dataset-1",
} as unknown as WorkspaceResourceDetail
const scope = identityScope("server", "account", "normal")

function render(
  navigation: ActiveResourceSiblingNavigation | null = null,
  enabled = true
) {
  const client = new QueryClient()
  return renderHook(
    () => useDefaultResourceSequence({ enabled, navigation, resource, scope }),
    {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    }
  )
}

describe("useDefaultResourceSequence", () => {
  afterEach(cleanup)

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.clearedMfid = null
    mocks.preferences = {}
    mocks.create.mockResolvedValue({ items: [] })
  })

  it("builds the default for a record opened outside a list", async () => {
    render()
    await waitFor(() => expect(mocks.activate).toHaveBeenCalledOnce())
    expect(mocks.create.mock.calls[0][0]).toMatchObject({
      affiliation: "member",
      configuration: { direction: "asc", scope: "subtype", sort: "created" },
    })
  })

  it("leaves a sequence the person chose alone", () => {
    const { result } = render({} as ActiveResourceSiblingNavigation)
    expect(mocks.create).not.toHaveBeenCalled()
    expect(result.current).toBe(false)
  })

  it("does nothing away from Overview", () => {
    render(null, false)
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it("does not rebuild on a page where it was cleared", () => {
    mocks.clearedMfid = "dataset-1"
    render()
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it("drops the automatic sequence when turned off", () => {
    mocks.preferences = {
      hub: {
        resource_sequence: {
          datasets: { direction: "asc", scope: "off", sort: "created" },
        },
      },
    }
    const { result } = render({
      automaticKey: "older",
    } as ActiveResourceSiblingNavigation)
    expect(mocks.create).not.toHaveBeenCalled()
    expect(mocks.clear).toHaveBeenCalledOnce()
    expect(result.current).toBe(false)
  })

  it("rebuilds when the saved default changed", async () => {
    render({ automaticKey: "older" } as ActiveResourceSiblingNavigation)
    await waitFor(() => expect(mocks.activate).toHaveBeenCalledOnce())
  })

  it("stops waiting and stays quiet when the reads fail", async () => {
    mocks.create.mockRejectedValue(new Error("unavailable"))
    const { result } = render()
    expect(result.current).toBe(true)
    await waitFor(() => expect(result.current).toBe(false))
    expect(mocks.activate).not.toHaveBeenCalled()
  })
})
