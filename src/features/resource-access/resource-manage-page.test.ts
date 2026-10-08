import { describe, expect, it } from "vitest"

import { sortAccessGrants } from "@/components/crucible/access-role-badge"
import type { WorkspaceResourceAccessGrant } from "@/data/crucible/workspace-source"

const grants: readonly WorkspaceResourceAccessGrant[] = [
  {
    display_name: "Viewer",
    permission: "viewer",
    principal_id: "viewer",
    principal_type: "user",
    slug: "viewer",
  },
  {
    display_name: "Owner",
    permission: "owner",
    principal_id: "owner",
    principal_type: "user",
    slug: "owner",
  },
  {
    display_name: "Admin B",
    permission: "admin",
    principal_id: "admin-b",
    principal_type: "project",
    slug: "admin-b",
  },
  {
    display_name: "Admin A",
    permission: "admin",
    principal_id: "admin-a",
    principal_type: "user",
    slug: "admin-a",
  },
]

describe("sortAccessGrants", () => {
  it("orders grants by permission hierarchy and then principal name", () => {
    expect(sortAccessGrants(grants).map((grant) => grant.principal_id)).toEqual(
      ["owner", "admin-a", "admin-b", "viewer"]
    )
  })
})
