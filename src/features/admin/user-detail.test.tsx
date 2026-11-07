import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { identityScope } from "@/data/crucible/query-keys"
import type {
  WorkspaceAdminUser,
  WorkspaceUserProject,
} from "@/data/crucible/workspace-source"
import {
  getWorkspaceApiKeys,
  revokeWorkspaceApiKeyFn,
} from "@/data/crucible/api-keys.functions"
import {
  getWorkspaceUserIdentities,
  removeWorkspaceAccountIdentityFn,
  removeWorkspaceUserIdentityFn,
} from "@/data/crucible/account-identities.functions"

import { UserDetailView } from "./user-detail"

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
      <a href={to}>{children}</a>
    ),
    useBlocker: () => ({ proceed: vi.fn(), reset: vi.fn(), status: "idle" }),
  }
})

vi.mock(
  "@/data/crucible/account-identities.functions",
  async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    removeWorkspaceAccountIdentityFn: vi.fn(async () => ({
      status: "ok",
      data: undefined,
    })),
    removeWorkspaceUserIdentityFn: vi.fn(async () => ({
      status: "ok",
      data: undefined,
    })),
    getWorkspaceUserIdentities: vi.fn(async () => ({
      status: "ok",
      data: [
        {
          created_at: "2026-10-01T00:00:00Z",
          id: 7,
          label: null,
          last_used_at: null,
          orcid: "0000-0002-1825-0097",
          provider_key: "orcid",
          provider_name: "ORCID",
          verified_at: null,
        },
      ],
    })),
  })
)

vi.mock("@/data/crucible/api-keys.functions", () => ({
  createWorkspaceApiKeyFn: vi.fn(),
  getWorkspaceApiKeys: vi.fn(async () => ({
    data: { items: [], nextCursor: null, total: 0 },
    status: "ok",
  })),
  renameWorkspaceApiKeyFn: vi.fn(),
  revokeWorkspaceApiKeyFn: vi.fn(),
}))

const mockProjects: WorkspaceUserProject[] = [
  {
    creation_time: "2026-01-01T00:00:00Z",
    lead: {
      first_name: "Alice",
      is_service_account: false,
      last_name: "Smith",
      unique_id: "alice",
      username: "alice",
    },
    modification_time: "2026-03-01T00:00:00Z",
    organization: "crucible",
    project_id: "prj-alpha",
    role: "viewer",
    scientific_metadata: null,
    status: "ready",
    title: "Alpha Project",
    unique_id: "mfid-alpha",
  },
  {
    creation_time: "2026-02-01T00:00:00Z",
    lead: {
      first_name: "Bob",
      is_service_account: false,
      last_name: "Jones",
      unique_id: "bob",
      username: "bob",
    },
    modification_time: "2026-02-01T00:00:00Z",
    organization: "crucible",
    project_id: "prj-beta",
    role: "editor",
    scientific_metadata: null,
    status: "ready",
    title: "Beta Project",
    unique_id: "mfid-beta",
  },
  {
    creation_time: "2026-03-01T00:00:00Z",
    lead: {
      first_name: "Charlie",
      is_service_account: false,
      last_name: "Brown",
      unique_id: "charlie",
      username: "charlie",
    },
    modification_time: "2026-01-01T00:00:00Z",
    organization: "crucible",
    project_id: "prj-gamma",
    role: "owner",
    scientific_metadata: null,
    status: "ready",
    title: "Gamma Project",
    unique_id: "mfid-gamma",
  },
]

vi.mock("@/data/crucible/projects.queries", () => ({
  userProjectsQueryOptions: (
    _scope: unknown,
    _userRef: string,
    filters: { direction?: "asc" | "desc"; sort?: string }
  ) => ({
    queryFn: () => {
      const items = [...mockProjects]
      const dir = filters.direction === "desc" ? -1 : 1
      if (filters.sort === "title") {
        items.sort((a, b) => dir * (a.title ?? "").localeCompare(b.title ?? ""))
      } else if (filters.sort === "created") {
        items.sort(
          (a, b) =>
            dir * (a.creation_time || "").localeCompare(b.creation_time || "")
        )
      } else if (filters.sort === "updated") {
        items.sort(
          (a, b) =>
            dir *
            (a.modification_time || "").localeCompare(b.modification_time || "")
        )
      }
      return {
        items,
        limit: 100,
        nextCursor: null,
        total: items.length,
      }
    },
    queryKey: ["projects", filters],
  }),
}))

const scope = identityScope("crucible-fixture:populated", "account")

const testUser: WorkspaceAdminUser = {
  api_key_status: {
    created_at: "2026-01-01T00:00:00Z",
    expires_at: "2027-01-01T00:00:00Z",
    valid: true,
  },
  email: "test@example.com",
  first_name: "Test",
  is_service_account: false,
  last_name: "User",
  platform_role: "contributor",
  unique_id: "test-user",
  user_capabilities: {
    can_change_platform_role: true,
    can_edit_profile: true,
    can_manage_api_key: true,
    can_view_private: true,
  },
  username: "testuser",
}

