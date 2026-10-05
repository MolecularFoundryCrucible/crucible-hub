import { describe, expect, it } from "vitest"

import { isSlugTakenOrRejected } from "./slug-availability"

describe("isSlugTakenOrRejected", () => {
  it("returns false when candidate is empty or whitespace", () => {
    expect(isSlugTakenOrRejected("")).toBe(false)
    expect(isSlugTakenOrRejected("   ")).toBe(false)
    expect(isSlugTakenOrRejected("", "taken-slug", "rejected-slug")).toBe(false)
  })

  it("returns true when matching live taken slug case-insensitively", () => {
    expect(isSlugTakenOrRejected("my-slug", "my-slug")).toBe(true)
    expect(isSlugTakenOrRejected("My-Slug", "my-slug")).toBe(true)
    expect(isSlugTakenOrRejected("  my-slug  ", "MY-SLUG")).toBe(true)
  })

  it("returns true when matching rejected slug case-insensitively", () => {
    expect(isSlugTakenOrRejected("my-slug", undefined, "my-slug")).toBe(true)
    expect(isSlugTakenOrRejected("My-Slug", undefined, "my-slug")).toBe(true)
    expect(isSlugTakenOrRejected("  my-slug  ", undefined, "MY-SLUG")).toBe(
      true
    )
  })

  it("returns false when slug does not match taken or rejected", () => {
    expect(
      isSlugTakenOrRejected("new-slug", "other-slug", "rejected-slug")
    ).toBe(false)
    expect(isSlugTakenOrRejected("new-slug")).toBe(false)
  })
})
