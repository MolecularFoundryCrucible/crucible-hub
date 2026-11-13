import { fixtureEntryCapabilities } from "@/data/crucible/entry-capabilities"
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

import { identityScope } from "@/data/crucible/query-keys"
import {
  addWorkspaceInstrumentMember,
  addWorkspaceInstrumentOperator,
  removeWorkspaceInstrumentMember,
  removeWorkspaceInstrumentOperator,
  updateWorkspaceInstrumentMemberRole,
} from "@/data/crucible/instruments.functions"
import {
  instrumentMembersQueryOptions,
  instrumentOperatorsQueryOptions,
} from "@/data/crucible/instruments.queries"
import { getWorkspaceSearch } from "@/data/crucible/search.functions"
import type { HubResult } from "@/data/crucible/result"
import type {
  WorkspaceInstrumentMember,
  WorkspaceInstrumentOperator,
  WorkspaceSearchResult,
} from "@/data/crucible/workspace-source"
import { InstrumentAccessCard } from "./instrument-operators-card"

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  Link: ({ children }: { children: React.ReactNode }) => (
    <a href="#test">{children}</a>
  ),
}))

vi.mock("@/data/crucible/instruments.functions", () => ({
  addWorkspaceInstrumentMember: vi.fn(),
  addWorkspaceInstrumentOperator: vi.fn(),
  getWorkspaceInstrumentMembers: vi.fn(),
  getWorkspaceInstrumentOperators: vi.fn(),
  removeWorkspaceInstrumentMember: vi.fn(),
  removeWorkspaceInstrumentOperator: vi.fn(),
  updateWorkspaceInstrumentMemberRole: vi.fn(),
}))

vi.mock("@/data/crucible/search.functions", () => ({
  getWorkspaceSearch: vi.fn(),
}))

const scope = identityScope("crucible-fixture:populated", "account")

const owner = {
  first_name: "Morgan",
  is_service_account: false,
  last_name: "Patel",
  unique_id: "0000-0000-0000-0036",
  username: "mpatel",
}

const instrument = {
  capabilities: {
    can_change_status: true,
    can_delete: true,
    can_request_deletion: true,
    can_edit: true,
    can_manage_access: true,
    can_view_access: true,
    can_transfer: true,
    can_delete_files: false,
    max_grant_role: "admin" as const,
  },
  creation_time: "2026-09-18T23:45:26.816156Z",
  description: "Automated coffee making arm",
  instrument_id: "i_coffee_arm",
  instrument_type: "Coffee Arm",
  kind: "instrument" as const,
  location: "Logan Airport",
  manufacturer: "Bialetti",
  model: null,
  modification_time: null,
  name: "CoffeeArm",
  other_id: null,
  other_id_source: null,
  owner,
  owner_orcid: owner.unique_id,
  resource_type: "instrument",
  scientific_metadata: null,
  status: "active" as const,
  unique_id: "0tndsmbcwny6x000yd463w8mjw",
}

function withEntryCapabilities(
  members: WorkspaceInstrumentMember[]
): WorkspaceInstrumentMember[] {
  return members.map((member) => ({
    ...member,
    capabilities: fixtureEntryCapabilities({
      maxGrantRole: "admin",
      role: member.role,
    }),
  }))
}

const initialMembers: WorkspaceInstrumentMember[] = withEntryCapabilities([
  { ...owner, role: "owner" },
  {
    first_name: "Jordan",
    is_service_account: false,
    last_name: "Reyes",
    role: "editor",
    unique_id: "0000-0000-0000-0034",
    username: "jreyes",
  },
])

function memberFor(
  candidate: WorkspaceSearchResult,
  role: string
): WorkspaceInstrumentMember {
  const [first_name, last_name] = candidate.name.split(" ")
  return {
    first_name,
    is_service_account: false,
    last_name,
    role,
    unique_id: candidate.unique_id,
    username: candidate.context,
  }
}

const initialOperators: WorkspaceInstrumentOperator[] = [
  {
    first_name: "Beamline",
    is_service_account: true,
    last_name: "Collector",
    role: "operator",
    unique_id: "sa-1",
    username: "beamline-collector",
  },
]

