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
import { instrumentOperatorsQueryOptions } from "@/data/crucible/instruments.queries"
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
  first_name: "Fabrice",
  is_service_account: false,
  last_name: "Roncoroni",
  unique_id: "0000-0001-6402-3752",
  username: "roncofaber",
}

const instrument = {
  capabilities: {
    can_change_status: true,
    can_edit: true,
    can_manage_access: true,
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

const initialGrants: WorkspaceResourceAccessGrant[] = [
  {
    display_name: "Fabrice Roncoroni",
    permission: "owner",
    principal_id: owner.unique_id,
    principal_type: "user",
    slug: owner.username,
  },
  {
    display_name: "Tim Kodalle",
    permission: "editor",
    principal_id: "0000-0002-8792-9669",
    principal_type: "user",
    slug: "timkodalle",
  },
]

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

    expect(screen.getByText("Fabrice Roncoroni")).toBeTruthy()
    expect(screen.getByText("Manager")).toBeTruthy()

    expect(screen.getByText("Tim Kodalle")).toBeTruthy()
    expect(screen.getByText("Editor")).toBeTruthy()

    expect(screen.getByText("Beamline Collector")).toBeTruthy()
    expect(screen.getByText("Operator")).toBeTruthy()
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

    const roleSelect = screen.getByLabelText<HTMLSelectElement>(
      "Role for Tim Kodalle"
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
            principal: "0000-0002-8792-9669",
            resourceMfid: instrument.unique_id,
          }),
        })
      )
    })
  })

  it("revokes a member via confirmation dialog", async () => {
    const remainingGrants: WorkspaceResourceAccessGrant[] = [initialGrants[0]]
    vi.mocked(revokeWorkspaceResourceAccess).mockResolvedValue(
      ok(remainingGrants)
    )

    renderCard()

    fireEvent.click(screen.getByRole("button", { name: "Manage access" }))

    const revokeButton = screen.getByLabelText("Revoke access for Tim Kodalle")
    fireEvent.click(revokeButton)

    expect(screen.getByText("Revoke access?")).toBeTruthy()
    const confirmButton = screen.getByRole("button", { name: "Revoke access" })
    fireEvent.click(confirmButton)

    await waitFor(() => {
      expect(revokeWorkspaceResourceAccess).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            kind: "users",
            principal: "0000-0002-8792-9669",
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

    const dialogAddButton = within(dialog).getByRole("button", {
      name: "Add member",
    })
    fireEvent.click(dialogAddButton)

    await waitFor(() => {
      expect(setWorkspaceResourceAccess).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            kind: "users",
            permission: "viewer",
            principal: candidatePerson.unique_id,
            resourceMfid: instrument.unique_id,
          }),
        })
      )
    })
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
})
