import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { BrandMark } from "./brand-mark"

afterEach(cleanup)

describe("BrandMark", () => {
  it("renders the hub logo with background by default", () => {
    const { container } = render(<BrandMark />)
    const images = container.querySelectorAll("img")
    expect(images).toHaveLength(1)

    const [logoImg] = images
    expect(logoImg.getAttribute("src")).toContain("crucible-logo-hub")
  })

  it("renders light and dark theme icons when variant is icon", () => {
    const { container } = render(<BrandMark variant="icon" />)
    const images = container.querySelectorAll("img")
    expect(images).toHaveLength(2)

    const [lightImg, darkImg] = images
    expect(lightImg.getAttribute("src")).toContain("crucible-icon-light")
    expect(lightImg.className).toContain("dark:hidden")

    expect(darkImg.getAttribute("src")).toContain("crucible-icon-dark")
    expect(darkImg.className).toContain("hidden")
    expect(darkImg.className).toContain("dark:block")
  })

  it("merges custom className onto wrapper span", () => {
    const { container } = render(<BrandMark className="size-4 opacity-75" />)
    const span = container.querySelector("span")
    expect(span?.className).toContain("size-4")
    expect(span?.className).toContain("opacity-75")
  })
})