const candidatePerson: WorkspaceSearchResult = {
  context: "jamie.patel",
  kind: "person",
  name: "Jamie Patel",
  unique_id: "0000-0000-0000-0026",
}

const candidateOperator: WorkspaceSearchResult = {
  context: "robot-operator",
  is_service_account: true,
  kind: "person",
  name: "Robot Operator",
  unique_id: "sa-2",
}

function ok<T>(data: T): HubResult<T> {
  return { data, status: "ok" }
}

function searchResponse(items: readonly WorkspaceSearchResult[]) {
  return {
    data: {
      groups: [
        { error: false, items, kind: "person" as const, total: items.length },
      ],
      query: "test",
    },
    status: "ok" as const,
  }
}

function ensureManaging(name: string) {
  const toggle = screen.queryByRole("button", { name })
  if (toggle) fireEvent.click(toggle)
}

describe("InstrumentAccessCard", () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })
    queryClient.setQueryData(
      instrumentMembersQueryOptions(scope, instrument.unique_id).queryKey,
      initialMembers
    )
    queryClient.setQueryData(
      instrumentOperatorsQueryOptions(scope, instrument.unique_id).queryKey,
      initialOperators
    )
    vi.mocked(addWorkspaceInstrumentMember).mockReset()
    vi.mocked(updateWorkspaceInstrumentMemberRole).mockReset()
    vi.mocked(removeWorkspaceInstrumentMember).mockReset()
    vi.mocked(addWorkspaceInstrumentOperator).mockReset()
    vi.mocked(removeWorkspaceInstrumentOperator).mockReset()
    vi.mocked(getWorkspaceSearch).mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  function renderCard() {
    return render(
      <QueryClientProvider client={queryClient}>
        <InstrumentAccessCard instrument={instrument} scope={scope} />
      </QueryClientProvider>
    )
  }

  it("renders manager, members, and operators", async () => {
    renderCard()

    expect(screen.getByText("Access management")).toBeTruthy()
    expect(screen.getByText("Members")).toBeTruthy()
    expect(screen.getByText("Operators")).toBeTruthy()

    expect(screen.getByText("Morgan Patel")).toBeTruthy()
    expect(screen.getByText("Manager")).toBeTruthy()

    expect(screen.getByText("Jordan Reyes")).toBeTruthy()
    expect(screen.getByText("Editor")).toBeTruthy()

    expect(screen.getByText("Beamline Collector")).toBeTruthy()
    expect(screen.getByText("Operator")).toBeTruthy()
  })

  it("shows members and operators read-only to people who cannot manage access", () => {
    render(
      <QueryClientProvider client={queryClient}>
        <InstrumentAccessCard
          instrument={{
            ...instrument,
            capabilities: {
              ...instrument.capabilities,
              can_manage_access: false,
              can_view_access: true,
              max_grant_role: null,
            },
          }}
          scope={scope}
        />
      </QueryClientProvider>
    )

    expect(screen.getByText("Access management")).toBeTruthy()
    expect(screen.getByText("Jordan Reyes")).toBeTruthy()
    expect(screen.getByText("Beamline Collector")).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Edit access" })).toBeNull()
  })

  it("says when the API hides membership", () => {
    queryClient.setQueryData(
      instrumentMembersQueryOptions(scope, instrument.unique_id).queryKey,
      null
    )
    renderCard()

    expect(
      screen.getByText("Membership details are not available.")
    ).toBeTruthy()
  })

  it("toggles managing mode and updates a member's role", async () => {
    const updatedMembers = withEntryCapabilities([
      initialMembers[0],
      { ...initialMembers[1], role: "admin" },
    ])
    vi.mocked(updateWorkspaceInstrumentMemberRole).mockResolvedValue(
      ok(updatedMembers)
    )

    renderCard()

    fireEvent.click(screen.getByRole("button", { name: "Edit access" }))

    expect(screen.getByText("Role changes save automatically.")).toBeTruthy()
    expect(
      screen.getByRole("img", { name: "The manager cannot be removed here" })
    ).toBeTruthy()
    expect(
      screen.getByRole("button", { name: "Remove Jordan Reyes" })
    ).toBeTruthy()

    const roleSelect = screen.getByLabelText<HTMLSelectElement>(
      "Role for Jordan Reyes"
    )
    expect(roleSelect.value).toBe("editor")
    expect(
      Array.from(roleSelect.options).map((option) => option.value)
    ).toEqual(["viewer", "editor", "admin"])

    fireEvent.change(roleSelect, { target: { value: "admin" } })

    await waitFor(() => {
      expect(updateWorkspaceInstrumentMemberRole).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            instrumentMfid: instrument.unique_id,
            role: "admin",
            userId: "0000-0000-0000-0034",
          }),
        })
      )
    })
    await waitFor(() => {
      expect(
        queryClient.getQueryData(
          instrumentMembersQueryOptions(scope, instrument.unique_id).queryKey
        )
      ).toEqual(updatedMembers)
    })
  })

  it("removes a member via confirmation dialog", async () => {
    vi.mocked(removeWorkspaceInstrumentMember).mockResolvedValue(
      ok([initialMembers[0]])
    )

    renderCard()

    fireEvent.click(screen.getByRole("button", { name: "Edit access" }))
    fireEvent.click(screen.getByLabelText("Remove Jordan Reyes"))

    const dialog = screen.getByRole("dialog", { name: "Remove member?" })
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Remove member" })
    )

    await waitFor(() => {
      expect(removeWorkspaceInstrumentMember).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            instrumentMfid: instrument.unique_id,
            userId: "0000-0000-0000-0034",
          }),
        })
      )
    })
  })

  it("adds a new member with role selection", async () => {
    vi.mocked(getWorkspaceSearch).mockResolvedValue(
      searchResponse([candidatePerson])
    )
    vi.mocked(addWorkspaceInstrumentMember).mockResolvedValue(
      ok([...initialMembers, memberFor(candidatePerson, "editor")])
    )

    renderCard()

    ensureManaging("Edit access")
    fireEvent.click(screen.getByRole("button", { name: "Add member" }))

    const dialog = screen.getByRole("dialog", { name: "Add member" })
    expect(within(dialog).queryByLabelText("Principal type")).toBeNull()
    const searchInput = within(dialog).getByRole("combobox", {
      name: "Search people",
    })
    fireEvent.click(searchInput)
    fireEvent.change(searchInput, { target: { value: "jam" } })
    fireEvent.keyDown(searchInput, { key: "ArrowDown" })

    await waitFor(() =>
      expect(getWorkspaceSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ kinds: ["person"], query: "jam" }),
        })
      )
    )

    fireEvent.click(await screen.findByRole("option", { name: /Jamie Patel/i }))

    const stagedRole = within(dialog).getByLabelText<HTMLSelectElement>(
      "Role for Jamie Patel"
    )
    expect(stagedRole.value).toBe("viewer")
    expect(
      Array.from(stagedRole.options).map((option) => option.value)
    ).not.toContain("contributor")
    fireEvent.change(stagedRole, { target: { value: "editor" } })

    fireEvent.click(within(dialog).getByRole("button", { name: "Add member" }))

    await waitFor(() => {
      expect(addWorkspaceInstrumentMember).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            instrumentMfid: instrument.unique_id,
            role: "editor",
            userId: candidatePerson.unique_id,
          }),
        })
      )
    })
  })

  it("keeps successful stages and retries only failures", async () => {
    const secondCandidate: WorkspaceSearchResult = {
      context: "avery.chen",
      kind: "person",
      name: "Avery Chen",
      unique_id: "0000-0000-0000-0042",
    }
    vi.mocked(getWorkspaceSearch).mockResolvedValue(
      searchResponse([candidatePerson, secondCandidate])
    )
    const addedMembers = [
      ...initialMembers,
      memberFor(candidatePerson, "viewer"),
    ]
    vi.mocked(addWorkspaceInstrumentMember)
      .mockResolvedValueOnce(ok(addedMembers))
      .mockRejectedValueOnce(new Error("network down"))

    renderCard()

    ensureManaging("Edit access")
    fireEvent.click(screen.getByRole("button", { name: "Add member" }))

    const dialog = screen.getByRole("dialog", { name: "Add member" })
    const searchInput = within(dialog).getByRole("combobox", {
      name: "Search people",
    })
    fireEvent.click(searchInput)
    fireEvent.change(searchInput, { target: { value: "jam" } })
    fireEvent.click(await screen.findByRole("option", { name: /Jamie Patel/i }))
    fireEvent.change(searchInput, { target: { value: "ave" } })
    fireEvent.click(await screen.findByRole("option", { name: /Avery Chen/i }))

    fireEvent.click(
      within(dialog).getByRole("button", { name: "Add 2 members" })
    )

    await waitFor(() => {
      expect(
        within(dialog).getByRole("button", { name: "Add member" })
      ).toBeTruthy()
    })
    expect(screen.getByText("1 member could not be added. Try again."))
    expect(
      queryClient.getQueryData(
        instrumentMembersQueryOptions(scope, instrument.unique_id).queryKey
      )
    ).toEqual(addedMembers)

    fireEvent.click(within(dialog).getByRole("button", { name: "Add member" }))

    await waitFor(() => {
      expect(addWorkspaceInstrumentMember).toHaveBeenCalledTimes(3)
    })
    expect(addWorkspaceInstrumentMember).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: secondCandidate.unique_id }),
      })
    )
  })

  it("hides service accounts from the member search", async () => {
    vi.mocked(getWorkspaceSearch).mockResolvedValue(
      searchResponse([candidatePerson, candidateOperator])
    )

    renderCard()

    ensureManaging("Edit access")
    fireEvent.click(screen.getByRole("button", { name: "Add member" }))

    const dialog = screen.getByRole("dialog", { name: "Add member" })
    const searchInput = within(dialog).getByRole("combobox", {
      name: "Search people",
    })
    fireEvent.click(searchInput)
    fireEvent.change(searchInput, { target: { value: "jam" } })

    await screen.findByRole("option", { name: /Jamie Patel/i })

    expect(screen.queryByRole("option", { name: /Robot Operator/i })).toBeNull()
  })

  it("omits the checkbox from the manager row in managing mode", () => {
    renderCard()

    fireEvent.click(screen.getByRole("button", { name: "Edit access" }))

    expect(
      screen.queryByRole("checkbox", {
        name: "Select Morgan Patel for removal",
      })
    ).toBeNull()
    expect(
      screen.getByRole("checkbox", { name: "Select Jordan Reyes for removal" })
    ).toBeTruthy()
  })

  it("removes multiple selected members through the batch dialog", async () => {
    const [secondMember] = withEntryCapabilities([
      {
        first_name: "Avery",
        is_service_account: false,
        last_name: "Chen",
        role: "viewer",
        unique_id: "0000-0000-0000-000X",
        username: "avery.chen",
      },
    ])
    queryClient.setQueryData(
      instrumentMembersQueryOptions(scope, instrument.unique_id).queryKey,
      [...initialMembers, secondMember]
    )
    vi.mocked(removeWorkspaceInstrumentMember).mockResolvedValue(
      ok([initialMembers[0]])
    )

    renderCard()

    fireEvent.click(screen.getByRole("button", { name: "Edit access" }))
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Select Jordan Reyes for removal" })
    )
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Select Avery Chen for removal" })
    )
    fireEvent.click(screen.getByRole("button", { name: "Remove 2 members" }))

    const dialog = screen.getByRole("dialog", { name: "Remove members?" })
    expect(within(dialog).getByText("Jordan Reyes")).toBeTruthy()
    expect(within(dialog).getByText("Avery Chen")).toBeTruthy()
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Remove 2 members" })
    )

    await waitFor(() =>
      expect(removeWorkspaceInstrumentMember).toHaveBeenCalledTimes(2)
    )
    expect(removeWorkspaceInstrumentMember).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({ userId: "0000-0000-0000-0034" }),
      })
    )
    expect(removeWorkspaceInstrumentMember).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({ userId: "0000-0000-0000-000X" }),
      })
    )
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  })

  it("unassigns an operator via confirmation dialog", async () => {
    vi.mocked(removeWorkspaceInstrumentOperator).mockResolvedValue(ok([]))

    renderCard()

    fireEvent.click(screen.getByRole("button", { name: "Edit access" }))

    const unassignButton = screen.getByLabelText("Unassign Beamline Collector")
    fireEvent.click(unassignButton)

    expect(screen.getByText("Unassign operator?")).toBeTruthy()
    const confirmButton = screen.getByRole("button", {
      name: "Unassign operator",
    })
    fireEvent.click(confirmButton)

    await waitFor(() => {
      expect(removeWorkspaceInstrumentOperator).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            instrumentMfid: instrument.unique_id,
            serviceAccountId: "sa-1",
          }),
        })
      )
    })
  })

  it("adds an operator via operator dialog", async () => {
    vi.mocked(getWorkspaceSearch).mockResolvedValue(
      searchResponse([candidateOperator])
    )
    vi.mocked(addWorkspaceInstrumentOperator).mockResolvedValue(
      ok([
        ...initialOperators,
        {
          first_name: "Robot",
          is_service_account: true,
          last_name: "Operator",
          role: "operator",
          unique_id: candidateOperator.unique_id,
          username: "robot-operator",
        },
      ])
    )

    renderCard()

    ensureManaging("Edit access")
    const addOperatorButton = screen.getByRole("button", {
      name: "Add operator",
    })
    fireEvent.click(addOperatorButton)

    const dialog = screen.getByRole("dialog", { name: "Add operator" })
    expect(dialog).toBeTruthy()

    const searchInput = within(dialog).getByRole("combobox", {
      name: "Search service accounts",
    })
    fireEvent.click(searchInput)
    fireEvent.change(searchInput, { target: { value: "jam" } })
    fireEvent.keyDown(searchInput, { key: "ArrowDown" })

    await waitFor(() =>
      expect(getWorkspaceSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            kinds: ["person"],
            query: "jam",
            serviceAccountsOnly: true,
          }),
        })
      )
    )

    const option = await screen.findByRole("option", {
      name: /Robot Operator/i,
    })
    fireEvent.click(option)

    const dialogAddButton = within(dialog).getByRole("button", {
      name: "Add operator",
    })
    fireEvent.click(dialogAddButton)

    await waitFor(() => {
      expect(addWorkspaceInstrumentOperator).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            instrumentMfid: instrument.unique_id,
            serviceAccountId: candidateOperator.unique_id,
          }),
        })
      )
    })
  })

  it("adds an operator with arrow-key and enter selection", async () => {
    vi.mocked(getWorkspaceSearch).mockResolvedValue(
      searchResponse([candidateOperator])
    )
    vi.mocked(addWorkspaceInstrumentOperator).mockResolvedValue(
      ok([
        ...initialOperators,
        {
          first_name: "Robot",
          is_service_account: true,
          last_name: "Operator",
          role: "operator",
          unique_id: candidateOperator.unique_id,
          username: "robot-operator",
        },
      ])
    )

    renderCard()

    ensureManaging("Edit access")
    fireEvent.click(screen.getByRole("button", { name: "Add operator" }))

    const dialog = screen.getByRole("dialog", { name: "Add operator" })
    const searchInput = within(dialog).getByRole("combobox", {
      name: "Search service accounts",
    })
    fireEvent.click(searchInput)
    fireEvent.change(searchInput, { target: { value: "jam" } })

    const option = await screen.findByRole("option", {
      name: /Robot Operator/i,
    })
    fireEvent.keyDown(searchInput, { key: "ArrowDown" })
    expect(option.hasAttribute("data-highlighted")).toBe(true)
    fireEvent.keyDown(searchInput, { key: "Enter" })

    expect((searchInput as HTMLInputElement).value).toBe("Robot Operator")

    const dialogAddButton = within(dialog).getByRole("button", {
      name: "Add operator",
    })
    fireEvent.click(dialogAddButton)

    await waitFor(() => {
      expect(addWorkspaceInstrumentOperator).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            instrumentMfid: instrument.unique_id,
            serviceAccountId: candidateOperator.unique_id,
          }),
        })
      )
    })
  })
})
