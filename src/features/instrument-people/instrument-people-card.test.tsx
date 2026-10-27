import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { instrumentMembersQueryOptions } from "@/data/crucible/instruments.queries"
import { identityScope } from "@/data/crucible/query-keys"
import type { WorkspaceResourceAccessGrant } from "@/data/crucible/workspace-source"

import { InstrumentPeopleCard } from "./instrument-people-card"

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  Link: ({ children }: { children: React.ReactNode }) => (
    <a href="#test">{children}</a>
  ),
}))
vi.mock("@/data/crucible/instruments.functions", () => ({
  getWorkspaceInstrumentMembers: vi.fn(),
  getWorkspaceInstrumentOperators: vi.fn(),
}))

afterEach(cleanup)

const scope = identityScope("crucible-fixture:populated", "account")
const instrumentMfid = "01J6Y8N4Q2R7M9K3T5V0W1X2Z4"

const members: WorkspaceResourceAccessGrant[] = [
  {
    display_name: "Jordan Reyes",
    permission: "editor",
    principal_id: "0000-0000-0000-0034",
    principal_type: "user",
    slug: "jreyes",
  },
  {
    display_name: "Avery Chen",
    permission: "owner",
    principal_id: "0000-0000-0000-0001",
    principal_type: "user",
    slug: "avery.chen",
  },
  {
    display_name: "Operando Catalyst Mapping",
    permission: "viewer",
    principal_id: "01J6Y8N4Q2R7M9K3T5V0W1X2Z3",
    principal_type: "project",
    slug: "operando-catalyst-mapping",
  },
]

function renderCard(
  canManageAccess: boolean,
  data: readonly WorkspaceResourceAccessGrant[] | null = members
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  queryClient.setQueryData(
    instrumentMembersQueryOptions(scope, instrumentMfid).queryKey,
    data
  )
  return render(
    <QueryClientProvider client={queryClient}>
      <InstrumentPeopleCard
        canManageAccess={canManageAccess}
        instrumentMfid={instrumentMfid}
        scope={scope}
      />
    </QueryClientProvider>
  )
}

describe("InstrumentPeopleCard", () => {
  it("lists people and projects with the manager first", () => {
    renderCard(false)
    expect(screen.getByText("People")).toBeTruthy()
    const names = screen
      .getAllByRole("listitem")
      .map((item) => item.textContent)
    expect(names[0]).toContain("Avery Chen")
    expect(names[0]).toContain("Manager")
    expect(names.some((name) => name.includes("Jordan Reyes"))).toBe(true)
    expect(
      names.some((name) => name.includes("Operando Catalyst Mapping"))
    ).toBe(true)
    expect(screen.queryByText("Manage members")).toBeNull()
  })

  it("links to Manage for people who can manage access", () => {
    renderCard(true)
    expect(screen.getByText("Manage members")).toBeTruthy()
  })

  it("says when membership is not visible", () => {
    renderCard(false, null)
    expect(
      screen.getByText("Detailed membership is not available.")
    ).toBeTruthy()
  })
})
