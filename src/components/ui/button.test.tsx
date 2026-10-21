import { describe, expect, it } from "vitest"

import { buttonVariants } from "./button"
import { badgeVariants } from "./badge"

const classes = (value: string) => value.split(/\s+/)

describe("buttonVariants", () => {
  it("gives icon-only outline buttons the strong border", () => {
    for (const size of ["icon", "icon-xs", "icon-sm"] as const) {
      expect(classes(buttonVariants({ variant: "outline", size }))).toContain(
        "border-border-strong"
      )
    }
  })

  it("keeps the soft border on text outline buttons", () => {
    const value = classes(buttonVariants({ variant: "outline", size: "sm" }))
    expect(value).toContain("border-action-border")
    expect(value).not.toContain("border-border-strong")
  })

  it("gives every outline button in a button group the same strong border", () => {
    expect(
      classes(buttonVariants({ variant: "outline", size: "sm" }))
    ).toContain("in-data-[slot=button-group]:border-border-strong")
  })

  it("styles pressed outline and ghost buttons with the pressed role", () => {
    for (const variant of ["outline", "ghost"] as const) {
      expect(classes(buttonVariants({ variant }))).toContain(
        "aria-pressed:bg-action-pressed"
      )
    }
  })

  it("uses the primary hover role for the primary button", () => {
    expect(classes(buttonVariants({ variant: "default" }))).toContain(
      "hover:bg-primary-hover"
    )
  })

  it("mixes no colors inline", () => {
    for (const variant of [
      "default",
      "outline",
      "ghost",
      "destructive",
      "destructive-solid",
      "warning",
    ] as const) {
      expect(buttonVariants({ variant })).not.toContain("color-mix")
    }
  })
})

describe("badgeVariants", () => {
  it("renders the default badge as neutral metadata", () => {
    const value = classes(badgeVariants({ variant: "default" }))
    expect(value).toContain("bg-muted")
    expect(value).not.toContain("bg-primary")
  })
})
