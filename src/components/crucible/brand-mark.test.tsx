import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import crucibleIconDarkUrl from "@/assets/crucible-icon-dark.svg"
import crucibleIconLightUrl from "@/assets/crucible-icon-light.svg"
import crucibleLogoHubUrl from "@/assets/crucible-logo-hub.svg"

import { BrandMark } from "./brand-mark"

afterEach(cleanup)

describe("BrandMark", () => {
  it("renders the hub logo with background by default", () => {
    const { container } = render(<BrandMark />)
    const span = container.querySelector("span")
    expect(span?.className).toContain("size-8")
    expect(span?.className).toContain("overflow-hidden")
    const images = container.querySelectorAll("img")
    expect(images).toHaveLength(1)

    const [logoImg] = images
    expect(logoImg.getAttribute("src")).toBe(crucibleLogoHubUrl)
    expect(logoImg.className).toContain("object-cover")
  })

  it("renders light and dark theme icons when variant is icon", () => {
    const { container } = render(<BrandMark variant="icon" />)
    const span = container.querySelector("span")
    expect(span?.className).toContain("size-4")
    const images = container.querySelectorAll("img")
    expect(images).toHaveLength(2)

    const [lightImg, darkImg] = images
    expect(lightImg.getAttribute("src")).toBe(crucibleIconLightUrl)
    expect(lightImg.className).toContain("dark:hidden")

    expect(darkImg.getAttribute("src")).toBe(crucibleIconDarkUrl)
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