function renderUserDetail(user: WorkspaceAdminUser = testUser) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })
  queryClient.setQueryData(
    ["projects", { direction: "asc", limit: 100, sort: "title" }],
    {
      items: mockProjects,
      limit: 100,
      nextCursor: null,
      total: mockProjects.length,
    }
  )

  return render(
    <QueryClientProvider client={queryClient}>
      <UserDetailView scope={scope} user={user} />
    </QueryClientProvider>
  )
}

describe("UserDetailView projects table sorting", () => {
  afterEach(cleanup)

  it("renders identity card without redundant account type", () => {
    renderUserDetail()

    expect(screen.getByText("Crucible ID")).toBeTruthy()
    expect(screen.getByText("Username")).toBeTruthy()
    expect(screen.getByText("Platform role")).toBeTruthy()
    expect(screen.getByText("Email")).toBeTruthy()
    expect(screen.queryByText("Account type")).toBeNull()
    expect(screen.queryByText("ORCID")).toBeNull()
  })

  it("lists the person's sign-in methods and keeps their only one", async () => {
    renderUserDetail()

    expect(await screen.findByText("Sign-in methods")).toBeTruthy()
    expect(
      await screen.findByRole("link", { name: "0000-0002-1825-0097" })
    ).toBeTruthy()
    expect(screen.getByText("Not verified")).toBeTruthy()
    expect(
      screen.queryByRole("button", { name: "Add sign-in method" })
    ).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Actions for ORCID" }))
    expect(
      (
        await screen.findByRole("menuitem", {
          name: "Remove",
        })
      ).getAttribute("aria-disabled")
    ).toBe("true")
  })

  it("removes one of a person's logins after naming them in the warning", async () => {
    vi.mocked(getWorkspaceUserIdentities).mockResolvedValueOnce({
      status: "ok",
      data: [
        {
          created_at: "2026-10-01T00:00:00Z",
          id: 7,
          label: null,
          last_used_at: null,
          orcid: "0000-0002-1825-0097",
          provider_key: "orcid",
          provider_name: "ORCID",
          verified_at: "2026-10-01T00:00:00Z",
        },
        {
          created_at: "2026-10-02T00:00:00Z",
          id: 8,
          label: "test@lab.example",
          last_used_at: null,
          orcid: null,
          provider_key: "lbl",
          provider_name: "Berkeley Lab",
          verified_at: null,
        },
      ],
    })
    renderUserDetail()

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Actions for Berkeley Lab (test@lab.example)",
      })
    )
    fireEvent.click(await screen.findByRole("menuitem", { name: "Remove" }))
    expect(
      await screen.findByText(/^Test User won.t be able to sign in with/)
    ).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Remove" }))
    await waitFor(() =>
      expect(vi.mocked(removeWorkspaceUserIdentityFn)).toHaveBeenCalledWith({
        data: { identityId: 8, userId: "test-user" },
      })
    )
  })

  it("removes an administrator's own login the way My profile does, keeping their session", async () => {
    vi.mocked(removeWorkspaceUserIdentityFn).mockClear()
    vi.mocked(getWorkspaceUserIdentities).mockResolvedValueOnce({
      status: "ok",
      data: [
        {
          created_at: "2026-10-01T00:00:00Z",
          id: 7,
          label: null,
          last_used_at: null,
          orcid: "0000-0002-1825-0097",
          provider_key: "orcid",
          provider_name: "ORCID",
          verified_at: "2026-10-01T00:00:00Z",
        },
        {
          created_at: "2026-10-02T00:00:00Z",
          id: 8,
          label: "test@lab.example",
          last_used_at: null,
          orcid: null,
          provider_key: "lbl",
          provider_name: "Berkeley Lab",
          verified_at: null,
        },
      ],
    })
    renderUserDetail({ ...testUser, unique_id: "account" })

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Actions for Berkeley Lab (test@lab.example)",
      })
    )
    fireEvent.click(await screen.findByRole("menuitem", { name: "Remove" }))
    expect(
      await screen.findByText(/^You won.t be able to sign in with/)
    ).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Remove" }))
    await waitFor(() =>
      expect(vi.mocked(removeWorkspaceAccountIdentityFn)).toHaveBeenCalledWith({
        data: { identityId: 8 },
      })
    )
    expect(vi.mocked(removeWorkspaceUserIdentityFn)).not.toHaveBeenCalled()
  })

  it("renders sortable headers for Project, Created, and Updated, and non-sortable Lead and Role", () => {
    renderUserDetail()

    expect(
      screen.getByRole("button", { name: /(sort by project|project, sorted)/i })
    ).toBeTruthy()
    expect(
      screen.getByRole("button", { name: /(sort by created|created, sorted)/i })
    ).toBeTruthy()
    expect(
      screen.getByRole("button", { name: /(sort by updated|updated, sorted)/i })
    ).toBeTruthy()
    expect(
      screen.queryByRole("button", { name: /(sort by lead|lead, sorted)/i })
    ).toBeNull()
    expect(
      screen.queryByRole("button", { name: /(sort by role|role, sorted)/i })
    ).toBeNull()
    expect(screen.getByRole("columnheader", { name: "Lead" })).toBeTruthy()
    expect(screen.getByRole("columnheader", { name: "Role" })).toBeTruthy()
  })

  it("sorts by project name ascending and descending when Project header is clicked", async () => {
    renderUserDetail()

    const projectButton = screen.getByRole("button", {
      name: /(sort by project|project, sorted)/i,
    })

    const initialRows = within(
      screen.getByRole("table", { name: "User projects" })
    )
      .getAllByRole("row")
      .slice(1)
    expect(initialRows[0].textContent).toContain("Alpha Project")
    expect(initialRows[1].textContent).toContain("Beta Project")
    expect(initialRows[2].textContent).toContain("Gamma Project")

    fireEvent.click(projectButton)
    await waitFor(() => {
      const rowsDesc = within(
        screen.getByRole("table", { name: "User projects" })
      )
        .getAllByRole("row")
        .slice(1)
      expect(rowsDesc[0].textContent).toContain("Gamma Project")
      expect(rowsDesc[1].textContent).toContain("Beta Project")
      expect(rowsDesc[2].textContent).toContain("Alpha Project")
    })
  })

  it("sorts by created and updated dates when clicked", async () => {
    renderUserDetail()

    const createdButton = screen.getByRole("button", {
      name: /(sort by created|created, sorted)/i,
    })
    fireEvent.click(createdButton)
    await waitFor(() => {
      const rowsDesc = within(
        screen.getByRole("table", { name: "User projects" })
      )
        .getAllByRole("row")
        .slice(1)
      expect(rowsDesc[0].textContent).toContain("Gamma Project")
      expect(rowsDesc[1].textContent).toContain("Beta Project")
      expect(rowsDesc[2].textContent).toContain("Alpha Project")
    })

    const updatedButton = screen.getByRole("button", { name: /updated/i })
    fireEvent.click(updatedButton)
    await waitFor(() => {
      const rowsUpdated = within(
        screen.getByRole("table", { name: "User projects" })
      )
        .getAllByRole("row")
        .slice(1)
      expect(rowsUpdated[0].textContent).toContain("Alpha Project")
      expect(rowsUpdated[1].textContent).toContain("Beta Project")
      expect(rowsUpdated[2].textContent).toContain("Gamma Project")
    })
  })
})

