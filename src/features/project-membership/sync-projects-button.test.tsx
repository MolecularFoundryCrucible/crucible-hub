import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { WorkspaceProvider } from "@/components/crucible/workspace-provider"
import { allFeaturesEnabled } from "@/data/crucible/features"
import { identityScope } from "@/data/crucible/query-keys"

import { SyncProjectsButton, projectSyncSummary } from "./sync-projects-button"

vi.mock("@/data/crucible/account.functions", () => ({
  syncWorkspaceAccountProjectsFn: vi.fn(),
}))

const scope = identityScope("server-1", "person-1")

function renderButton(proposalSync: boolean) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <WorkspaceProvider
        features={{ ...allFeaturesEnabled, proposal_sync: proposalSync }}
        mode="api"
        scope={scope}
      >
        <SyncProjectsButton scope={scope} />
      </WorkspaceProvider>
    </QueryClientProvider>
  )
}

describe("SyncProjectsButton", () => {
  afterEach(cleanup)

  it("offers Sync from proposals when the server has it", () => {
    renderButton(true)

    expect(
      screen.getByRole("button", { name: /Sync from proposals/ })
    ).toBeTruthy()
  })

  it("is hidden when proposal sync is switched off", () => {
    renderButton(false)

    expect(
      screen.queryByRole("button", { name: /Sync from proposals/ })
    ).toBeNull()
  })
})

const base = {
  orcid: "0000-0002-1825-0097",
  projectsAdded: [],
  projectsAlreadyMember: [],
  projectsNotFound: [],
}

describe("projectSyncSummary", () => {
  it("names the projects it added and counts proposals without one", () => {
    expect(
      projectSyncSummary({
        ...base,
        projectsAdded: ["10234", "10301"],
        projectsNotFound: ["9999"],
      })
    ).toEqual({
      title: "Added to 2 projects",
      description: "10234, 10301. 1 proposal has no Crucible project yet.",
    })
  })

  it("says when nothing new turned up", () => {
    expect(
      projectSyncSummary({ ...base, projectsAlreadyMember: ["10234"] })
    ).toEqual({
      title: "No new projects",
      description: "You're already in every project from your proposals.",
    })
  })

  it("asks for an ORCID when the account has none", () => {
    expect(projectSyncSummary({ ...base, orcid: null }).title).toBe(
      "No ORCID to look up"
    )
  })
})
