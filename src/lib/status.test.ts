import { describe, expect, it } from "vitest"

import { statusLabel } from "./status"

describe("statusLabel", () => {
  it.each([
    ["resource", "in_review", "In review"],
    ["resource", " MAINTENANCE ", "Maintenance"],
    ["service", "ok", "Operational"],
    ["database", "ok", "Connected"],
  ] as const)("labels %s %s as %s", (domain, status, label) => {
    expect(statusLabel(domain, status)).toBe(label)
  })
})
