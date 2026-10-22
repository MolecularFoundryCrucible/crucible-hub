import { act, cleanup, render, screen } from "@testing-library/react"
import { useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import type * as Motion from "@/lib/motion"

import { ListExpansionToggle } from "./list-expansion-toggle"

vi.mock("@/lib/motion", async (importOriginal) => ({
  ...(await importOriginal<typeof Motion>()),
  motionDuration: () => 180,
}))

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function Harness({
  initiallyExpanded,
  onChange,
}: {
  initiallyExpanded: boolean
  onChange: (expanded: boolean) => void
}) {
  const [expanded, setExpanded] = useState(initiallyExpanded)
  return (
    <div data-testid="scroller">
      <ul id="rows" />
      <ListExpansionToggle
        controls="rows"
        expanded={expanded}
        noun="rows"
        onExpandedChange={(next) => {
          onChange(next)
          setExpanded(next)
        }}
        total={20}
      />
    </div>
  )
}

function rect(values: Partial<DOMRect>) {
  return { height: 0, top: 0, ...values } as DOMRect
}

describe("ListExpansionToggle", () => {
  it("times the growth from the standard motion token", () => {
    let height = 100
    render(
      <Harness
        initiallyExpanded={false}
        onChange={() => {
          height = 300
        }}
      />
    )
    const region = document.getElementById("rows") as HTMLElement
    region.getBoundingClientRect = () => rect({ height })
    const animate = vi.fn(() => ({}) as Animation)
    region.animate = animate

    act(() => screen.getByRole("button").click())

    expect(animate).toHaveBeenCalledWith(
      [{ height: "100px" }, { height: "300px" }],
      expect.objectContaining({ duration: 180 })
    )
  })

  it("keeps the toggle in place by scrolling its own scroll container", () => {
    let top = 500
    render(
      <Harness
        initiallyExpanded
        onChange={() => {
          top = 200
        }}
      />
    )
    const button = screen.getByRole("button")
    button.getBoundingClientRect = () => rect({ top })
    const scroller = screen.getByTestId("scroller")
    scroller.style.overflowY = "auto"
    scroller.scrollBy = vi.fn()
    const windowScroll = vi
      .spyOn(window, "scrollBy")
      .mockImplementation(() => {})

    act(() => button.click())

    expect(scroller.scrollBy).toHaveBeenCalledWith({
      behavior: "instant",
      top: -300,
    })
    expect(windowScroll).not.toHaveBeenCalled()
  })
})
