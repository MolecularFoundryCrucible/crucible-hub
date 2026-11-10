import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { GraphFilterMenu, ResourceGraphLegend } from "./resource-graph-controls"
import { resolveResourceGraphDisplay } from "./resource-graph-display"

describe("graph filters", () => {
  afterEach(cleanup)

  it("hides a resource kind from the Filters menu", async () => {
    const onDisplayChange = vi.fn()
    render(
      <GraphFilterMenu
        display={resolveResourceGraphDisplay({})}
        onDisplayChange={onDisplayChange}
        portalContainer={undefined}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Filters" }))
    fireEvent.click(
      await screen.findByRole("menuitemcheckbox", { name: /Datasets/ })
    )

    expect(onDisplayChange).toHaveBeenCalledWith({ hidden: ["dataset"] })
  })

  it("counts active filters and offers to show everything", async () => {
    const onDisplayChange = vi.fn()
    render(
      <GraphFilterMenu
        display={resolveResourceGraphDisplay({
          associations: false,
          hide: ["sample"],
        })}
        onDisplayChange={onDisplayChange}
        portalContainer={undefined}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Filters, 2 active" }))
    fireEvent.click(
      await screen.findByRole("menuitem", { name: /Show everything/ })
    )

    expect(onDisplayChange).toHaveBeenCalledWith({
      associations: true,
      hidden: [],
    })
  })

  it("shows only visible kinds in the legend and the hidden count", () => {
    render(
      <ResourceGraphLegend
        display={resolveResourceGraphDisplay({ hide: ["dataset"] })}
        hiddenCount={3}
      />
    )

    expect(screen.getByText("Sample")).toBeTruthy()
    expect(screen.queryByText("Dataset")).toBeNull()
    expect(screen.getByText("3 hidden by filters")).toBeTruthy()
  })
})
