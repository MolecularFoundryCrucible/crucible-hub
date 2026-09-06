import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { CollectionUpdateError } from "./collection-state"

afterEach(cleanup)

describe("CollectionUpdateError", () => {
  it("explains retained data and retries a failed refresh", () => {
    const retry = vi.fn()

    render(<CollectionUpdateError label="Projects" preserved retry={retry} />)

    expect(screen.getByRole("alert").textContent).toContain(
      "Previously loaded data remains available."
    )
    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    expect(retry).toHaveBeenCalledOnce()
  })

  it("explains when only sibling data remains", () => {
    render(
      <CollectionUpdateError
        label="Datasets"
        preserved={false}
        retry={() => undefined}
      />
    )

    expect(screen.getByRole("alert").textContent).toContain(
      "Other data remains available."
    )
  })
})
