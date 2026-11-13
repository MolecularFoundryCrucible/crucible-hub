import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { instrumentMembersQueryOptions } from "@/data/crucible/instruments.queries"
import { identityScope } from "@/data/crucible/query-keys"
import type { WorkspaceInstrumentMember } from "@/data/crucible/workspace-source"

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

const members: WorkspaceInstrumentMember[] = [
  {
    first_name: "Jordan",
    is_service_account: false,
    last_name: "Reyes",
    role: "editor",
    unique_id: "0000-0000-0000-0034",
    username: "jreyes",
  },
  {
    first_name: "Avery",
    is_service_account: false,
    last_name: "Chen",
    role: "owner",
    unique_id: "0000-0000-0000-0001",
    username: "avery.chen",
  },
]

function renderCard(
  canManageAccess: boolean,
  data: WorkspaceInstrumentMember[] | null = members
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
  it("lists people with the manager first", () => {
    renderCard(false)
    expect(screen.getByText("People")).toBeTruthy()
    const names = screen
      .getAllByRole("listitem")
      .map((item) => item.textContent)
    expect(names[0]).toContain("Avery Chen")
    expect(names[0]).toContain("Manager")
    expect(names[1]).toContain("Jordan Reyes")
    expect(names[1]).toContain("Editor")
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
