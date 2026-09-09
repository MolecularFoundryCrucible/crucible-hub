import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { projectQueryOptions } from "@/data/crucible/projects.queries"
import { identityScope } from "@/data/crucible/query-keys"
import {
  addWorkspaceProjectMember,
  removeWorkspaceProjectMember,
  updateWorkspaceProjectMemberRole,
} from "@/data/crucible/projects.functions"
import { getWorkspaceSearch } from "@/data/crucible/search.functions"
import type { components } from "@/generated/crucible-api"
import type { HubResult } from "@/data/crucible/result"
import type { WorkspaceSearchResult } from "@/data/crucible/workspace-source"

import { ProjectLeaveCard } from "./project-leave-card"
import { ProjectMembershipCard } from "./project-membership-card"
import type { MembershipProject } from "./project-membership-card"

vi.mock("@/data/crucible/projects.functions", () => ({
  addWorkspaceProjectMember: vi.fn(),
  removeWorkspaceProjectMember: vi.fn(),
  updateWorkspaceProjectMemberRole: vi.fn(),
}))

vi.mock("@/data/crucible/search.functions", () => ({
  getWorkspaceSearch: vi.fn(),
}))

const scope = identityScope("crucible-fixture:populated", "account")
type ProjectMember = components["schemas"]["AccessGroupMemberRead"]

const owner = {
  first_name: "Ada",
  is_service_account: false,
  last_name: "Lovelace",
  role: "owner",
  unique_id: "owner",
  username: "ada.lovelace",
}

const account = {
  first_name: "Morgan",
  is_service_account: false,
  last_name: "Lee",
  role: "editor",
  unique_id: "account",
  username: "morgan.lee",
}

const project = {
  capabilities: {
    can_change_status: false,
    can_edit: true,
    can_manage_access: true,
    can_transfer: true,
    max_grant_role: "editor",
  },
  members: [owner, account],
  project_id: "project-id",
  title: "Catalyst mapping",
  unique_id: "project-mfid",
} satisfies MembershipProject

const jamie = {
  context: "jamie.patel",
  kind: "person",
  name: "Jamie Patel",
  unique_id: "jamie-mfid",
} satisfies WorkspaceSearchResult

function ok(members: ProjectMember[]): HubResult<ProjectMember[]> {
  return { data: members, status: "ok" }
}

function searchResponse(items: readonly WorkspaceSearchResult[]) {
  return {
    data: {
      groups: [
        { error: false, items, kind: "person" as const, total: items.length },
      ],
      query: "jam",
    },
    status: "ok" as const,
  }
}

function renderCard(
  props: Partial<React.ComponentProps<typeof ProjectMembershipCard>> = {}
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <QueryClientProvider client={queryClient}>
      <ProjectMembershipCard
        accountId="account"
        mode="fixture"
        project={project}
        scope={scope}
        {...props}
      />
    </QueryClientProvider>
  )
  return queryClient
}

