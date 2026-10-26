import { describe, expect, it } from "vitest"

import { homeGreeting } from "./home-greeting"

describe("homeGreeting", () => {
  it("stays neutral when the viewer's time zone is unknown", () => {
    expect(
      homeGreeting({
        accountMfid: "account",
        at: Date.UTC(2026, 9, 21, 16, 0),
        firstName: "Avery",
      })
    ).toBe("Welcome to Crucible, Avery")
  })

  it("chooses the same greeting for the same instant and zone", () => {
    const input = {
      accountMfid: "account",
      at: Date.UTC(2026, 9, 21, 16, 0),
      firstName: "Avery",
      timeZone: "America/Los_Angeles",
    }
    expect(homeGreeting(input)).toBe(homeGreeting({ ...input }))
    expect(homeGreeting(input)).toMatch(/Avery$/)
  })

  it("uses the hour in the viewer's zone for time-aware greetings", () => {
    const morning = Array.from({ length: 24 }, (_, day) =>
      homeGreeting({
        accountMfid: `account-${day}`,
        at: Date.UTC(2026, 9, 21, 16, 0),
        firstName: "Avery",
        timeZone: "America/Los_Angeles",
      })
    ).filter((greeting) => greeting.startsWith("Good"))
    expect(morning.length).toBeGreaterThan(0)
    expect(
      morning.every((greeting) => greeting === "Good morning, Avery")
    ).toBe(true)
  })

  it("keeps the Crux greeting rare", () => {
    const greetings = Array.from({ length: 5000 }, (_, index) =>
      homeGreeting({
        accountMfid: `account-${index}`,
        at: Date.UTC(2026, 9, 21, 16, 0),
        firstName: "Avery",
        timeZone: "America/Los_Angeles",
      })
    )
    const share = (prefix: string) =>
      greetings.filter((greeting) => greeting.startsWith(prefix)).length /
      greetings.length
    expect(share("Welcome to the Crux")).toBeGreaterThan(0.01)
    expect(share("Welcome to the Crux")).toBeLessThan(0.035)
    expect(share("Good")).toBeGreaterThan(0.35)
  })
})
