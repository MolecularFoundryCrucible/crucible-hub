import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { WorkspaceDataset } from "@/data/crucible/workspace-source"

import { ResourceCollectionTable } from "./resource-collection-table"

vi.mock("@/components/crucible/resource-collection-cells", () => {
  const Cell = () => <td />
  return {
    ResourceCreatedCell: Cell,
    ResourceOpenCell: Cell,
    ResourceOwnerCell: Cell,
    ResourceProjectCell: Cell,
    ResourceUpdatedCell: Cell,
  }
})
vi.mock("@/components/crucible/resource-collection-name-cell", () => ({
  ResourceCollectionNameCell: ({ name }: { name: string }) => <td>{name}</td>,
}))

afterEach(cleanup)

function dataset(id: string) {
  return { dataset_name: id, unique_id: id } as WorkspaceDataset
}

function renderTable(items: WorkspaceDataset[]) {
  return (
    <ResourceCollectionTable
      direction="desc"
      items={items}
      kind="dataset"
      onSort={() => {}}
    />
  )
}

describe("ResourceCollectionTable", () => {
  it("fades in only rows that arrive after the first render", () => {
    const { rerender } = render(renderTable([dataset("a"), dataset("b")]))
    const row = (name: string) => screen.getByText(name).closest("tr")!
    expect(row("a").className).not.toContain("animate-in")

    rerender(renderTable([dataset("a"), dataset("b"), dataset("c")]))
    expect(row("a").className).not.toContain("animate-in")
    expect(row("c").className).toContain("animate-in")
  })
})