describe("ProjectMembershipCard", () => {
  afterEach(cleanup)

  beforeEach(() => {
    vi.mocked(addWorkspaceProjectMember).mockReset()
    vi.mocked(removeWorkspaceProjectMember).mockReset()
    vi.mocked(updateWorkspaceProjectMemberRole).mockReset()
    vi.mocked(getWorkspaceSearch).mockReset()
  })

  it("keeps unavailable membership distinct from an empty member list", () => {
    const { rerender } = render(
      <QueryClientProvider client={new QueryClient()}>
        <ProjectMembershipCard
          accountId="account"
          mode="fixture"
          project={{ ...project, members: null }}
          scope={scope}
        />
      </QueryClientProvider>
    )

    expect(
      screen.getByText("Detailed membership is not available.")
    ).toBeTruthy()

    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <ProjectMembershipCard
          accountId="account"
          mode="fixture"
          project={{ ...project, members: [] }}
          scope={scope}
        />
      </QueryClientProvider>
    )

    expect(screen.getByText("No members are currently listed.")).toBeTruthy()
  })

  it("searches people after three characters and adds the canonical identifier", async () => {
    vi.mocked(getWorkspaceSearch).mockResolvedValue(searchResponse([jamie]))
    vi.mocked(addWorkspaceProjectMember).mockResolvedValue(
      ok([
        ...project.members,
        {
          ...jamie,
          first_name: "Jamie",
          is_service_account: false,
          last_name: "Patel",
          role: "editor",
          username: "jamie.patel",
        },
      ])
    )
    const queryClient = renderCard()

    fireEvent.click(screen.getByRole("button", { name: "Add member" }))
    const searchBox = screen.getByRole("searchbox", { name: "Search people" })
    fireEvent.change(searchBox, { target: { value: "ja" } })
    expect(getWorkspaceSearch).not.toHaveBeenCalled()

    fireEvent.change(searchBox, { target: { value: "jam" } })
    await waitFor(() =>
      expect(getWorkspaceSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            kinds: ["person"],
            query: "jam",
          }),
        })
      )
    )

    fireEvent.change(screen.getByLabelText("Project role"), {
      target: { value: "editor" },
    })
    const dialog = screen.getByRole("dialog", { name: "Add member" })
    fireEvent.click(within(dialog).getByRole("option", { name: /Jamie Patel/ }))
    fireEvent.click(within(dialog).getByRole("button", { name: "Add member" }))

    await waitFor(() =>
      expect(addWorkspaceProjectMember).toHaveBeenCalledWith({
        data: {
          projectMfid: "project-mfid",
          role: "editor",
          scenario: "populated",
          userId: "jamie-mfid",
        },
      })
    )
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(
      queryClient.getQueryData(
        projectQueryOptions(scope, "project-mfid").queryKey
      )
    ).toMatchObject({
      members: expect.arrayContaining([
        expect.objectContaining({ unique_id: "jamie-mfid" }),
      ]),
    })
  })

  it("keeps the add dialog and local error available after failure", async () => {
    vi.mocked(getWorkspaceSearch).mockResolvedValue(searchResponse([jamie]))
    vi.mocked(addWorkspaceProjectMember).mockRejectedValue(
      new Error("fixture failure")
    )
    renderCard()

    fireEvent.click(screen.getByRole("button", { name: "Add member" }))
    fireEvent.change(screen.getByRole("searchbox", { name: "Search people" }), {
      target: { value: "jam" },
    })
    const addResult = await screen.findByRole("option", {
      name: /Jamie Patel/,
    })
    fireEvent.click(addResult)
    fireEvent.click(
      within(screen.getByRole("dialog", { name: "Add member" })).getByRole(
        "button",
        { name: "Add member" }
      )
    )

    expect(
      await screen.findByText("Could not add this member. Try again.")
    ).toBeTruthy()
    expect(screen.getByRole("dialog", { name: "Add member" })).toBeTruthy()
  })

  it("keeps the prior role visible until a role update succeeds", async () => {
    let resolveUpdate:
      ((result: HubResult<ProjectMember[]>) => void) | undefined
    vi.mocked(updateWorkspaceProjectMemberRole).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveUpdate = resolve
        })
    )
    renderCard()

    fireEvent.click(screen.getByRole("button", { name: "Manage members" }))
    const roleSelect = screen.getByLabelText<HTMLSelectElement>(
      "Role for Morgan Lee"
    )
    expect(roleSelect.value).toBe("editor")
    fireEvent.change(roleSelect, { target: { value: "viewer" } })

    expect(roleSelect.value).toBe("editor")
    resolveUpdate?.(ok([owner, { ...account, role: "viewer" }]))

    await waitFor(() => expect(roleSelect.value).toBe("viewer"))
    expect(updateWorkspaceProjectMemberRole).toHaveBeenCalledWith({
      data: {
        projectMfid: "project-mfid",
        role: "viewer",
        scenario: "populated",
        userId: "account",
      },
    })
  })

  it("hides removal controls until role management is enabled", () => {
    renderCard({
      project: {
        ...project,
        capabilities: { ...project.capabilities, can_transfer: false },
      },
    })

    expect(
      screen.queryByRole("button", { name: "Remove Ada Lovelace" })
    ).toBeNull()
    expect(
      screen.queryByRole("button", { name: "Remove Morgan Lee" })
    ).toBeNull()
  })

  it("uses direct removal for confirmed voluntary leave", async () => {
    const onSuccess = vi.fn()
    vi.mocked(removeWorkspaceProjectMember).mockResolvedValue(ok([owner]))
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    render(
      <QueryClientProvider client={queryClient}>
        <ProjectLeaveCard
          accountId="account"
          mode="fixture"
          onSuccess={onSuccess}
          project={project}
          scope={scope}
        />
      </QueryClientProvider>
    )

    fireEvent.click(screen.getByRole("button", { name: "Leave project" }))
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Leave project",
      })
    )

    await waitFor(() =>
      expect(removeWorkspaceProjectMember).toHaveBeenCalledWith({
        data: {
          projectMfid: "project-mfid",
          scenario: "populated",
          userId: "account",
        },
      })
    )
    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce())
  })
})
