import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { AppFooter } from "./app-footer"

afterEach(cleanup)

describe("AppFooter", () => {
  it("renders with the semantic contentinfo role and accessible label", () => {
    render(<AppFooter />)

    const footer = screen.getByRole("contentinfo", {
      name: "Crucible Hub footer",
    })
    expect(footer).toBeTruthy()
    expect(footer.classList.contains("border-t")).toBe(true)
    expect(footer.classList.contains("border-border")).toBe(true)
  })

  it("renders attribution and current year", () => {
    render(<AppFooter />)

    const currentYear = new Date().getFullYear().toString()
    expect(
      screen.getByText(
        new RegExp(`(©|\\(c\\))\\s*${currentYear}\\s*Crucible Dev Team`)
      )
    ).toBeTruthy()
  })

  it("renders external resource navigation links with secure targets and underlines", () => {
    render(<AppFooter />)

    const crucibleLink = screen.getByRole("link", { name: "Crucible" })
    expect(crucibleLink.getAttribute("href")).toBe("https://crucible.lbl.gov/")
    expect(crucibleLink.getAttribute("target")).toBe("_blank")
    expect(crucibleLink.getAttribute("rel")).toBe("noreferrer")
    expect(crucibleLink.classList.contains("underline")).toBe(true)

    const foundryLink = screen.getByRole("link", { name: "Molecular Foundry" })
    expect(foundryLink.getAttribute("href")).toBe("https://foundry.lbl.gov/")
    expect(foundryLink.getAttribute("target")).toBe("_blank")
    expect(foundryLink.getAttribute("rel")).toBe("noreferrer")
    expect(foundryLink.classList.contains("underline")).toBe(true)

    const issuesLink = screen.getByRole("link", { name: "Issues" })
    expect(issuesLink.getAttribute("href")).toBe(
      "https://github.com/MolecularFoundryCrucible/crucible-hub/issues"
    )
    expect(issuesLink.getAttribute("target")).toBe("_blank")
    expect(issuesLink.getAttribute("rel")).toBe("noreferrer")
    expect(issuesLink.classList.contains("underline")).toBe(true)
  })

  it("renders center dots separating external navigation links", () => {
    render(<AppFooter />)

    const nav = screen.getByRole("navigation", { name: "External resources" })
    expect(nav.textContent).toContain("•")
  })

  it("renders API status link with underline", () => {
    render(<AppFooter />)

    const statusLink = screen.getByRole("link", { name: "API status" })
    expect(statusLink.getAttribute("href")).toBe("/hub/health")
    expect(statusLink.classList.contains("underline")).toBe(true)
  })

  it("renders git revision with baseline alignment and separator dot when provided", () => {
    render(<AppFooter gitRevision="7386cff" />)

    const revisionLink = screen.getByRole("link", { name: "7386cff" })
    expect(revisionLink.getAttribute("href")).toBe(
      "https://github.com/MolecularFoundryCrucible/crucible-hub/commit/7386cff"
    )
    expect(revisionLink.getAttribute("target")).toBe("_blank")
    expect(revisionLink.classList.contains("font-mono")).toBe(true)
    expect(revisionLink.classList.contains("underline")).toBe(true)

    const revisionContainer = revisionLink.parentElement
    expect(revisionContainer?.classList.contains("items-baseline")).toBe(true)

    const rightCluster = revisionContainer?.parentElement
    expect(rightCluster?.textContent).toContain("•")
    expect(rightCluster?.classList.contains("justify-center")).toBe(true)
    expect(rightCluster?.classList.contains("md:justify-end")).toBe(true)
  })

  it("omits revision and separator dot when not provided or empty", () => {
    render(<AppFooter gitRevision="" />)

    expect(screen.queryByText("Revision")).toBeNull()
    const statusLink = screen.getByRole("link", { name: "API status" })
    const rightCluster = statusLink.parentElement
    expect(rightCluster?.textContent).not.toContain("•")
  })

  it("centers content on narrow screens and distributes on desktop", () => {
    render(<AppFooter />)

    const footer = screen.getByRole("contentinfo")
    const container = footer.firstElementChild
    expect(container?.classList.contains("items-center")).toBe(true)
    expect(container?.classList.contains("text-center")).toBe(true)
    expect(container?.classList.contains("md:justify-between")).toBe(true)
    expect(container?.classList.contains("md:text-left")).toBe(true)
  })

  it("merges custom className", () => {
    render(<AppFooter className="custom-test-class" />)

    const footer = screen.getByRole("contentinfo")
    expect(footer.classList.contains("custom-test-class")).toBe(true)
  })
})
