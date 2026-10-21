import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import {
  DataCollectionIcon,
  PrincipalTypeIcon,
  ResourceTypeIcon,
} from "./resource-type-icon"

describe("semantic type icons", () => {
  afterEach(cleanup)

  it.each([
    ["project", "text-(--resource-project)"],
    ["instrument", "text-(--resource-instrument)"],
    ["file", "text-(--resource-file)"],
    ["person", "text-(--resource-person)"],
    ["sample", "text-(--resource-sample)"],
    ["dataset", "text-(--resource-dataset)"],
  ] as const)(
    "applies the shared %s color and default size",
    (type, colorClass) => {
      const { container } = render(<ResourceTypeIcon type={type} />)
      const icon = container.querySelector(`[data-resource-type="${type}"]`)

      expect(icon?.classList.contains(colorClass)).toBe(true)
      expect(icon?.classList.contains("size-icon-label")).toBe(true)
      expect(icon?.classList.contains("shrink-0")).toBe(true)
    }
  )

  it("applies identical default sizing across resource, principal, and data collection icons and merges size overrides", () => {
    const { container } = render(
      <div>
        <DataCollectionIcon />
        <ResourceTypeIcon type="sample" />
        <PrincipalTypeIcon type="service_account" />
        <ResourceTypeIcon className="size-6" type="dataset" />
        <PrincipalTypeIcon className="size-6" type="service_account" />
      </div>
    )

    for (const selector of [
      '[data-resource-collection="data"]',
      '[data-resource-type="sample"]',
      '[data-principal-type="service_account"]:not(.size-6)',
    ]) {
      const icon = container.querySelector(selector)
      expect(icon?.classList.contains("size-icon-label")).toBe(true)
      expect(icon?.classList.contains("shrink-0")).toBe(true)
    }

    for (const selector of [
      '[data-resource-type="dataset"]',
      '[data-principal-type="service_account"].size-6',
    ]) {
      const icon = container.querySelector(selector)
      expect(icon?.classList.contains("size-6")).toBe(true)
      expect(icon?.classList.contains("size-icon-label")).toBe(false)
    }
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
