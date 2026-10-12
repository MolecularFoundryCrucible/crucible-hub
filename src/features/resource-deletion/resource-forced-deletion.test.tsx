import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { identityScope } from "@/data/crucible/query-keys"
import { HubApiClientError } from "@/data/crucible/result"
import {
  confirmWorkspaceResourceDeletion,
  previewWorkspaceResourceDeletion,
} from "@/data/crucible/resources.functions"
import type { HubResult } from "@/data/crucible/result"
import type {
  WorkspaceDeletionPreview,
  WorkspaceResourceDetail,
} from "@/data/crucible/workspace-source"

import { ResourceForcedDeletionCard } from "./resource-forced-deletion"

vi.mock("@/data/crucible/resources.functions", () => ({
  confirmWorkspaceResourceDeletion: vi.fn(),
  previewWorkspaceResourceDeletion: vi.fn(),
}))

const scope = identityScope("crucible-fixture:populated", "account")

const project: Extract<WorkspaceResourceDetail, { kind: "project" }> = {
  capabilities: {
    can_change_status: false,
    can_delete: true,
    can_edit: false,
    can_manage_access: false,
    can_transfer: false,
    max_grant_role: null,
  },
  creation_time: "2026-06-12T18:30:00Z",
  kind: "project",
  modification_time: "2026-08-30T21:14:00Z",
  name: "Catalyst mapping",
  organization: "Example National Laboratory",
  owner: null,
  project_id: "catalyst-mapping",
  scientific_metadata: null,
  status: "active",
  unique_id: "project-mfid",
}

function preview(overrides: Partial<WorkspaceDeletionPreview> = {}) {
  return {
    blocking: {},
    deleted: false,
    join_requests_removed: 0,
    memberships_removed: 2,
    removed_grants: [],
    resource_mfid: "project-mfid",
    resource_type: "project" as const,
    service_accounts_unbound: 0,
    ...overrides,
  }
}

function ok(data: unknown): HubResult<unknown> {
  return { data, status: "ok" }
}

function renderCard(
  props: Partial<React.ComponentProps<typeof ResourceForcedDeletionCard>> = {}
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <QueryClientProvider client={queryClient}>
      <ResourceForcedDeletionCard resource={project} scope={scope} {...props} />
    </QueryClientProvider>
  )
  return queryClient
}

