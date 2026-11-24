import { describe, expect, it } from "vitest"

import { isSlugTakenOrRejected } from "./slug-availability"

describe("isSlugTakenOrRejected", () => {
  it("matches a non-empty slug against taken or rejected slugs case-insensitively", () => {
    expect(isSlugTakenOrRejected("")).toBe(false)
    expect(isSlugTakenOrRejected("   ")).toBe(false)
    expect(isSlugTakenOrRejected("", "taken-slug", "rejected-slug")).toBe(false)
    expect(isSlugTakenOrRejected("my-slug", "my-slug")).toBe(true)
    expect(isSlugTakenOrRejected("My-Slug", "my-slug")).toBe(true)
    expect(isSlugTakenOrRejected("  my-slug  ", "MY-SLUG")).toBe(true)
    expect(isSlugTakenOrRejected("my-slug", undefined, "my-slug")).toBe(true)
    expect(isSlugTakenOrRejected("My-Slug", undefined, "my-slug")).toBe(true)
    expect(isSlugTakenOrRejected("  my-slug  ", undefined, "MY-SLUG")).toBe(
      true
    )
    expect(
      isSlugTakenOrRejected("new-slug", "other-slug", "rejected-slug")
    ).toBe(false)
    expect(isSlugTakenOrRejected("new-slug")).toBe(false)
  })
})
