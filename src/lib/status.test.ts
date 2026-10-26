import { describe, expect, it } from "vitest"

import { statusLabel, statusTone } from "./status"

describe("statusTone", () => {
  it.each([
    ["resource", "active", "success"],
    ["resource", "ready", "success"],
    ["resource", "maintenance", "warning"],
    ["resource", "pending", "warning"],
    ["resource", "decommissioned", "destructive"],
    ["resource", "failed", "destructive"],
    ["resource", "archived", "secondary"],
    ["resource", "completed", "secondary"],
    ["resource", "custom", "outline"],
    ["ingestion", "completed", "success"],
    ["ingestion", "in_progress", "info"],
    ["ingestion", "pending", "info"],
    ["ingestion", "retrying", "warning"],
    ["ingestion", "error", "destructive"],
    ["deletion-request", "pending", "warning"],
    ["deletion-request", "approved", "success"],
    ["deletion-request", "rejected", "destructive"],
    ["service", "ok", "success"],
    ["service", "unreachable", "destructive"],
    ["database", "unknown", "warning"],
  ] as const)("gives %s %s the %s tone", (domain, status, tone) => {
    expect(statusTone(domain, status)).toBe(tone)
  })
})

describe("statusLabel", () => {
  it.each([
    ["resource", "active", "Active"],
    ["resource", "in_review", "In review"],
    ["resource", "on-hold", "On hold"],
    ["resource", " MAINTENANCE ", "Maintenance"],
    ["ingestion", "in_progress", "In progress"],
    ["service", "ok", "Operational"],
    ["service", "unreachable", "Unreachable"],
    ["database", "ok", "Connected"],
  ] as const)("labels %s %s as %s", (domain, status, label) => {
    expect(statusLabel(domain, status)).toBe(label)
  })
})
