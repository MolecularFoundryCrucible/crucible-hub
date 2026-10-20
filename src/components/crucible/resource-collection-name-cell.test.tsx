import type { ReactNode } from "react"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { Table, TableBody, TableRow } from "@/components/ui/table"

import { ResourceCollectionNameCell } from "./resource-collection-name-cell"

const { previewProps } = vi.hoisted(() => ({ previewProps: vi.fn() }))

vi.mock("@/components/crucible/resource-preview-navigation", () => ({
  ResourcePreviewLink: (props: {
    "aria-label": string
    children: ReactNode
    className: string
    mfid: string
  }) => {
    previewProps(props)
    return (
      <a aria-label={props["aria-label"]} href="#preview">
        {props.children}
      </a>
    )
  },
}))

function renderCell(
  props: React.ComponentProps<typeof ResourceCollectionNameCell>
) {
  return render(
    <Table>
      <TableBody>
        <TableRow>
          <ResourceCollectionNameCell {...props} />
        </TableRow>
      </TableBody>
    </Table>
  )
}

describe("ResourceCollectionNameCell", () => {
  afterEach(cleanup)

  beforeEach(() => {
    previewProps.mockClear()
  })

  it("makes only the sample name the preview target", () => {
    const mfid = "01J6Y8N4Q2R7M9K3T5V0W1X2Z1"
    const { container } = renderCell({
      kind: "sample",
      mfid,
      name: "Catalyst sample",
      subtype: "oxide powder",
      subtypeVisibility: "always",
    })

    const preview = screen.getByRole("link", {
      name: "Preview Catalyst sample",
    })
    expect(preview.textContent).toContain("Catalyst sample")
    expect(preview.textContent).not.toContain("oxide powder")
    expect(preview.querySelector('[data-resource-type="sample"]')).toBeNull()
    expect(screen.queryByText("Preview")).toBeNull()
    expect(
      container.querySelector('[data-resource-type="sample"]')
    ).toBeTruthy()
    expect(screen.getByText("oxide powder").className).not.toContain(":hidden")
    expect(container.querySelectorAll("td")).toHaveLength(1)
    expect(previewProps).toHaveBeenCalledWith(expect.objectContaining({ mfid }))
  })

  it("supports a compact-only dataset subtype without route-specific behavior", () => {
    const { container } = renderCell({
      kind: "dataset",
      mfid: "01J6Y8N4Q2R7M9K3T5V0W1X2Z2",
      name: "Operando series",
      subtype: "XAS",
      subtypeVisibility: "compact",
    })

    expect(
      screen.getByRole("link", { name: "Preview Operando series" })
    ).toBeTruthy()
    expect(
      container.querySelector('[data-resource-type="dataset"]')
    ).toBeTruthy()
    expect(container.querySelector("td > span")?.className).toContain(
      "resource-collection-subtype-compact"
    )
  })

  it("applies collection truncation classes to name container and child preview link", () => {
    const { container } = renderCell({
      kind: "sample",
      mfid: "01J6Y8N4Q2R7M9K3T5V0W1X2Z1",
      name: "Catalyst sample",
      subtype: "oxide powder",
      subtypeVisibility: "always",
    })

    const nameContainer = container.querySelector("[data-directory-name]")
    expect(nameContainer?.className).toContain("truncate")
    expect(nameContainer?.className).toContain("[&>*]:block")
    expect(nameContainer?.className).toContain("[&>*]:truncate")
  })
})
