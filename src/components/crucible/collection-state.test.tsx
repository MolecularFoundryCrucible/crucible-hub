import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  CollectionTablePending,
  CollectionUpdateError,
  CollectionUpdateStatus,
} from "./collection-state"

afterEach(cleanup)

describe("CollectionTablePending", () => {
  it.each([
    [
      "instruments",
      undefined,
      ["Instrument", "Location", "Manager", "Created", "Last activity", "Open"],
    ],
    [
      "projects",
      undefined,
      ["Project", "Lead", "Role", "Created", "Last activity", "Open"],
    ],
    [
      "user-projects",
      undefined,
      ["Project", "Lead", "Role", "Created", "Updated", "Open"],
    ],
    [
      "resources",
      "Measurement",
      ["Name", "Measurement", "Project", "Owner", "Created", "Updated", "Open"],
    ],
    [
      "resources-scoped",
      "Sample type",
      ["Name", "Sample type", "Owner", "Created", "Updated", "Open"],
    ],
    [
      "service-accounts",
      undefined,
      ["Account", "Crucible ID", "Platform role", "Last active", "Open"],
    ],
    [
      "users",
      undefined,
      [
        "Account",
        "Crucible ID",
        "Email",
        "Platform role",
        "Last active",
        "Open",
      ],
    ],
  ] as const)(
    "renders %s column headers matching the loaded table",
    (presentation, subtypeLabel, expectedHeaders) => {
      const { container } = render(
        <CollectionTablePending
          label={presentation}
          presentation={presentation}
          subtypeLabel={subtypeLabel}
        />
      )

      const headers = screen
        .getAllByRole("columnheader")
        .map((header) => header.textContent)
      expect(headers).toEqual(expectedHeaders)
      expect(
        container.querySelector("table")?.classList.contains("table-fixed")
      ).toBe(true)
      const cols = Array.from(container.querySelectorAll("colgroup col"))
      expect(cols).toHaveLength(expectedHeaders.length)
      expect(cols.some((col) => col.className.length > 0)).toBe(true)
    }
  )

  it("supports unframed rendering inside an existing card", () => {
    const { container } = render(
      <CollectionTablePending
        framed={false}
        label="user projects"
        presentation="user-projects"
      />
    )

    expect(
      screen.getByRole("status", { name: "Loading user projects" })
    ).toBeTruthy()
    expect(container.querySelector("[data-slot='card']")).toBeNull()
  })
})

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

describe("CollectionUpdateStatus", () => {
  it("renders nothing until hydration so server and client markup match", () => {
    expect(
      renderToString(<CollectionUpdateStatus label="datasets" updating />)
    ).toBe("")
  })

  it("announces updates after hydration", () => {
    render(<CollectionUpdateStatus label="datasets" updating />)

    expect(screen.getByRole("status").textContent).toBe("Updating datasets…")
  })
})
