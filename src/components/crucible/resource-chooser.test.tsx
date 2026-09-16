import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ResourceChooser } from "@/components/crucible/resource-chooser"
import type { ResourceChooserKind } from "@/components/crucible/resource-chooser"
import { WorkspaceProvider } from "@/components/crucible/workspace-provider"
import { identityScope } from "@/data/crucible/query-keys"
import { getWorkspaceSearch } from "@/data/crucible/search.functions"
import type {
  WorkspaceSearchKind,
  WorkspaceSearchResult,
} from "@/data/crucible/workspace-source"

vi.mock("@/data/crucible/search.functions", () => ({
  getWorkspaceSearch: vi.fn(),
}))

const scope = identityScope("crucible-fixture:populated", "test-account")
const instrument = {
  context: "Synchrotron beamline",
  kind: "instrument",
  name: "Beamline 5.3.2",
  unique_id: "01J6Y8N4Q2R7M9K3T5V0W1X2Z1",
} satisfies WorkspaceSearchResult
const person = {
  context: "@ada",
  kind: "person",
  name: "Ada Lovelace",
  unique_id: "ada",
} satisfies WorkspaceSearchResult

function response(
  kind: WorkspaceSearchKind,
  items: readonly WorkspaceSearchResult[],
  error = false
) {
  return {
    status: "ok" as const,
    data: {
      groups: [{ error, items, kind, total: error ? null : items.length }],
      query: "beam",
    },
  }
}

function renderChooser(
  props: Partial<React.ComponentProps<typeof ResourceChooser>> = {}
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const onChange = vi.fn()
  render(
    <QueryClientProvider client={queryClient}>
      <WorkspaceProvider mode="fixture" scope={scope}>
        <ResourceChooser
          kind="instrument"
          onChange={onChange}
          value={undefined}
          {...props}
        />
      </WorkspaceProvider>
    </QueryClientProvider>
  )
  return onChange
}

async function openChooser(kind: ResourceChooserKind = "instrument") {
  fireEvent.click(screen.getByRole("button", { name: `Choose ${kind}` }))
  await screen.findByRole("dialog", { name: `Choose ${kind}` })
}

describe("ResourceChooser", () => {
  afterEach(cleanup)

  beforeEach(() => {
    vi.mocked(getWorkspaceSearch).mockReset()
  })

  it("searches automatically after three characters and confirms a result", async () => {
    vi.mocked(getWorkspaceSearch).mockResolvedValue(
      response("instrument", [instrument])
    )
    const onChange = renderChooser()

    await openChooser()
    const input = screen.getByRole("searchbox", { name: "Search instruments" })
    fireEvent.change(input, { target: { value: "be" } })
    expect(getWorkspaceSearch).not.toHaveBeenCalled()

    expect(getWorkspaceSearch).not.toHaveBeenCalled()

    fireEvent.change(input, { target: { value: "beam" } })

    await waitFor(() =>
      expect(getWorkspaceSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            kinds: ["instrument"],
            limit: 8,
            query: "beam",
          }),
          signal: expect.any(AbortSignal),
        })
      )
    )
    expect(await screen.findByText("Synchrotron beamline")).toBeTruthy()
    expect(screen.getByText(instrument.unique_id)).toBeTruthy()

    fireEvent.click(screen.getByRole("option", { name: /Beamline 5.3.2/ }))
    expect(onChange).toHaveBeenCalledWith(instrument)
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())

    await openChooser()
    expect(
      screen.getByRole<HTMLInputElement>("searchbox", {
        name: "Search instruments",
      }).value
    ).toBe("")
    expect(screen.queryByText("Synchrotron beamline")).toBeNull()
    expect(getWorkspaceSearch).toHaveBeenCalledTimes(1)
  })

  it("keeps pending and error feedback inside the dialog", async () => {
    let rejectSearch: ((reason?: unknown) => void) | undefined
    vi.mocked(getWorkspaceSearch).mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectSearch = reject
        })
    )
    renderChooser({ kind: "project" })

    await openChooser("project")
    fireEvent.change(
      screen.getByRole("searchbox", { name: "Search projects" }),
      { target: { value: "catalyst" } }
    )
    expect((await screen.findByRole("status")).textContent).toBe(
      "Searching projects…"
    )
    rejectSearch?.(new Error("search failed"))
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Projects could not be searched."
    )
    expect(screen.getByRole("dialog", { name: "Choose project" })).toBeTruthy()
  })

  it("shows a kind-specific empty state without changing the selection", async () => {
    vi.mocked(getWorkspaceSearch).mockResolvedValue(response("project", []))
    const onChange = renderChooser({ kind: "project" })

    await openChooser("project")
    fireEvent.change(
      screen.getByRole("searchbox", { name: "Search projects" }),
      { target: { value: "missing" } }
    )
    expect(
      await screen.findByText("No available projects matched this search.")
    ).toBeTruthy()
    expect(onChange).not.toHaveBeenCalled()
  })

  it("clears a confirmed selection without opening the dialog", () => {
    const onChange = renderChooser({ value: instrument })

    expect(screen.getByText("Beamline 5.3.2")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Clear instrument" }))

    expect(onChange).toHaveBeenCalledWith(undefined)
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("supports people and custom empty labels", async () => {
    vi.mocked(getWorkspaceSearch).mockResolvedValue(
      response("person", [person])
    )
    const onChange = renderChooser({
      emptyLabel: "Not selected",
      kind: "person",
    })

    expect(screen.getByText("Not selected")).toBeTruthy()
    await openChooser("person")
    fireEvent.change(screen.getByRole("searchbox", { name: "Search people" }), {
      target: { value: "ada" },
    })
    expect(await screen.findByText("Ada Lovelace")).toBeTruthy()
    fireEvent.click(screen.getByRole("option", { name: /Ada Lovelace/ }))
    expect(onChange).toHaveBeenCalledWith(person)
  })
})
