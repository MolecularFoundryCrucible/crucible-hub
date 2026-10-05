import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import {
  ResourceStatusBadge,
  resourceStatusLabel,
  resourceStatusVariant,
} from "./resource-status-badge"

describe("resourceStatusVariant", () => {
  it.each([
    ["active", "success"],
    ["ready", "success"],
    ["approved", "success"],
    ["maintenance", "warning"],
    ["pending", "warning"],
    ["degraded", "warning"],
    ["decommissioned", "destructive"],
    ["rejected", "destructive"],
    ["failed", "destructive"],
    ["error", "destructive"],
    ["archived", "secondary"],
    ["draft", "secondary"],
    ["completed", "secondary"],
    ["closed", "secondary"],
    ["custom", "outline"],
    ["unknown", "outline"],
  ] as const)("maps %s to variant %s", (status, expectedVariant) => {
    expect(resourceStatusVariant(status)).toBe(expectedVariant)
  })
})

describe("resourceStatusLabel", () => {
  it.each([
    ["active", "Active"],
    ["maintenance", "Maintenance"],
    ["decommissioned", "Decommissioned"],
    ["archived", "Archived"],
    ["pending", "Pending"],
    ["draft", "Draft"],
    ["completed", "Completed"],
    ["in_review", "In Review"],
    ["on-hold", "On Hold"],
    ["custom status", "Custom Status"],
  ])("formats %s as %s", (status, expectedLabel) => {
    expect(resourceStatusLabel(status)).toBe(expectedLabel)
  })
})

describe("ResourceStatusBadge", () => {
  afterEach(cleanup)

  it("renders active status with success variant and label", () => {
    const { container } = render(<ResourceStatusBadge status="active" />)
    const badge = container.querySelector('[data-slot="badge"]')
    expect(badge).toBeDefined()
    expect(badge?.textContent).toBe("Active")
  })

  it("renders maintenance status with warning variant and label", () => {
    const { container } = render(<ResourceStatusBadge status="maintenance" />)
    const badge = container.querySelector('[data-slot="badge"]')
    expect(badge?.textContent).toBe("Maintenance")
  })

  it("renders decommissioned status with destructive variant and label", () => {
    const { container } = render(
      <ResourceStatusBadge status="decommissioned" />
    )
    const badge = container.querySelector('[data-slot="badge"]')
    expect(badge?.textContent).toBe("Decommissioned")
  })

  it("renders archived status with secondary variant and label", () => {
    const { container } = render(<ResourceStatusBadge status="archived" />)
    const badge = container.querySelector('[data-slot="badge"]')
    expect(badge?.textContent).toBe("Archived")
  })

  it("renders custom status with capitalized label", () => {
    const { container } = render(<ResourceStatusBadge status="experimental" />)
    const badge = container.querySelector('[data-slot="badge"]')
    expect(badge?.textContent).toBe("Experimental")
  })
})
