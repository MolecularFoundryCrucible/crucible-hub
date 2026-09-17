import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { PrincipalTypeIcon, ResourceTypeIcon } from "./resource-type-icon"

describe("semantic type icons", () => {
  afterEach(cleanup)

  it.each([
    ["project", "text-(--resource-project)"],
    ["instrument", "text-(--resource-instrument)"],
    ["file", "text-(--resource-file)"],
    ["person", "text-(--resource-person)"],
    ["sample", "text-(--resource-sample)"],
    ["dataset", "text-(--resource-dataset)"],
  ] as const)("applies the shared %s color", (type, colorClass) => {
    const { container } = render(<ResourceTypeIcon type={type} />)

    expect(
      container
        .querySelector(`[data-resource-type="${type}"]`)
        ?.classList.contains(colorClass)
    ).toBe(true)
  })

  it("exposes a principal label only when requested", () => {
    const { container, rerender } = render(
      <PrincipalTypeIcon label="Person" type="user" />
    )

    const person = container.querySelector('[data-principal-type="user"]')
    expect(person?.getAttribute("aria-label")).toBe("Person")
    expect(person?.getAttribute("role")).toBe("img")
    expect(person?.classList.contains("text-(--resource-person)")).toBe(true)

    rerender(<PrincipalTypeIcon type="service_account" />)
    expect(
      container
        .querySelector('[data-principal-type="service_account"]')
        ?.getAttribute("aria-hidden")
    ).toBe("true")
  })
})
