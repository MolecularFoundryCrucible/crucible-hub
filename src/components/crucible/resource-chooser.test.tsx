import { useState } from "react"
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

  function Wrapper({
    initialValue,
  }: {
    initialValue: WorkspaceSearchResult | undefined
  }) {
    const [val, setVal] = useState<WorkspaceSearchResult | undefined>(
      initialValue
    )
    return (
      <QueryClientProvider client={queryClient}>
        <WorkspaceProvider mode="fixture" scope={scope}>
          <ResourceChooser
            kind="instrument"
            {...props}
            onChange={(next) => {
              setVal(next)
              onChange(next)
              props.onChange?.(next)
            }}
            value={val}
          />
        </WorkspaceProvider>
      </QueryClientProvider>
    )
  }

  const utils = render(<Wrapper initialValue={props.value} />)
  return { ...utils, onChange }
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
    const { onChange } = renderChooser({ allowBrowse: false })

    const input = screen.getByRole("combobox", { name: "Search instruments" })
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: "be" } })
    expect(getWorkspaceSearch).not.toHaveBeenCalled()

    fireEvent.change(input, { target: { value: "beam" } })
    fireEvent.keyDown(input, { key: "ArrowDown" })

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
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull())
    expect(screen.getByDisplayValue("Beamline 5.3.2")).toBeTruthy()
  })

  it("allows browsing and selecting without typing a search query", async () => {
    vi.mocked(getWorkspaceSearch).mockResolvedValue(
      response("instrument", [instrument])
    )
    const { onChange } = renderChooser()

    const input = screen.getByRole("combobox", { name: "Search instruments" })
    fireEvent.click(input)

    expect(
      await screen.findByText(
        "Available instruments (enter at least 3 characters to search all)"
      )
    ).toBeTruthy()
    expect(await screen.findByText("Synchrotron beamline")).toBeTruthy()

    fireEvent.click(screen.getByRole("option", { name: /Beamline 5.3.2/ }))
    expect(onChange).toHaveBeenCalledWith(instrument)
    expect(screen.getByDisplayValue("Beamline 5.3.2")).toBeTruthy()
  })

  it("does not open the browse popup on focus alone", () => {
    vi.mocked(getWorkspaceSearch).mockResolvedValue(
      response("instrument", [instrument])
    )
    renderChooser()

    const input = screen.getByRole("combobox", { name: "Search instruments" })
    fireEvent.focus(input)

    expect(screen.queryByRole("listbox")).toBeNull()
  })

  it("keeps pending and error feedback inside the dropdown", async () => {
    let rejectSearch: ((reason?: unknown) => void) | undefined
    vi.mocked(getWorkspaceSearch).mockImplementation((opts) => {
      if (!opts.data.query) {
        return Promise.resolve(response("project", []))
      }
      return new Promise((_, reject) => {
        rejectSearch = reject
      })
    })
    renderChooser({ kind: "project" })

    const input = screen.getByRole("combobox", { name: "Search projects" })
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: "catalyst" } })
    fireEvent.keyDown(input, { key: "ArrowDown" })
    expect((await screen.findByRole("status")).textContent).toBe(
      "Searching projects…"
    )
    await waitFor(() =>
      expect(getWorkspaceSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ query: "catalyst" }),
        })
      )
    )
    rejectSearch?.(new Error("search failed"))
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Projects could not be searched."
    )
  })

  it("shows a kind-specific empty state without changing the selection", async () => {
    vi.mocked(getWorkspaceSearch).mockResolvedValue(response("project", []))
    const { onChange } = renderChooser({ kind: "project" })

    const input = screen.getByRole("combobox", { name: "Search projects" })
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: "missing" } })
    fireEvent.keyDown(input, { key: "ArrowDown" })
    expect(
      await screen.findByText("No available projects matched this search.")
    ).toBeTruthy()
    expect(onChange).not.toHaveBeenCalled()
  })

  it("clears a confirmed selection", () => {
    const { onChange } = renderChooser({ value: instrument })

    expect(screen.getByDisplayValue("Beamline 5.3.2")).toBeTruthy()
    expect(screen.getByText(`(${instrument.unique_id})`)).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Clear instrument" }))

    expect(onChange).toHaveBeenCalledWith(undefined)
  })

  it("supports people and custom empty labels", async () => {
    vi.mocked(getWorkspaceSearch).mockResolvedValue(
      response("person", [person])
    )
    const { onChange } = renderChooser({
      emptyLabel: "Not selected",
      kind: "person",
    })

    const input = screen.getByRole("combobox", { name: "Search people" })
    expect(input.getAttribute("placeholder")).toBe("Not selected")

    fireEvent.focus(input)
    fireEvent.change(input, {
      target: { value: "ada" },
    })
    fireEvent.keyDown(input, { key: "ArrowDown" })
    expect(await screen.findByText("Ada Lovelace")).toBeTruthy()
    fireEvent.click(screen.getByRole("option", { name: /Ada Lovelace/ }))
    expect(onChange).toHaveBeenCalledWith(person)
  })

  it("shows browse suggestions immediately after clearing an existing selection", async () => {
    vi.mocked(getWorkspaceSearch).mockResolvedValue(
      response("person", [person])
    )
    const { onChange } = renderChooser({
      emptyLabel: "Choose a project lead",
      excludeServiceAccounts: true,
      kind: "person",
      value: person,
    })

    expect(screen.getByDisplayValue("Ada Lovelace")).toBeTruthy()
    expect(screen.getByText(`(${person.unique_id})`)).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Clear person" }))
    expect(onChange).toHaveBeenCalledWith(undefined)

    expect(
      await screen.findByText(
        "Available people (enter at least 3 characters to search all)"
      )
    ).toBeTruthy()
    expect(screen.getByRole("option", { name: /Ada Lovelace/ })).toBeTruthy()
  })
})
