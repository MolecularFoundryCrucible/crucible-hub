import { describe, expect, it } from "vitest"

import { cn } from "./utils"

describe("cn", () => {
  it("lets a supporting icon size replace the label icon size", () => {
    expect(cn("size-icon-label shrink-0", "size-icon-supporting")).toBe(
      "shrink-0 size-icon-supporting"
    )
  })
})
