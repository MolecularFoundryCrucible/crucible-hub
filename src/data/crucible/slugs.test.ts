import { describe, expect, it } from "vitest"

import {
  INSTRUMENT_ID_MAX_LENGTH,
  PROJECT_ID_MAX_LENGTH,
  RESERVED_PROJECT_IDS,
  USERNAME_MAX_LENGTH,
  instrumentIdSchema,
  projectIdSchema,
  usernameSchema,
} from "./slugs"

describe("slug schemas", () => {
  it("enforces project_id rules, bounds, and reserved values", () => {
    expect(projectIdSchema.parse("proj-123")).toBe("proj-123")
    expect(projectIdSchema.parse("  valid_proj  ")).toBe("valid_proj")
    expect(projectIdSchema.parse("123-abc")).toBe("123-abc")
    expect(projectIdSchema.parse("a".repeat(PROJECT_ID_MAX_LENGTH))).toBe(
      "a".repeat(PROJECT_ID_MAX_LENGTH)
    )

    expect(projectIdSchema.safeParse("ab").success).toBe(false)
    expect(
      projectIdSchema.safeParse("a".repeat(PROJECT_ID_MAX_LENGTH + 1)).success
    ).toBe(false)
    expect(projectIdSchema.safeParse("_proj").success).toBe(false)
    expect(projectIdSchema.safeParse("-proj").success).toBe(false)
    expect(projectIdSchema.safeParse("proj with space").success).toBe(false)
    expect(projectIdSchema.safeParse("proj.dot").success).toBe(false)

    for (const reserved of RESERVED_PROJECT_IDS) {
      expect(projectIdSchema.safeParse(reserved).success).toBe(false)
      expect(projectIdSchema.safeParse(reserved.toUpperCase()).success).toBe(
        false
      )
    }
  })

  it("enforces instrument_id rules and bounds without project-specific reserved values", () => {
    expect(instrumentIdSchema.parse("micro-probe-1")).toBe("micro-probe-1")
    expect(instrumentIdSchema.parse("  beamline_5  ")).toBe("beamline_5")
    expect(instrumentIdSchema.parse("admin")).toBe("admin")
    expect(instrumentIdSchema.parse("a".repeat(INSTRUMENT_ID_MAX_LENGTH))).toBe(
      "a".repeat(INSTRUMENT_ID_MAX_LENGTH)
    )

    expect(instrumentIdSchema.safeParse("ab").success).toBe(false)
    expect(
      instrumentIdSchema.safeParse("a".repeat(INSTRUMENT_ID_MAX_LENGTH + 1))
        .success
    ).toBe(false)
    expect(instrumentIdSchema.safeParse("-probe").success).toBe(false)
    expect(instrumentIdSchema.safeParse("_probe").success).toBe(false)
    expect(instrumentIdSchema.safeParse("probe$").success).toBe(false)
  })

  it("enforces username rules, prefixing, and bounds", () => {
    expect(usernameSchema.parse("ada")).toBe("ada")
    expect(usernameSchema.parse("  ada_lovelace  ")).toBe("ada_lovelace")
    expect(usernameSchema.parse("user-123")).toBe("user-123")
    expect(usernameSchema.parse("a".repeat(USERNAME_MAX_LENGTH))).toBe(
      "a".repeat(USERNAME_MAX_LENGTH)
    )

    expect(usernameSchema.safeParse("ad").success).toBe(false)
    expect(
      usernameSchema.safeParse("a".repeat(USERNAME_MAX_LENGTH + 1)).success
    ).toBe(false)
    expect(usernameSchema.safeParse("Ada").success).toBe(false)
    expect(usernameSchema.safeParse("1user").success).toBe(false)
    expect(usernameSchema.safeParse("user_").success).toBe(false)
    expect(usernameSchema.safeParse("user__double").success).toBe(false)
  })
})
