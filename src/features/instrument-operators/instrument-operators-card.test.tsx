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
  revokeWorkspaceResourceAccess,
  setWorkspaceResourceAccess,
} from "@/data/crucible/access.functions"
import { resourceAccessQueryOptions } from "@/data/crucible/access.queries"
import {
  addWorkspaceInstrumentOperator,
  removeWorkspaceInstrumentOperator,
} from "@/data/crucible/instruments.functions"
import {
  instrumentMembersQueryOptions,
  instrumentOperatorsQueryOptions,
} from "@/data/crucible/instruments.queries"
import { getWorkspaceSearch } from "@/data/crucible/search.functions"
import type { HubResult } from "@/data/crucible/result"
import type {
  WorkspaceInstrumentOperator,
  WorkspaceResourceAccessGrant,
  WorkspaceSearchResult,
} from "@/data/crucible/workspace-source"
import {
  InstrumentAccessCard,
  InstrumentOperatorsCard,
} from "./instrument-operators-card"

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => (
    <a href="#test">{children}</a>
  ),
}))

vi.mock("@/data/crucible/access.functions", () => ({
  revokeWorkspaceResourceAccess: vi.fn(),
  setWorkspaceResourceAccess: vi.fn(),
}))

vi.mock("@/data/crucible/instruments.functions", () => ({
  addWorkspaceInstrumentOperator: vi.fn(),
  removeWorkspaceInstrumentOperator: vi.fn(),
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
  grants: WorkspaceResourceAccessGrant[]
): WorkspaceResourceAccessGrant[] {
  return grants.map((grant) => ({
    ...grant,
    capabilities: fixtureEntryCapabilities({
      maxGrantRole: "admin",
      role: grant.permission,
    }),
  }))
}

const initialGrants: WorkspaceResourceAccessGrant[] = withEntryCapabilities([
  {
    display_name: "Morgan Patel",
    permission: "owner",
    principal_id: owner.unique_id,
    principal_type: "user",
    slug: owner.username,
  },
  {
    display_name: "Jordan Reyes",
    permission: "editor",
    principal_id: "0000-0000-0000-0034",
    principal_type: "user",
    slug: "jreyes",
  },
])

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
  const toggle = screen.getByRole("button", { name })
  if (toggle.getAttribute("aria-pressed") !== "true") fireEvent.click(toggle)
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
      resourceAccessQueryOptions(scope, instrument.unique_id).queryKey,
      initialGrants
    )
    queryClient.setQueryData(
      instrumentOperatorsQueryOptions(scope, instrument.unique_id).queryKey,
      initialOperators
    )
    vi.mocked(setWorkspaceResourceAccess).mockReset()
    vi.mocked(revokeWorkspaceResourceAccess).mockReset()
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

  it("exports InstrumentOperatorsCard as an alias", () => {
    expect(InstrumentOperatorsCard).toBe(InstrumentAccessCard)
  })

  it("renders manager, members, and operators", async () => {
    renderCard()

    expect(screen.getByText("Access management")).toBeTruthy()
    expect(screen.getByText("Direct access")).toBeTruthy()
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
    expect(screen.queryByRole("button", { name: "Manage access" })).toBeNull()
  })

  it("toggles managing mode and updates a member's role", async () => {
    const updatedGrants: WorkspaceResourceAccessGrant[] = [
      initialGrants[0],
      {
        ...initialGrants[1],
        permission: "contributor",
      },
    ]
    vi.mocked(setWorkspaceResourceAccess).mockResolvedValue(ok(updatedGrants))

    renderCard()

    const manageToggle = screen.getByRole("button", { name: "Manage access" })
    fireEvent.click(manageToggle)

    expect(screen.getByText("Role changes save automatically.")).toBeTruthy()

    expect(
      screen.getByRole("img", { name: "The manager cannot be revoked here" })
    ).toBeTruthy()
    expect(
      screen.getByRole("button", { name: "Revoke access for Jordan Reyes" })
    ).toBeTruthy()

    const roleSelect = screen.getByLabelText<HTMLSelectElement>(
      "Role for Jordan Reyes"
    )
    expect(roleSelect).toBeTruthy()
    expect(roleSelect.value).toBe("editor")

    fireEvent.change(roleSelect, { target: { value: "contributor" } })

    await waitFor(() => {
      expect(setWorkspaceResourceAccess).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            kind: "users",
            permission: "contributor",
            principal: "0000-0000-0000-0034",
            resourceMfid: instrument.unique_id,
          }),
        })
      )
    })
    await waitFor(() => {
      expect(
        queryClient.getQueryData(
          instrumentMembersQueryOptions(scope, instrument.unique_id).queryKey
        )
      ).toEqual(updatedGrants)
    })
  })

  it("revokes a member via confirmation dialog", async () => {
    const remainingGrants: WorkspaceResourceAccessGrant[] = [initialGrants[0]]
    vi.mocked(revokeWorkspaceResourceAccess).mockResolvedValue(
      ok(remainingGrants)
    )

    renderCard()

    fireEvent.click(screen.getByRole("button", { name: "Manage access" }))

    const revokeButton = screen.getByLabelText("Revoke access for Jordan Reyes")
    fireEvent.click(revokeButton)

    expect(screen.getByText("Revoke access?")).toBeTruthy()
    const confirmButton = screen.getByRole("button", { name: "Revoke access" })
    fireEvent.click(confirmButton)

    await waitFor(() => {
      expect(revokeWorkspaceResourceAccess).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            kind: "users",
            principal: "0000-0000-0000-0034",
            resourceMfid: instrument.unique_id,
          }),
        })
      )
    })
  })

  it("adds a new member with role selection", async () => {
    vi.mocked(getWorkspaceSearch).mockResolvedValue(
      searchResponse([candidatePerson])
    )
    const nextGrants: WorkspaceResourceAccessGrant[] = [
      ...initialGrants,
      {
        display_name: "Jamie Patel",
        permission: "editor",
        principal_id: candidatePerson.unique_id,
        principal_type: "user",
        slug: "jamie.patel",
      },
    ]
    vi.mocked(setWorkspaceResourceAccess).mockResolvedValue(ok(nextGrants))

    renderCard()

    ensureManaging("Manage access")
    const addMemberButton = screen.getByRole("button", { name: "Add member" })
    fireEvent.click(addMemberButton)

    const dialog = screen.getByRole("dialog", { name: "Add direct access" })
    expect(dialog).toBeTruthy()

    const searchInput = within(dialog).getByRole("combobox", {
      name: "Search people",
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
          }),
        })
      )
    )

    const option = await screen.findByRole("option", { name: /Jamie Patel/i })
    fireEvent.click(option)

    const stagedRole = within(dialog).getByLabelText<HTMLSelectElement>(
      "Role for Jamie Patel"
    )
    expect(stagedRole.value).toBe("viewer")
    fireEvent.change(stagedRole, { target: { value: "contributor" } })

    const dialogAddButton = within(dialog).getByRole("button", {
      name: "Add member",
    })
    fireEvent.click(dialogAddButton)

    await waitFor(() => {
      expect(setWorkspaceResourceAccess).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            kind: "users",
            permission: "contributor",
            principal: candidatePerson.unique_id,
            resourceMfid: instrument.unique_id,
          }),
        })
      )
    })
  })

  it("commits multiple staged members with serial calls", async () => {
    const secondCandidate: WorkspaceSearchResult = {
      context: "avery.chen",
      kind: "person",
      name: "Avery Chen",
      unique_id: "0000-0000-0000-0042",
    }
    vi.mocked(getWorkspaceSearch).mockResolvedValue(
      searchResponse([candidatePerson, secondCandidate])
    )
    vi.mocked(setWorkspaceResourceAccess).mockResolvedValue(
      ok([...initialGrants])
    )

    renderCard()

    ensureManaging("Manage access")
    fireEvent.click(screen.getByRole("button", { name: "Add member" }))

    const dialog = screen.getByRole("dialog", { name: "Add direct access" })
    const searchInput = within(dialog).getByRole("combobox", {
      name: "Search people",
    })
    fireEvent.click(searchInput)
    fireEvent.change(searchInput, { target: { value: "jam" } })

    fireEvent.click(await screen.findByRole("option", { name: /Jamie Patel/i }))

    fireEvent.change(searchInput, { target: { value: "ave" } })
    fireEvent.click(await screen.findByRole("option", { name: /Avery Chen/i }))

    const stagedList = within(dialog).getByRole("list", {
      name: "Members to add",
    })
    expect(within(stagedList).getAllByRole("listitem")).toHaveLength(2)
    expect(
      within(dialog).getByRole("button", { name: "Add 2 members" })
    ).toBeTruthy()

    fireEvent.click(
      within(dialog).getByRole("button", { name: "Add 2 members" })
    )

    await waitFor(() => {
      expect(setWorkspaceResourceAccess).toHaveBeenCalledTimes(2)
    })
    expect(setWorkspaceResourceAccess).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          principal: candidatePerson.unique_id,
        }),
      })
    )
    expect(setWorkspaceResourceAccess).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          principal: secondCandidate.unique_id,
        }),
      })
    )
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
    const grantedGrants: WorkspaceResourceAccessGrant[] = [
      ...initialGrants,
      {
        display_name: "Jamie Patel",
        permission: "viewer",
        principal_id: candidatePerson.unique_id,
        principal_type: "user",
        slug: "jamie.patel",
      },
    ]
    vi.mocked(setWorkspaceResourceAccess)
      .mockResolvedValueOnce(ok(grantedGrants))
      .mockRejectedValueOnce(new Error("network down"))

    renderCard()

    ensureManaging("Manage access")
    fireEvent.click(screen.getByRole("button", { name: "Add member" }))

    const dialog = screen.getByRole("dialog", { name: "Add direct access" })
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
        resourceAccessQueryOptions(scope, instrument.unique_id).queryKey
      )
    ).toEqual(grantedGrants)

    fireEvent.click(within(dialog).getByRole("button", { name: "Add member" }))

    await waitFor(() => {
      expect(setWorkspaceResourceAccess).toHaveBeenCalledTimes(3)
    })
    expect(setWorkspaceResourceAccess).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          principal: secondCandidate.unique_id,
        }),
      })
    )
  })

  it("removes a staged member and resets the list when the kind changes", async () => {
    vi.mocked(getWorkspaceSearch).mockResolvedValue(
      searchResponse([candidatePerson])
    )

    renderCard()

    ensureManaging("Manage access")
    fireEvent.click(screen.getByRole("button", { name: "Add member" }))

    const dialog = screen.getByRole("dialog", { name: "Add direct access" })
    const searchInput = within(dialog).getByRole("combobox", {
      name: "Search people",
    })
    fireEvent.click(searchInput)
    fireEvent.change(searchInput, { target: { value: "jam" } })
    fireEvent.click(await screen.findByRole("option", { name: /Jamie Patel/i }))

    expect(
      within(dialog).getByRole("list", { name: "Members to add" })
    ).toBeTruthy()

    fireEvent.click(
      within(dialog).getByRole("button", { name: "Remove Jamie Patel" })
    )
    expect(screen.queryByRole("list", { name: "Members to add" })).toBeNull()

    fireEvent.change(searchInput, { target: { value: "jam" } })
    fireEvent.click(await screen.findByRole("option", { name: /Jamie Patel/i }))

    const principalSelect =
      within(dialog).getByLabelText<HTMLSelectElement>("Principal type")
    fireEvent.change(principalSelect, { target: { value: "1" } })
    expect(screen.queryByRole("list", { name: "Members to add" })).toBeNull()
  })

  it("hides service accounts from the member search", async () => {
    vi.mocked(getWorkspaceSearch).mockResolvedValue(
      searchResponse([candidatePerson, candidateOperator])
    )

    renderCard()

    ensureManaging("Manage access")
    fireEvent.click(screen.getByRole("button", { name: "Add member" }))

    const dialog = screen.getByRole("dialog", { name: "Add direct access" })
    const searchInput = within(dialog).getByRole("combobox", {
      name: "Search people",
    })
    fireEvent.click(searchInput)
    fireEvent.change(searchInput, { target: { value: "jam" } })

    await screen.findByRole("option", { name: /Jamie Patel/i })

    expect(screen.queryByRole("option", { name: /Robot Operator/i })).toBeNull()
  })

  it("omits the checkbox from non-revocable rows in managing mode", () => {
    renderCard()

    fireEvent.click(screen.getByRole("button", { name: "Manage access" }))

    expect(
      screen.queryByRole("checkbox", {
        name: "Select Morgan Patel for revocation",
      })
    ).toBeNull()
    expect(
      screen.getByRole("checkbox", {
        name: "Select Jordan Reyes for revocation",
      })
    ).toBeTruthy()
  })

  it("revokes multiple selected members through the batch dialog", async () => {
    const [secondGrant] = withEntryCapabilities([
      {
        display_name: "Avery Chen",
        permission: "viewer",
        principal_id: "0000-0000-0000-000X",
        principal_type: "user",
        slug: "avery.chen",
      },
    ])
    queryClient.setQueryData(
      resourceAccessQueryOptions(scope, instrument.unique_id).queryKey,
      [...initialGrants, secondGrant]
    )
    vi.mocked(revokeWorkspaceResourceAccess).mockResolvedValue(
      ok([initialGrants[0]])
    )

    renderCard()

    fireEvent.click(screen.getByRole("button", { name: "Manage access" }))
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "Select Jordan Reyes for revocation",
      })
    )
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Select Avery Chen for revocation" })
    )
    fireEvent.click(
      screen.getByRole("button", { name: "Revoke access for 2 members" })
    )

    const dialog = screen.getByRole("dialog", { name: "Revoke access?" })
    expect(within(dialog).getByText("Jordan Reyes")).toBeTruthy()
    expect(within(dialog).getByText("Avery Chen")).toBeTruthy()
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "Revoke access for 2 members",
      })
    )

    await waitFor(() =>
      expect(revokeWorkspaceResourceAccess).toHaveBeenCalledTimes(2)
    )
    expect(revokeWorkspaceResourceAccess).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          principal: "0000-0000-0000-0034",
        }),
      })
    )
    expect(revokeWorkspaceResourceAccess).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          principal: "0000-0000-0000-000X",
        }),
      })
    )
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  })

  it("unassigns an operator via confirmation dialog", async () => {
    vi.mocked(removeWorkspaceInstrumentOperator).mockResolvedValue(ok([]))

    renderCard()

    fireEvent.click(screen.getByRole("button", { name: "Manage access" }))

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

    ensureManaging("Manage access")
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

    ensureManaging("Manage access")
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
