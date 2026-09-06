import type { ReactElement, ReactNode } from "react"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { ResourceFullPageKind } from "./resource-full-page-link"
import { ResourceFullPageLink } from "./resource-full-page-link"

const { linkProps } = vi.hoisted(() => ({ linkProps: vi.fn() }))

vi.mock("@tanstack/react-router", () => ({
  Link: (props: {
    "aria-label": string
    children?: ReactNode
    className: string
    params: Record<string, string>
    preload: false
    search: Record<string, unknown>
    state: Record<string, never>
    to: string
  }) => {
    linkProps(props)
    return (
      <a
        aria-label={props["aria-label"]}
        className={props.className}
        href="#full"
      >
        {props.children}
      </a>
    )
  },
}))

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: ReactNode }) => (
    <span role="tooltip">{children}</span>
  ),
  TooltipTrigger: ({ render: trigger }: { render: ReactElement }) => trigger,
}))

const destinations = [
  {
    kind: "sample",
    params: { sampleMfid: "resource-mfid" },
    search: { preview: undefined },
    to: "/samples/$sampleMfid",
  },
  {
    kind: "dataset",
    params: { datasetMfid: "resource-mfid" },
    search: { preview: undefined },
    to: "/datasets/$datasetMfid",
  },
  {
    kind: "project",
    params: { projectMfid: "resource-mfid" },
    search: { preview: undefined },
    to: "/projects/$projectMfid",
  },
  {
    kind: "instrument",
    params: { instrumentMfid: "resource-mfid" },
    search: {},
    to: "/instruments/$instrumentMfid",
  },
] satisfies readonly {
  kind: ResourceFullPageKind
  params: Record<string, string>
  search: Record<string, unknown>
  to: string
}[]

describe("ResourceFullPageLink", () => {
  afterEach(cleanup)

  beforeEach(() => {
    linkProps.mockClear()
  })

  it.each(destinations)("uses the typed $kind destination", (destination) => {
    render(
      <ResourceFullPageLink
        kind={destination.kind}
        mfid="resource-mfid"
        name="Named resource"
        presentation="inspector-footer"
      />
    )

    expect(linkProps).toHaveBeenCalledWith(
      expect.objectContaining({
        params: destination.params,
        search: destination.search,
        state: {},
        to: destination.to,
      })
    )
    expect(
      screen.getByRole("link", { name: "Open full page: Named resource" })
    ).toBeTruthy()
  })

  it("uses an icon-only fixed table control with a tooltip", () => {
    render(
      <ResourceFullPageLink
        kind="dataset"
        mfid="resource-mfid"
        name="Named dataset"
        presentation="table"
      />
    )

    const link = screen.getByRole("link", {
      name: "Open full page: Named dataset",
    })
    expect(link.className).toContain("size-7")
    expect(link.querySelector("svg")).toBeTruthy()
    expect(screen.queryByText("Open")).toBeNull()
    expect(screen.getByRole("tooltip").textContent).toBe(
      "Open full page: Named dataset"
    )
  })

  it("uses a labeled inspector-footer control with an inline-end icon", () => {
    render(
      <ResourceFullPageLink
        kind="project"
        mfid="resource-mfid"
        name="Named project"
        presentation="inspector-footer"
      />
    )

    const link = screen.getByRole("link", {
      name: "Open full page: Named project",
    })
    expect(link.textContent).toBe("Open")
    expect(link.querySelector('[data-icon="inline-end"]')).toBeTruthy()
  })
})
