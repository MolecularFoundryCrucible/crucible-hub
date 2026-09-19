import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import {
  ScientificMetadata,
  ScientificMetadataViewer,
} from "./scientific-metadata"

describe("ScientificMetadata", () => {
  afterEach(cleanup)

  it("shows every top-level field without an arbitrary cutoff", () => {
    render(
      <ScientificMetadata
        metadata={{
          alpha: 1,
          beta: 2,
          delta: 4,
          epsilon: 5,
          eta: 7,
          gamma: 3,
          theta: 8,
          zeta: 6,
        }}
      />
    )

    expect(screen.getByText("alpha")).toBeTruthy()
    expect(screen.getByText("theta")).toBeTruthy()
    expect(screen.getByText("zeta")).toBeTruthy()
    expect(screen.queryByText(/additional field/)).toBeNull()
  })

  it("renders nested dictionaries and lists as recursive disclosures", () => {
    render(
      <ScientificMetadata
        expandFirstLevel
        metadata={{
          acquisition: {
            detector: {
              channels: ["fluorescence", { gain: 2 }, null],
              notes: "Complete scientific value\nwith a second line",
            },
            energy_ev: 7112,
          },
        }}
      />
    )

    const acquisitionSummary = screen.getByLabelText("acquisition: 2 fields")
    const detectorSummary = screen.getByLabelText("detector: 2 fields")
    expect(acquisitionSummary.tagName).toBe("SUMMARY")
    expect(acquisitionSummary.tabIndex).toBe(0)
    expect(acquisitionSummary.getAttribute("aria-label")).toBe(
      "acquisition: 2 fields"
    )
    expect(acquisitionSummary.closest("details")?.open).toBe(true)

    expect(detectorSummary.closest("details")?.open).toBe(false)
    fireEvent.click(detectorSummary)

    const listSummary = screen.getByLabelText("channels: 3 items")
    expect(listSummary.tagName).toBe("SUMMARY")
    expect(listSummary.getAttribute("aria-label")).toBe("channels: 3 items")
    fireEvent.click(listSummary)

    const listDetails = listSummary.closest("details")
    expect(within(listDetails!).getByText("fluorescence")).toBeTruthy()
    expect(within(listDetails!).getByText("1")).toBeTruthy()
    expect(within(listDetails!).getByText("3")).toBeTruthy()
    expect(within(listDetails!).getByText("Null")).toBeTruthy()
    expect(
      screen.getByText("Complete scientific value with a second line")
        .textContent
    ).toBe("Complete scientific value\nwith a second line")
  })

  it("labels empty nested collections and strings explicitly", () => {
    render(
      <ScientificMetadata
        metadata={{ empty_list: [], empty_object: {}, empty_string: "" }}
      />
    )

    expect(screen.getByText("[]")).toBeTruthy()
    expect(screen.getByText("{}")).toBeTruthy()
    expect(screen.getByText("Empty string")).toBeTruthy()
  })

  it("renders short scalar arrays inline", () => {
    render(
      <ScientificMetadata
        metadata={{ axes: ["energy", "intensity"], shape: [32, 64] }}
      />
    )

    expect(screen.getByText('["energy", "intensity"]')).toBeTruthy()
    expect(screen.getByText("[32, 64]")).toBeTruthy()
    expect(document.querySelector("details")).toBeNull()
  })

  it("filters nested metadata by field or value", () => {
    const metadata = {
      acquisition: { detector: "pilatus", energy_ev: 7112 },
      preparation: { solvent: "water" },
    }
    render(<ScientificMetadataViewer metadata={metadata} />)

    fireEvent.change(
      screen.getByRole("searchbox", { name: "Search scientific metadata" }),
      { target: { value: "pilatus" } }
    )

    expect(screen.getByLabelText("acquisition: 1 of 2 fields")).toBeTruthy()
    expect(
      screen.getByLabelText("acquisition: 1 of 2 fields").closest("details")
        ?.open
    ).toBe(true)
    expect(screen.getByText("detector")).toBeTruthy()
    expect(screen.queryByText("preparation")).toBeNull()

    fireEvent.change(
      screen.getByRole("searchbox", { name: "Search scientific metadata" }),
      { target: { value: "missing" } }
    )
    expect(screen.getByText("No metadata matches this search.")).toBeTruthy()
  })

  it("expands and collapses every metadata disclosure", () => {
    render(
      <ScientificMetadata
        metadata={{
          alpha: { nested: { value: 1 } },
          beta: 2,
          delta: 4,
          epsilon: 5,
          eta: 7,
          gamma: 3,
          theta: { value: 8 },
        }}
        showExpansionAction
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Expand all" }))
    expect(
      Array.from(document.querySelectorAll("details")).every(
        (details) => details.open
      )
    ).toBe(true)

    fireEvent.click(screen.getByRole("button", { name: "Collapse all" }))
    expect(
      Array.from(document.querySelectorAll("details")).every(
        (details) => !details.open
      )
    ).toBe(true)
  })

  it("handles absent and empty root metadata", () => {
    const { rerender } = render(<ScientificMetadata metadata={null} />)
    expect(
      screen.getByText("No scientific metadata is available.")
    ).toBeTruthy()

    rerender(
      <ScientificMetadata emptyMessage="Nothing recorded." metadata={{}} />
    )
    expect(screen.getByText("Nothing recorded.")).toBeTruthy()

    rerender(<ScientificMetadata metadata={[]} />)
    expect(
      screen.getByText("No scientific metadata is available.")
    ).toBeTruthy()
  })

  it("renders scalar roots without treating false or zero as absent", () => {
    const { rerender } = render(<ScientificMetadata metadata={false} />)
    expect(screen.getByText("false")).toBeTruthy()

    rerender(<ScientificMetadata metadata={0} />)
    expect(screen.getByText("0")).toBeTruthy()

    rerender(<ScientificMetadata metadata="raw value" />)
    expect(screen.getByText("raw value")).toBeTruthy()
  })
})
