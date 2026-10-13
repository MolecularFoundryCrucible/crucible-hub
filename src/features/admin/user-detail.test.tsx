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
import { provisionWorkspaceUserApiKeyFn } from "@/data/crucible/users.functions"

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

vi.mock("@/data/crucible/users.functions", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  provisionWorkspaceUserApiKeyFn: vi.fn(),
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
  projectsQueryOptions: (
    _scope: unknown,
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

function renderUserDetail() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })
  queryClient.setQueryData(
    [
      "projects",
      { direction: "asc", limit: 100, memberRef: "test-user", sort: "title" },
    ],
    {
      items: mockProjects,
      limit: 100,
      nextCursor: null,
      total: mockProjects.length,
    }
  )

  return render(
    <QueryClientProvider client={queryClient}>
      <UserDetailView scope={scope} user={testUser} />
    </QueryClientProvider>
  )
}

describe("UserDetailView projects table sorting", () => {
  afterEach(cleanup)

  it("renders identity card without redundant account type", () => {
    renderUserDetail()

    expect(screen.getByText("Crucible ID / ORCID")).toBeTruthy()
    expect(screen.getByText("Username")).toBeTruthy()
    expect(screen.getByText("Platform role")).toBeTruthy()
    expect(screen.getByText("Email")).toBeTruthy()
    expect(screen.queryByText("Account type")).toBeNull()
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

    const initialRows = screen.getAllByRole("row").slice(1)
    expect(initialRows[0].textContent).toContain("Alpha Project")
    expect(initialRows[1].textContent).toContain("Beta Project")
    expect(initialRows[2].textContent).toContain("Gamma Project")

    fireEvent.click(projectButton)
    await waitFor(() => {
      const rowsDesc = screen.getAllByRole("row").slice(1)
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
      const rowsDesc = screen.getAllByRole("row").slice(1)
      expect(rowsDesc[0].textContent).toContain("Gamma Project")
      expect(rowsDesc[1].textContent).toContain("Beta Project")
      expect(rowsDesc[2].textContent).toContain("Alpha Project")
    })

    const updatedButton = screen.getByRole("button", { name: /updated/i })
    fireEvent.click(updatedButton)
    await waitFor(() => {
      const rowsUpdated = screen.getAllByRole("row").slice(1)
      expect(rowsUpdated[0].textContent).toContain("Alpha Project")
      expect(rowsUpdated[1].textContent).toContain("Beta Project")
      expect(rowsUpdated[2].textContent).toContain("Gamma Project")
    })
  })
})

describe("UserDetailView API key provisioning", () => {
  afterEach(cleanup)

  it("asks for a fresh sign-in inside the confirmation dialog", async () => {
    vi.mocked(provisionWorkspaceUserApiKeyFn).mockResolvedValue({
      error: {
        correlationId: "request-1",
        kind: "reauthentication-required",
        message: "Sign in again to continue.",
        retryable: false,
      },
      status: "error",
    })
    renderUserDetail()

    fireEvent.click(screen.getByRole("button", { name: "Rotate API key" }))
    const dialog = await screen.findByRole("alertdialog", {
      name: "Rotate user API key",
    })
    fireEvent.click(within(dialog).getByRole("button", { name: "Rotate key" }))

    const signIn = await within(dialog).findByRole("button", {
      name: "Sign in with ORCID",
    })
    const href = new URL(signIn.getAttribute("href") ?? "", "https://hub.test")
    expect(href.pathname).toBe("/hub/auth/login")
    expect(href.searchParams.get("max_age")).toBe("0")
    expect(href.searchParams.get("returnTo")).toMatch(/#reauthenticated$/)
    expect(screen.getByRole("alertdialog")).toBe(dialog)
  })
})
