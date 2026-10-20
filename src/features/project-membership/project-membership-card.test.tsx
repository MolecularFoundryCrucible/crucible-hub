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

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => (
    <a href="#person">{children}</a>
  ),
}))

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
    can_delete: false,
    can_edit: true,
    can_manage_access: true,
    can_transfer: true,
    max_grant_role: "editor",
  },
  creation_time: "2026-06-12T18:30:00Z",
  lead: null,
  members: [owner, account],
  modification_time: "2026-08-30T21:14:00Z",
  organization: "Example National Laboratory",
  project_id: "project-id",
  project_lead_orcid: owner.unique_id,
  scientific_metadata: null,
  status: "active",
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

function ensureManaging(name: string) {
  const toggle = screen.getByRole("button", { name })
  if (toggle.getAttribute("aria-pressed") !== "true") fireEvent.click(toggle)
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

    ensureManaging("Manage members")
    fireEvent.click(screen.getByRole("button", { name: "Add member" }))
    const searchBox = screen.getByRole("combobox", { name: "Search people" })
    fireEvent.click(searchBox)
    fireEvent.change(searchBox, { target: { value: "ja" } })
    expect(getWorkspaceSearch).not.toHaveBeenCalled()

    fireEvent.change(searchBox, { target: { value: "jam" } })
    fireEvent.keyDown(searchBox, { key: "ArrowDown" })
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

    fireEvent.click(await screen.findByRole("option", { name: /Jamie Patel/ }))
    const stagedRole = screen.getByLabelText<HTMLSelectElement>(
      "Role for Jamie Patel"
    )
    expect(stagedRole.value).toBe("editor")
    const dialog = screen.getByRole("dialog", { name: "Add member" })
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

  it("keeps the add dialog and staged member available after failure", async () => {
    vi.mocked(getWorkspaceSearch).mockResolvedValue(searchResponse([jamie]))
    vi.mocked(addWorkspaceProjectMember).mockRejectedValue(
      new Error("fixture failure")
    )
    renderCard()

    ensureManaging("Manage members")
    fireEvent.click(screen.getByRole("button", { name: "Add member" }))
    const searchBox = screen.getByRole("combobox", { name: "Search people" })
    fireEvent.click(searchBox)
    fireEvent.change(searchBox, {
      target: { value: "jam" },
    })
    fireEvent.keyDown(searchBox, { key: "ArrowDown" })
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
      await screen.findByText("1 member could not be added. Try again.")
    ).toBeTruthy()
    expect(screen.getByRole("dialog", { name: "Add member" })).toBeTruthy()
    expect(screen.getByRole("list", { name: "Members to add" })).toBeTruthy()
  })

  it("commits multiple staged members through serial add calls", async () => {
    const second = {
      context: "avery.chen",
      kind: "person" as const,
      name: "Avery Chen",
      unique_id: "avery-mfid",
    }
    vi.mocked(getWorkspaceSearch).mockResolvedValue(
      searchResponse([jamie, second])
    )
    vi.mocked(addWorkspaceProjectMember).mockResolvedValue(ok(project.members))
    renderCard()

    ensureManaging("Manage members")
    fireEvent.click(screen.getByRole("button", { name: "Add member" }))
    const searchBox = screen.getByRole("combobox", { name: "Search people" })
    fireEvent.click(searchBox)
    fireEvent.change(searchBox, { target: { value: "jam" } })
    fireEvent.click(await screen.findByRole("option", { name: /Jamie Patel/ }))

    fireEvent.change(searchBox, { target: { value: "ave" } })
    fireEvent.click(await screen.findByRole("option", { name: /Avery Chen/ }))

    const dialog = screen.getByRole("dialog", { name: "Add member" })
    expect(
      within(dialog).getByRole("button", { name: "Add 2 members" })
    ).toBeTruthy()
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Add 2 members" })
    )

    await waitFor(() =>
      expect(addWorkspaceProjectMember).toHaveBeenCalledTimes(2)
    )
    expect(addWorkspaceProjectMember).toHaveBeenNthCalledWith(1, {
      data: {
        projectMfid: "project-mfid",
        role: "editor",
        scenario: "populated",
        userId: "jamie-mfid",
      },
    })
    expect(addWorkspaceProjectMember).toHaveBeenNthCalledWith(2, {
      data: {
        projectMfid: "project-mfid",
        role: "editor",
        scenario: "populated",
        userId: "avery-mfid",
      },
    })
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  })

  it("caps staged service-account roles at viewer and contributor", async () => {
    const serviceAccount = {
      context: "beamline-collector",
      is_service_account: true,
      kind: "person" as const,
      name: "Beamline Collector",
      unique_id: "sa-mfid",
    }
    vi.mocked(getWorkspaceSearch).mockResolvedValue(
      searchResponse([serviceAccount])
    )
    renderCard()

    ensureManaging("Manage members")
    fireEvent.click(screen.getByRole("button", { name: "Add member" }))
    const searchBox = screen.getByRole("combobox", { name: "Search people" })
    fireEvent.click(searchBox)
    fireEvent.change(searchBox, { target: { value: "beam" } })
    fireEvent.click(
      await screen.findByRole("option", { name: /Beamline Collector/ })
    )

    const stagedRole = screen.getByLabelText<HTMLSelectElement>(
      "Role for Beamline Collector"
    )
    expect(stagedRole.value).toBe("contributor")
    expect(
      Array.from(stagedRole.options).map((option) => option.value)
    ).toEqual(["viewer", "contributor"])
  })

  it("shows locked removal state for non-removable members in managing mode", () => {
    const colleague = {
      first_name: "Tim",
      is_service_account: false,
      last_name: "Kodalle",
      role: "viewer",
      unique_id: "tim",
      username: "timkodalle",
    }
    renderCard({
      project: { ...project, members: [owner, account, colleague] },
    })

    fireEvent.click(screen.getByRole("button", { name: "Manage members" }))

    expect(
      screen.getByRole("img", { name: "The manager cannot be removed here" })
    ).toBeTruthy()
    expect(
      screen.getByRole("img", {
        name: "You cannot remove your own membership here",
      })
    ).toBeTruthy()
    expect(
      screen.getByRole("button", { name: "Remove Tim Kodalle" })
    ).toBeTruthy()
  })

  it("omits checkboxes from non-removable rows in managing mode", () => {
    const colleague = {
      first_name: "Tim",
      is_service_account: false,
      last_name: "Kodalle",
      role: "viewer",
      unique_id: "tim",
      username: "timkodalle",
    }
    renderCard({
      project: { ...project, members: [owner, account, colleague] },
    })

    fireEvent.click(screen.getByRole("button", { name: "Manage members" }))

    expect(
      screen.queryByRole("checkbox", {
        name: "Select Ada Lovelace for removal",
      })
    ).toBeNull()
    expect(
      screen.queryByRole("checkbox", { name: "Select Morgan Lee for removal" })
    ).toBeNull()
    expect(
      screen.getByRole("checkbox", { name: "Select Tim Kodalle for removal" })
    ).toBeTruthy()
  })

  it("removes selected members through the batch dialog", async () => {
    const colleague = {
      first_name: "Tim",
      is_service_account: false,
      last_name: "Kodalle",
      role: "viewer",
      unique_id: "tim",
      username: "timkodalle",
    }
    const second = {
      first_name: "Robin",
      is_service_account: false,
      last_name: "Second",
      role: "viewer",
      unique_id: "second",
      username: "robin",
    }
    vi.mocked(removeWorkspaceProjectMember).mockResolvedValue(
      ok([owner, account])
    )
    renderCard({
      project: { ...project, members: [owner, account, colleague, second] },
    })

    fireEvent.click(screen.getByRole("button", { name: "Manage members" }))
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Select Tim Kodalle for removal" })
    )
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Select Robin Second for removal" })
    )
    fireEvent.click(screen.getByRole("button", { name: "Remove 2 members" }))

    const dialog = screen.getByRole("dialog", { name: "Remove members?" })
    expect(within(dialog).getByText("Tim Kodalle")).toBeTruthy()
    expect(within(dialog).getByText("Robin Second")).toBeTruthy()
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Remove 2 members" })
    )

    await waitFor(() =>
      expect(removeWorkspaceProjectMember).toHaveBeenCalledTimes(2)
    )
    expect(removeWorkspaceProjectMember).toHaveBeenNthCalledWith(1, {
      data: {
        projectMfid: "project-mfid",
        scenario: "populated",
        userId: "tim",
      },
    })
    expect(removeWorkspaceProjectMember).toHaveBeenNthCalledWith(2, {
      data: {
        projectMfid: "project-mfid",
        scenario: "populated",
        userId: "second",
      },
    })
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  })

  it("keeps failed members selected and retries only the remainder", async () => {
    const colleague = {
      first_name: "Tim",
      is_service_account: false,
      last_name: "Kodalle",
      role: "viewer",
      unique_id: "tim",
      username: "timkodalle",
    }
    const second = {
      first_name: "Robin",
      is_service_account: false,
      last_name: "Second",
      role: "viewer",
      unique_id: "second",
      username: "robin",
    }
    vi.mocked(removeWorkspaceProjectMember)
      .mockResolvedValueOnce(ok([owner, account, second]))
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce(ok([owner, account]))
    renderCard({
      project: { ...project, members: [owner, account, colleague, second] },
    })

    fireEvent.click(screen.getByRole("button", { name: "Manage members" }))
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Select Tim Kodalle for removal" })
    )
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Select Robin Second for removal" })
    )
    fireEvent.click(screen.getByRole("button", { name: "Remove 2 members" }))

    const dialog = screen.getByRole("dialog", { name: "Remove members?" })
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Remove 2 members" })
    )

    expect(
      await screen.findByText("1 member could not be removed. Try again.")
    ).toBeTruthy()
    expect(within(dialog).getByText("Robin Second")).toBeTruthy()
    expect(within(dialog).queryByText("Tim Kodalle")).toBeNull()

    fireEvent.click(
      within(dialog).getByRole("button", { name: "Remove member" })
    )

    await waitFor(() =>
      expect(removeWorkspaceProjectMember).toHaveBeenCalledTimes(3)
    )
    expect(removeWorkspaceProjectMember).toHaveBeenLastCalledWith({
      data: {
        projectMfid: "project-mfid",
        scenario: "populated",
        userId: "second",
      },
    })
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  })

  it("opens the removal dialog from the per-row remove control", async () => {
    const colleague = {
      first_name: "Tim",
      is_service_account: false,
      last_name: "Kodalle",
      role: "viewer",
      unique_id: "tim",
      username: "timkodalle",
    }
    vi.mocked(removeWorkspaceProjectMember).mockResolvedValue(
      ok([owner, account])
    )
    renderCard({
      project: { ...project, members: [owner, account, colleague] },
    })

    fireEvent.click(screen.getByRole("button", { name: "Manage members" }))
    fireEvent.click(screen.getByRole("button", { name: "Remove Tim Kodalle" }))

    const dialog = screen.getByRole("dialog", { name: "Remove member?" })
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Remove member" })
    )

    await waitFor(() =>
      expect(removeWorkspaceProjectMember).toHaveBeenCalledWith({
        data: {
          projectMfid: "project-mfid",
          scenario: "populated",
          userId: "tim",
        },
      })
    )
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
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
