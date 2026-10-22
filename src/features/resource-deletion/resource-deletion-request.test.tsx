import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { identityScope } from "@/data/crucible/query-keys"
import type {
  WorkspaceDeletionRequest,
  WorkspaceResourceDetail,
} from "@/data/crucible/workspace-source"

import {
  ResourceDeletionRequestCard,
  canShowResourceDeletionRequest,
} from "./resource-deletion-request"

vi.mock("@/data/crucible/resources.functions", () => ({
  createWorkspaceResourceDeletionRequest: vi.fn(),
}))

const scope = identityScope("crucible-fixture:populated", "account")

function sample(
  canRequestDeletion: boolean,
  deletionRequest: WorkspaceDeletionRequest | null = null
) {
  return {
    capabilities: {
      can_change_status: false,
      can_delete: false,
      can_edit: false,
      can_manage_access: false,
      can_view_access: true,
      can_request_deletion: canRequestDeletion,
      can_transfer: false,
      max_grant_role: null,
    },
    creation_time: null,
    deletion_request: deletionRequest,
    description: null,
    kind: "sample",
    links: [],
    modification_time: null,
    name: "NiFe oxide catalyst A",
    owner: null,
    project: null,
    project_id: null,
    public: true,
    sample_type: null,
    scientific_metadata: null,
    timestamp: null,
    unique_id: "sample-mfid",
  } as Extract<WorkspaceResourceDetail, { kind: "sample" }>
}

function renderCard(
  resource: Extract<WorkspaceResourceDetail, { kind: "sample" }>
) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ResourceDeletionRequestCard
        mode="fixture"
        presentation="row"
        resource={resource}
        scope={scope}
      />
    </QueryClientProvider>
  )
}

describe("ResourceDeletionRequestCard", () => {
  afterEach(cleanup)

  it("hides deletion requests from people who cannot request one", () => {
    expect(canShowResourceDeletionRequest(sample(false))).toBe(false)
    renderCard(sample(false))

    expect(
      screen.queryByRole("button", { name: /Request deletion/ })
    ).toBeNull()
  })

  it("offers deletion requests when the API allows them", () => {
    expect(canShowResourceDeletionRequest(sample(true))).toBe(true)
    renderCard(sample(true))

    expect(
      screen.getByRole("button", {
        name: "Request deletion of NiFe oxide catalyst A",
      })
    ).toBeTruthy()
  })

  it("keeps showing a pending request even though a new one is not allowed", () => {
    const pending = sample(false, {
      status: "pending",
    } as WorkspaceDeletionRequest)

    expect(canShowResourceDeletionRequest(pending)).toBe(true)
  })
})