describe("ResourceForcedDeletionCard", () => {
  afterEach(cleanup)

  beforeEach(() => {
    vi.mocked(previewWorkspaceResourceDeletion).mockReset()
    vi.mocked(confirmWorkspaceResourceDeletion).mockReset()
  })

  it("renders nothing without the can_delete capability", () => {
    renderCard({
      resource: {
        ...project,
        capabilities: {
          can_change_status: false,
          can_delete: false,
          can_edit: false,
          can_manage_access: false,
          can_transfer: false,
          max_grant_role: null,
        },
      },
    })
    expect(screen.queryByRole("button", { name: /delete/i })).toBeNull()
  })

  it("previews removals and requires explicit confirmation", async () => {
    vi.mocked(previewWorkspaceResourceDeletion).mockResolvedValue(
      ok(preview()) as never
    )
    vi.mocked(confirmWorkspaceResourceDeletion).mockResolvedValue(
      ok(preview({ deleted: true })) as never
    )
    const onSuccess = vi.fn()
    renderCard({ onSuccess })

    fireEvent.click(
      screen.getByRole("button", { name: /delete.*permanently/i })
    )

    await waitFor(() =>
      expect(previewWorkspaceResourceDeletion).toHaveBeenCalledWith({
        data: {
          confirm: false,
          privilegeMode: "normal",
          resourceMfid: "project-mfid",
          scenario: "populated",
        },
      })
    )
    expect(await screen.findByText("2 members unlinked")).toBeTruthy()

    const confirmButton = screen.getByRole("button", {
      name: /confirm deletion/i,
    })
    expect(confirmButton.hasAttribute("disabled")).toBe(true)

    const confirmationInput = screen.getByLabelText(/Type DELETE to confirm/i)
    fireEvent.change(confirmationInput, { target: { value: "delete" } })
    expect(confirmButton.hasAttribute("disabled")).toBe(true)

    fireEvent.change(confirmationInput, { target: { value: "DELETE" } })
    expect(confirmButton.hasAttribute("disabled")).toBe(false)

    fireEvent.click(confirmButton)

    await waitFor(() =>
      expect(confirmWorkspaceResourceDeletion).toHaveBeenCalledWith({
        data: {
          confirm: true,
          privilegeMode: "normal",
          resourceMfid: "project-mfid",
          scenario: "populated",
        },
      })
    )
    await waitFor(() => expect(onSuccess).toHaveBeenCalled())
  })

  it("blocks confirmation while assigned datasets or samples remain", async () => {
    vi.mocked(previewWorkspaceResourceDeletion).mockResolvedValue(
      ok(preview({ blocking: { datasets: 2, samples: 1 } })) as never
    )
    renderCard()

    fireEvent.click(
      screen.getByRole("button", { name: /delete.*permanently/i })
    )

    expect(
      await screen.findByText(
        /2 datasets still assigned, 1 sample still assigned/
      )
    ).toBeTruthy()
    const confirmButton = screen.getByRole("button", {
      name: /confirm deletion/i,
    })
    const confirmationInput = screen.getByLabelText(/Type DELETE to confirm/i)
    fireEvent.change(confirmationInput, { target: { value: "DELETE" } })
    expect(confirmButton.hasAttribute("disabled")).toBe(true)
    expect(confirmWorkspaceResourceDeletion).not.toHaveBeenCalled()
  })

  it("surfaces the empty-requirement failure when confirmation races", async () => {
    vi.mocked(previewWorkspaceResourceDeletion).mockResolvedValue(
      ok(preview()) as never
    )
    vi.mocked(confirmWorkspaceResourceDeletion).mockRejectedValue(
      new HubApiClientError({
        correlationId: "test",
        kind: "conflict",
        message: "The resource is not empty.",
        retryable: false,
      })
    )
    renderCard()

    fireEvent.click(
      screen.getByRole("button", { name: /delete.*permanently/i })
    )
    fireEvent.change(await screen.findByLabelText(/Type DELETE to confirm/i), {
      target: { value: "DELETE" },
    })
    fireEvent.click(
      await screen.findByRole("button", { name: /confirm deletion/i })
    )

    expect(
      await screen.findByText(
        /this resource is not empty, so it cannot be deleted/i
      )
    ).toBeTruthy()
  })

  it("opens only after the preview resolves and keeps the button geometry", async () => {
    let resolvePreview: (
      value: HubResult<WorkspaceDeletionPreview>
    ) => void = () => {}
    vi.mocked(previewWorkspaceResourceDeletion).mockImplementation(
      () =>
        new Promise<HubResult<WorkspaceDeletionPreview>>((resolve) => {
          resolvePreview = resolve
        })
    )
    renderCard()

    const deleteButton = screen.getByRole("button", {
      name: /delete.*permanently/i,
    })
    fireEvent.click(deleteButton)

    expect(screen.queryByRole("dialog")).toBeNull()
    expect(
      screen
        .getByRole("button", { name: /delete.*permanently/i })
        .hasAttribute("disabled")
    ).toBe(true)

    await waitFor(() => {
      expect(previewWorkspaceResourceDeletion).toHaveBeenCalledTimes(1)
    })

    resolvePreview(ok(preview()) as never)

    expect(await screen.findByText("2 members unlinked")).toBeTruthy()
    expect(
      screen.queryByText(/Reviewing what this deletion removes/i)
    ).toBeNull()
  })

  it("opens the dialog in the error state when the preview fails", async () => {
    vi.mocked(previewWorkspaceResourceDeletion).mockRejectedValue(
      new HubApiClientError({
        correlationId: "test",
        kind: "upstream",
        message: "The review service is unavailable.",
        retryable: true,
      })
    )
    renderCard()

    fireEvent.click(
      screen.getByRole("button", { name: /delete.*permanently/i })
    )

    expect(await screen.findByRole("dialog")).toBeTruthy()
    expect(
      await screen.findByText(/could not review this deletion/i)
    ).toBeTruthy()
    expect(screen.queryByText("2 members unlinked")).toBeNull()
    expect(
      screen
        .getByRole("button", { name: /confirm deletion/i })
        .hasAttribute("disabled")
    ).toBe(true)
  })
})
