import type { ReactNode } from "react"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { WorkspaceLinkedResource } from "@/data/crucible/workspace-source"

import {
  ResourceRelationships,
  groupResourceRelationships,
} from "./resource-relationships"

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    "aria-label": ariaLabel,
    children,
    to,
  }: {
    "aria-label"?: string
    children: ReactNode
    to: string
  }) => (
    <a aria-label={ariaLabel} data-to={to} href="#full-page">
      {children}
    </a>
  ),
}))

vi.mock("@/components/crucible/resource-preview-navigation", () => ({
  ResourcePreviewLink: ({
    children,
    mfid,
  }: {
    children: ReactNode
    mfid: string
  }) => (
    <a data-preview={mfid} href="#preview">
      {children}
    </a>
  ),
}))

const links = [
  {
    name: "Parent sample",
    relationship: "parent",
    relationship_type: "is_derived_from",
    resource_type: "sample",
    unique_id: "parent",
  },
  {
    name: "Child sample",
    relationship: "child",
    relationship_type: "is_part_of",
    resource_type: "sample",
    unique_id: "child",
  },
  {
    name: null,
    relationship: "associated",
    resource_type: "dataset",
    unique_id: "associated",
  },
] satisfies readonly WorkspaceLinkedResource[]

describe("ResourceRelationships", () => {
  afterEach(cleanup)

  it("groups returned references by relationship with contextual labels", () => {
    expect(
      groupResourceRelationships("sample", links).map((group) => [
        group.title,
        group.links.map((link) => link.unique_id),
      ])
    ).toEqual([
      ["Parents", ["parent"]],
      ["Children", ["child"]],
      ["Linked datasets", ["associated"]],
    ])
    expect(groupResourceRelationships("dataset", links)[2]?.title).toBe(
      "Linked samples"
    )
  })

  it("distinguishes unavailable relationships from a known empty set", () => {
    const { rerender } = render(
      <ResourceRelationships kind="sample" links={null} />
    )
    expect(screen.getByText(/Relationship data is unavailable/)).toBeTruthy()

    rerender(<ResourceRelationships kind="sample" links={[]} />)
    expect(screen.getByText(/No immediate relationships/)).toBeTruthy()
    expect(screen.queryByText(/Relationship data is unavailable/)).toBeNull()
  })

  it("makes supported identities previewable with separate canonical links", () => {
    render(<ResourceRelationships kind="sample" links={links} />)

    expect(screen.getByText("Parents (1)")).toBeTruthy()
    expect(screen.getByText("Children (1)")).toBeTruthy()
    expect(screen.getByText("Linked datasets (1)")).toBeTruthy()
    expect(screen.getByText("Derived from")).toBeTruthy()
    expect(screen.getByText("Part of this")).toBeTruthy()
    expect(
      screen
        .getByRole("link", { name: "Preview Parent sample" })
        .getAttribute("data-preview")
    ).toBe("parent")
    expect(
      screen
        .getByRole("link", { name: "Open full page: Parent sample" })
        .getAttribute("data-to")
    ).toBe("/samples/$sampleMfid")
    expect(screen.getByText("associated")).toBeTruthy()
  })

  it("supports inspector group heading depth", () => {
    render(
      <ResourceRelationships
        groupHeadingLevel={4}
        kind="sample"
        links={[links[0]]}
      />
    )

    expect(
      screen.getByRole("heading", { level: 4, name: "Parents (1)" })
    ).toBeTruthy()
  })

  it("replaces canonical row actions only while managing", () => {
    render(
      <ResourceRelationships
        kind="sample"
        links={[links[0]]}
        managing
        renderManagementAction={(link) => (
          <button type="button">Unlink {link.name}</button>
        )}
      />
    )

    expect(screen.queryByRole("link", { name: /Open full page/ })).toBeNull()
    expect(
      screen.getByRole("button", { name: "Unlink Parent sample" })
    ).toBeTruthy()
  })

  it("does not invent preview or canonical navigation for unknown types", () => {
    render(
      <ResourceRelationships
        kind="dataset"
        links={[
          {
            name: "External record",
            relationship: "associated",
            resource_type: "external",
            unique_id: "external-1",
          },
        ]}
      />
    )

    expect(screen.getByText("External record")).toBeTruthy()
    expect(screen.queryByRole("link")).toBeNull()
  })
})
