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
  it("links the release version in deployed builds and the git revision in development", () => {
    const { unmount } = renderFooter({
      build: { commit: "7386cff", development: false, version: "1.0.1" },
    })

    const versionLink = screen.getByRole("link", { name: "Version v1.0.1" })
    expect(versionLink.textContent).toBe("v1.0.1")
    expect(versionLink.getAttribute("href")).toBe(
      "https://github.com/MolecularFoundryCrucible/crucible-hub/tree/v1.0.1"
    )
    expect(versionLink.getAttribute("target")).toBe("_blank")
    unmount()

    renderFooter({
      build: { commit: "7386cff", development: true, version: "1.0.1" },
    })

    const revisionLink = screen.getByRole("link", { name: "Revision 7386cff" })
    expect(revisionLink.textContent).toBe("7386cff")
    expect(revisionLink.getAttribute("href")).toBe(
      "https://github.com/MolecularFoundryCrucible/crucible-hub/commit/7386cff"
    )
  })
})
