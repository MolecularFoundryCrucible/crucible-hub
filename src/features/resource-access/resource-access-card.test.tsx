import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { resourceAccessQueryOptions } from "@/data/crucible/access.queries"
import { identityScope } from "@/data/crucible/query-keys"
import type {
  WorkspaceResourceAccessGrant,
  WorkspaceResourceDetail,
} from "@/data/crucible/workspace-source"

import { resourceQueryOptions } from "@/data/crucible/resources.queries"

import { ResourceAccessCard, ResourceManagePage } from "./resource-manage-page"

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  Link: ({ children }: { children: React.ReactNode }) => (
    <a href="#test">{children}</a>
  ),
}))
vi.mock("@/data/crucible/access.functions", () => ({
  getWorkspaceResourceAccess: vi.fn(),
  revokeWorkspaceResourceAccess: vi.fn(),
  setWorkspaceResourceAccess: vi.fn(),
  setWorkspaceResourcePublicAccess: vi.fn(),
}))

vi.mock("@/components/crucible/workspace-provider", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useWorkspaceMode: () => "fixture",
  useWorkspaceScope: () => scope,
}))

afterEach(cleanup)

const scope = identityScope("crucible-fixture:populated", "account")

const sample: Extract<WorkspaceResourceDetail, { kind: "sample" }> = {
  capabilities: {
    can_change_status: false,
    can_delete: false,
    can_edit: true,
    can_manage_access: false,
    can_view_access: true,
    can_request_deletion: true,
    can_transfer: false,
    max_grant_role: null,
  },
  creation_time: "2026-09-01T12:00:00Z",
  description: null,
  kind: "sample",
  links: [],
  modification_time: null,
  name: "Nickel foam",
  owner: null,
  project: null,
  project_id: null,
  public: false,
  sample_type: "catalyst",
  scientific_metadata: null,
  timestamp: null,
  unique_id: "sample-mfid",
}

const grants: WorkspaceResourceAccessGrant[] = [
  {
    display_name: "Jordan Reyes",
    permission: "editor",
    principal_id: "0000-0000-0000-0034",
    principal_type: "user",
    slug: "jreyes",
  },
]

function renderCard(canManageAccess: boolean) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  queryClient.setQueryData(
    resourceAccessQueryOptions(scope, sample.unique_id).queryKey,
    grants
  )
  const resource = {
    ...sample,
    capabilities: {
      can_change_status: false,
      can_delete: false,
      can_edit: true,
      can_manage_access: canManageAccess,
      can_view_access: true,
      can_request_deletion: true,
      can_transfer: false,
      max_grant_role: canManageAccess ? ("admin" as const) : null,
    },
  }
  return render(
    <QueryClientProvider client={queryClient}>
      <ResourceAccessCard resource={resource} scope={scope} />
    </QueryClientProvider>
  )
}

describe("ResourceAccessCard", () => {
  it("offers the manage toggle to people who can manage access", () => {
    renderCard(true)
    expect(screen.getByText("Jordan Reyes")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Manage access" })).toBeTruthy()
  })

  it("shows the same list read-only to people who cannot manage access", () => {
    renderCard(false)
    expect(screen.getByText("Access management")).toBeTruthy()
    expect(screen.getByText("Jordan Reyes")).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Manage access" })).toBeNull()
  })
})

describe("ResourceManagePage", () => {
  function renderPage(canViewAccess: boolean) {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const resource: WorkspaceResourceDetail = {
      ...sample,
      capabilities: {
        can_change_status: false,
        can_delete: false,
        can_edit: false,
        can_manage_access: false,
        can_request_deletion: false,
        can_transfer: false,
        can_view_access: canViewAccess,
        max_grant_role: null,
      },
    }
    queryClient.setQueryData(
      resourceQueryOptions(scope, sample.unique_id).queryKey,
      resource
    )
    queryClient.setQueryData(
      resourceAccessQueryOptions(scope, sample.unique_id).queryKey,
      grants
    )
    return render(
      <QueryClientProvider client={queryClient}>
        <ResourceManagePage
          resourceKind="sample"
          resourceMfid={sample.unique_id}
        />
      </QueryClientProvider>
    )
  }

  it("shows who has access to people with granted access", () => {
    renderPage(true)
    expect(screen.getByText("Access management")).toBeTruthy()
    expect(screen.getByText("Jordan Reyes")).toBeTruthy()
    expect(screen.queryByText("Access management is unavailable")).toBeNull()
  })

  it("keeps access hidden from people who can only read a public resource", () => {
    renderPage(false)
    expect(screen.getByText("Access management is unavailable")).toBeTruthy()
    expect(screen.queryByText("Jordan Reyes")).toBeNull()
  })
})
