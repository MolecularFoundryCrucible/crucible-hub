import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { ContentBoundary, ContentGrid, ContentGridItem } from "./content-layout"

afterEach(cleanup)

describe("ContentBoundary", () => {
  it.each([
    ["action", "max-w-action"],
    ["reading", "max-w-reading"],
    ["full", null],
  ] as const)("applies the %s width", (width, expectedClass) => {
    render(<ContentBoundary width={width}>Content</ContentBoundary>)

    const boundary = screen.getByText("Content")
    expect(boundary.classList.contains("w-full")).toBe(true)
    expect(boundary.classList.contains("min-w-0")).toBe(true)
    if (expectedClass) {
      expect(boundary.classList.contains(expectedClass)).toBe(true)
    } else {
      expect(boundary.className).not.toMatch(/max-w-/)
    }
  })
})

describe("ContentGrid", () => {
  it("uses the capped auto-fit action grid", () => {
    render(<ContentGrid variant="actions">Actions</ContentGrid>)

    expect(
      screen.getByText("Actions").classList.contains("content-grid-actions")
    ).toBe(true)
  })

  it("preserves detail item DOM order with semantic spans", () => {
    render(
      <ContentGrid variant="detail">
        <ContentGridItem span="wide">Summary</ContentGridItem>
        <ContentGridItem span="narrow">Identity</ContentGridItem>
        <ContentGridItem span="full">Metadata</ContentGridItem>
      </ContentGrid>
    )

    const grid = screen.getByText("Summary").parentElement
    if (!grid) {
      throw new Error("Expected detail grid")
    }
    expect(Array.from(grid.children).map((item) => item.textContent)).toEqual([
      "Summary",
      "Identity",
      "Metadata",
    ])
    expect(
      screen.getByText("Summary").classList.contains("xl:col-span-4")
    ).toBe(true)
    expect(
      screen.getByText("Identity").classList.contains("xl:col-span-3")
    ).toBe(true)
    expect(
      screen.getByText("Metadata").classList.contains("xl:col-span-7")
    ).toBe(true)
  })
})