describe("UserDetailView API keys", () => {
  afterEach(cleanup)

  it("lists a person's keys and asks for a fresh sign-in to revoke one", async () => {
    vi.mocked(getWorkspaceApiKeys).mockResolvedValue({
      data: {
        items: [
          {
            created_at: "2026-09-01T00:00:00Z",
            expires_at: "2027-09-01T00:00:00Z",
            id: 7,
            last4: "7f3a",
            last_used_at: null,
            name: "Beamline laptop",
            older_routes: false,
            revoked_at: null,
            status: "active",
          },
        ],
        nextCursor: null,
        total: 1,
      },
      status: "ok",
    })
    vi.mocked(revokeWorkspaceApiKeyFn).mockResolvedValue({
      error: {
        correlationId: "request-1",
        kind: "reauthentication-required",
        message: "Sign in again to continue.",
        retryable: false,
      },
      status: "error",
    })
    renderUserDetail()

    const table = await screen.findByRole("table", { name: "Active API keys" })
    expect(within(table).getByText("Beamline laptop")).toBeTruthy()
    expect(screen.queryByRole("button", { name: "New key" })).toBeNull()
    fireEvent.click(
      within(table).getByRole("button", { name: "Actions for Beamline laptop" })
    )
    expect(screen.queryByRole("menuitem", { name: "Rename" })).toBeNull()
    fireEvent.click(await screen.findByRole("menuitem", { name: "Revoke" }))
    const dialog = await screen.findByRole("alertdialog", {
      name: "Revoke Beamline laptop?",
    })
    fireEvent.click(within(dialog).getByRole("button", { name: "Revoke" }))

    const signIn = await within(dialog).findByRole("button", {
      name: "Sign in again",
    })
    const href = new URL(signIn.getAttribute("href") ?? "", "https://hub.test")
    expect(href.pathname).toBe("/hub/auth/login")
    expect(href.searchParams.get("max_age")).toBe("0")
    expect(vi.mocked(revokeWorkspaceApiKeyFn)).toHaveBeenCalledWith({
      data: { keyId: 7, userId: expect.any(String) },
    })
  })
})
