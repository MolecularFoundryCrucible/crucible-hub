import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { OrcidValue } from "./orcid-value"

describe("OrcidValue", () => {
  afterEach(cleanup)

  it("links a verified ORCID with the iD mark", () => {
    render(<OrcidValue orcid="0000-0002-1825-0097" verified />)

    const link = screen.getByRole("link", {
      name: "https://orcid.org/0000-0002-1825-0097, verified",
    })
    expect(link.getAttribute("href")).toBe(
      "https://orcid.org/0000-0002-1825-0097"
    )
    expect(link.getAttribute("rel")).toBe("noopener noreferrer")
    expect(link.querySelector("img")).not.toBeNull()
    expect(screen.queryByText("Not verified")).toBeNull()
  })

  it.each([false, null])(
    "shows an ORCID with verified %s without the iD mark",
    (verified) => {
      render(<OrcidValue orcid="0000-0002-1825-0097" verified={verified} />)

      expect(
        screen.getByRole("link", {
          name: "https://orcid.org/0000-0002-1825-0097",
        })
      ).toBeTruthy()
      expect(document.querySelector("img")).toBeNull()
      expect(screen.getByText("Not verified")).toBeTruthy()
    }
  )
})
