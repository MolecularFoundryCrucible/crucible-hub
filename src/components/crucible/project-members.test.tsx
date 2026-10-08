import type { ReactNode } from "react"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { components } from "@/generated/crucible-api"

import {
  ProjectMembers,
  ProjectRoleBadge,
  sortProjectMembers,
} from "./project-members"

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    "aria-label": ariaLabel,
    children,
    params,
  }: {
    "aria-label"?: string
    children: ReactNode
    params: { userId: string }
  }) => (
    <a aria-label={ariaLabel} href={`/users/${params.userId}`}>
      {children}
    </a>
  ),
}))

type ProjectMember = components["schemas"]["AccessGroupMemberRead"]

const members = [
  {
    first_name: "Viewer",
    is_service_account: false,
    last_name: "Zed",
    role: "viewer",
    unique_id: "viewer",
    username: "viewer.zed",
  },
  {
    first_name: "Ada",
    is_service_account: false,
    last_name: "Lovelace",
    role: "owner",
    unique_id: "owner",
    username: "ada.lovelace",
  },
  {
    first_name: "Beamline",
    is_service_account: true,
    last_name: "Collector",
    role: "contributor",
    unique_id: "service-account",
    username: "beamline-collector",
  },
  {
    first_name: "Grace",
    is_service_account: false,
    last_name: "Hopper",
    role: "admin",
    unique_id: "admin",
    username: "grace.hopper",
  },
  {
    first_name: "Morgan",
    is_service_account: false,
    last_name: "Lee",
    role: "editor",
    unique_id: "editor",
    username: "morgan.lee",
  },
] satisfies ProjectMember[]

describe("ProjectMembers", () => {
  afterEach(cleanup)

  it("orders members by role hierarchy, then public name and stable identifier", () => {
    const tiedMembers = [
      { ...members[4], first_name: "Alex", last_name: "Chen", unique_id: "b" },
      { ...members[4], first_name: "Alex", last_name: "Chen", unique_id: "a" },
      ...members,
    ]

    expect(
      sortProjectMembers(tiedMembers).map((member) => member.unique_id)
    ).toEqual([
      "owner",
      "admin",
      "a",
      "b",
      "editor",
      "service-account",
      "viewer",
    ])
  })

  it("renders public member detail, role text, and principal-type indication", () => {
    render(<ProjectMembers members={members} />)

    expect(
      screen.getByRole("link", { name: "Ada Lovelace" }).getAttribute("href")
    ).toBe("/users/owner")
    expect(screen.getByText("Lead").className).toContain("bg-access-role-owner")
    expect(screen.getByText("Admin").className).toContain(
      "bg-access-role-admin"
    )
    expect(screen.getByText("Editor").className).toContain(
      "bg-access-role-editor"
    )
    expect(screen.getByText("Contributor").className).toContain(
      "bg-access-role-contributor"
    )
    expect(screen.getByText("Viewer").className).toContain(
      "bg-access-role-viewer"
    )
    expect(screen.getByText("@beamline-collector")).toBeTruthy()
    expect(screen.getByRole("img", { name: "Service account" })).toBeTruthy()
    expect(screen.getAllByRole("img", { name: "Person" })).toHaveLength(4)
    expect(
      screen.getByRole("link", {
        name: "Beamline Collector, Service account",
      })
    ).toBeTruthy()
  })

  it("distinguishes unavailable and empty membership", () => {
    const { rerender } = render(<ProjectMembers members={null} />)
    expect(
      screen.getByText("Detailed membership is not available.")
    ).toBeTruthy()

    rerender(<ProjectMembers members={[]} />)
    expect(screen.getByText("No members are currently listed.")).toBeTruthy()
  })

  it("keeps the role name available when an unrecognized role is returned", () => {
    render(<ProjectRoleBadge role="observer" />)
    expect(screen.getByText("Observer").className).toContain("bg-muted")
  })
})
