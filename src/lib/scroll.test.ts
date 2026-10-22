import { describe, expect, it } from "vitest"

import { scrollContainer } from "./scroll"

function box(overflowY: string, scrollHeight: number, clientHeight: number) {
  const element = document.createElement("div")
  element.style.overflowY = overflowY
  Object.defineProperty(element, "scrollHeight", { value: scrollHeight })
  Object.defineProperty(element, "clientHeight", { value: clientHeight })
  return element
}

describe("scrollContainer", () => {
  it("skips an auto-overflow ancestor that has nothing to scroll", () => {
    const outer = box("auto", 900, 300)
    const inner = box("auto", 200, 200)
    const target = document.createElement("button")
    inner.append(target)
    outer.append(inner)
    document.body.append(outer)

    expect(scrollContainer(target)).toBe(outer)
    outer.remove()
  })

  it("falls back to the window", () => {
    const target = document.createElement("button")
    document.body.append(target)
    expect(scrollContainer(target)).toBe(window)
    target.remove()
  })
})
