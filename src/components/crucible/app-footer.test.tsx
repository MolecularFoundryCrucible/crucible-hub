import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { AppFooter } from "./app-footer"

afterEach(cleanup)

function renderFooter(props: React.ComponentProps<typeof AppFooter> = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <AppFooter {...props} />
    </QueryClientProvider>
  )
}

describe("AppFooter", () => {
  it("renders with the semantic contentinfo role and accessible label", () => {
    renderFooter()

    const footer = screen.getByRole("contentinfo", {
      name: "Crucible Hub footer",
    })
    expect(footer).toBeTruthy()
    expect(footer.classList.contains("border-t")).toBe(true)
    expect(footer.classList.contains("border-border")).toBe(true)
  })

  it("renders attribution and current year", () => {
    renderFooter()

    const currentYear = new Date().getFullYear().toString()
    expect(
      screen.getByText(
        new RegExp(`(©|\\(c\\))\\s*${currentYear}\\s*Crucible Dev Team`)
      )
    ).toBeTruthy()
  })

  it("renders external resource navigation links with secure targets", () => {
    renderFooter()

    const crucibleLink = screen.getByRole("link", { name: "Crucible" })
    expect(crucibleLink.getAttribute("href")).toBe("https://crucible.lbl.gov/")
    expect(crucibleLink.getAttribute("target")).toBe("_blank")
    expect(crucibleLink.getAttribute("rel")).toBe("noreferrer")
    expect(crucibleLink.classList.contains("underline")).toBe(false)

    const foundryLink = screen.getByRole("link", { name: "Molecular Foundry" })
    expect(foundryLink.getAttribute("href")).toBe("https://foundry.lbl.gov/")
    expect(foundryLink.getAttribute("target")).toBe("_blank")
    expect(foundryLink.getAttribute("rel")).toBe("noreferrer")
    expect(foundryLink.classList.contains("underline")).toBe(false)

    const issuesLink = screen.getByRole("link", { name: "Issues" })
    expect(issuesLink.getAttribute("href")).toBe(
      "https://github.com/MolecularFoundryCrucible/crucible-hub/issues"
    )
    expect(issuesLink.getAttribute("target")).toBe("_blank")
    expect(issuesLink.getAttribute("rel")).toBe("noreferrer")
    expect(issuesLink.classList.contains("underline")).toBe(false)
  })

  it("renders center dots separating external navigation links", () => {
    renderFooter()

    const nav = screen.getByRole("navigation", { name: "External resources" })
    expect(nav.textContent).toContain("•")
  })

  it("renders API status trigger without underline and popover trigger semantics", () => {
    renderFooter()

    const statusButton = screen.getByRole("button", { name: "API status" })
    expect(statusButton.getAttribute("aria-haspopup")).toBe("dialog")
    expect(statusButton.classList.contains("underline")).toBe(false)
  })

  it("renders git revision with center alignment and separator dot when provided", () => {
    renderFooter({ gitRevision: "7386cff" })

    const revisionLink = screen.getByRole("link", { name: "7386cff" })
    expect(revisionLink.getAttribute("href")).toBe(
      "https://github.com/MolecularFoundryCrucible/crucible-hub/commit/7386cff"
    )
    expect(revisionLink.getAttribute("target")).toBe("_blank")
    expect(revisionLink.classList.contains("font-mono")).toBe(true)
    expect(revisionLink.classList.contains("underline")).toBe(false)

    const revisionContainer = revisionLink.parentElement
    expect(revisionContainer?.classList.contains("items-center")).toBe(true)

    const rightCluster = revisionContainer?.parentElement
    expect(rightCluster?.textContent).toContain("•")
    expect(rightCluster?.classList.contains("justify-center")).toBe(true)
    expect(rightCluster?.classList.contains("md:justify-end")).toBe(true)
  })

  it("omits revision and separator dot when not provided or empty", () => {
    renderFooter({ gitRevision: "" })

    expect(screen.queryByText("Revision")).toBeNull()
    const statusButton = screen.getByRole("button", { name: "API status" })
    const rightCluster = statusButton.parentElement
    expect(rightCluster?.textContent).not.toContain("•")
  })

  it("centers content on narrow screens and distributes on desktop", () => {
    renderFooter()

    const footer = screen.getByRole("contentinfo")
    const container = footer.firstElementChild
    expect(container?.classList.contains("items-center")).toBe(true)
    expect(container?.classList.contains("text-center")).toBe(true)
    expect(container?.classList.contains("md:justify-between")).toBe(true)
    expect(container?.classList.contains("md:text-left")).toBe(true)
  })

  it("merges custom className", () => {
    renderFooter({ className: "custom-test-class" })

    const footer = screen.getByRole("contentinfo")
    expect(footer.classList.contains("custom-test-class")).toBe(true)
  })
})
