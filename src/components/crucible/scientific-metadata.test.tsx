import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { ScientificMetadata } from "./scientific-metadata"

describe("ScientificMetadata", () => {
  afterEach(cleanup)

  it("bounds the initial field presentation behind native disclosure", () => {
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

    const summary = screen.getByText("2 additional fields")
    const details = summary.closest("details")

    expect(summary.tagName).toBe("SUMMARY")
    expect(details?.open).toBe(false)
    expect(within(details!).getByText("theta")).toBeTruthy()
    expect(within(details!).getByText("zeta")).toBeTruthy()

    fireEvent.click(summary)
    expect(details?.open).toBe(true)
  })

  it("renders nested dictionaries and lists as recursive disclosures", () => {
    render(
      <ScientificMetadata
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

    const [acquisitionSummary, detectorSummary] =
      screen.getAllByText("2 fields")
    expect(acquisitionSummary.tagName).toBe("SUMMARY")
    expect(acquisitionSummary.tabIndex).toBe(0)
    expect(acquisitionSummary.getAttribute("aria-label")).toBe(
      "acquisition: 2 fields"
    )
    fireEvent.click(acquisitionSummary)

    fireEvent.click(detectorSummary)

    const listSummary = screen.getByText("3 items")
    expect(listSummary.tagName).toBe("SUMMARY")
    expect(listSummary.getAttribute("aria-label")).toBe("channels: 3 items")
    fireEvent.click(listSummary)

    expect(screen.getByText("fluorescence")).toBeTruthy()
    expect(screen.getByText("1.")).toBeTruthy()
    expect(screen.getByText("3.")).toBeTruthy()
    expect(screen.getByText("Null")).toBeTruthy()
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

    expect(screen.getByText("Empty list")).toBeTruthy()
    expect(screen.getByText("Empty object")).toBeTruthy()
    expect(screen.getByText("Empty string")).toBeTruthy()
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
