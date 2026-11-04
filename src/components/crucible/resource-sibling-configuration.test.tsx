import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { TooltipProvider } from "@/components/ui/tooltip"
import { identityScope } from "@/data/crucible/query-keys"
import type { WorkspaceResourceDetail } from "@/data/crucible/workspace-source"

import { ResourceSiblingConfigurationAction } from "./resource-sibling-configuration"

const mocks = vi.hoisted(() => ({
  activate: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}))

vi.mock("./anchored-resource-siblings", () => ({
  createAnchoredResourceSiblingCollection: mocks.create,
}))
vi.mock("./resource-sibling-navigation", () => ({
  useActivateResourceSiblingCollection: () => mocks.activate,
  useClearResourceSiblingNavigation: () => vi.fn(),
}))
vi.mock("@/features/preferences/use-account-preferences", () => ({
  useAccountPreferences: () => ({
    enabled: true,
    preferences: {},
    update: mocks.update,
  }),
}))

const resource = {
  kind: "dataset",
  owner: null,
  project: { unique_id: "project" },
  unique_id: "dataset-1",
} as unknown as Extract<WorkspaceResourceDetail, { kind: "dataset" }>

function openDialog() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <TooltipProvider>
        <ResourceSiblingConfigurationAction
          navigation={null}
          resource={resource}
          scope={identityScope("server", "account", "normal")}
        />
      </TooltipProvider>
    </QueryClientProvider>
  )
  fireEvent.click(
    screen.getByRole("button", { name: /Change resource sequence/ })
  )
}

function selectValue(label: string) {
  return screen.getByLabelText<HTMLSelectElement>(label).value
}

describe("ResourceSiblingConfigurationAction", () => {
  afterEach(cleanup)

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.create.mockResolvedValue({ items: [] })
  })

  it("starts from the default and offers both project and type", () => {
    openDialog()
    expect(selectValue("Include")).toBe("project_subtype")
    expect(selectValue("Order by")).toBe("created")
    expect(selectValue("Direction")).toBe("asc")
  })

  it("does not change the saved default unless ticked", async () => {
    openDialog()
    fireEvent.change(screen.getByLabelText("Direction"), {
      target: { value: "desc" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Apply" }))
    await waitFor(() => expect(mocks.activate).toHaveBeenCalledOnce())
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it("saves the selection when ticked", async () => {
    openDialog()
    fireEvent.change(screen.getByLabelText("Direction"), {
      target: { value: "desc" },
    })
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Save as my default" })
    )
    fireEvent.click(screen.getByRole("button", { name: "Apply" }))
    await waitFor(() =>
      expect(mocks.update).toHaveBeenCalledWith({
        hub: {
          resource_sequence: {
            datasets: {
              direction: "desc",
              scope: "project_subtype",
              sort: "created",
            },
          },
        },
      })
    )
  })

  it("removes the saved value when the built-in default is ticked", async () => {
    openDialog()
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Save as my default" })
    )
    fireEvent.click(screen.getByRole("button", { name: "Apply" }))
    await waitFor(() =>
      expect(mocks.update).toHaveBeenCalledWith({
        hub: { resource_sequence: { datasets: null } },
      })
    )
  })
})
