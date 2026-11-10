import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ProjectCreationForm } from "./project-creation-form"
import { WorkspaceProvider } from "@/components/crucible/workspace-provider"
import { accountQueryOptions } from "@/data/crucible/account.queries"
import { createWorkspaceProject } from "@/data/crucible/creation.functions"
import type { WorkspacePrivilegeMode } from "@/data/crucible/privilege-mode"
import { identityScope } from "@/data/crucible/query-keys"
import type { WorkspaceAccount } from "@/data/crucible/workspace-source"

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useBlocker: () => ({ proceed: vi.fn(), reset: vi.fn(), status: "idle" }),
  useNavigate: () => vi.fn(),
}))

vi.mock("@/data/crucible/creation.functions", () => ({
  createWorkspaceProject: vi.fn(),
}))

vi.mock("@/features/forms/slug-availability", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useSlugAvailability: () => ({ status: "available" }),
}))

const scope = identityScope("server-1", "0000-0000-0000-000X")

const account = {
  authorization: {
    can_elevate: true,
    effective_privilege_mode: "normal",
    platform_role: "admin",
  },
  capabilities: {
    can_create_dataset: true,
    can_create_for_others: false,
    can_create_project: true,
    can_create_sample: true,
    can_manage_service_accounts: false,
    can_register_instrument: true,
  },
  email: null,
  first_name: "Avery",
  last_name: "Chen",
  unique_id: "0000-0000-0000-000X",
  username: "avery.chen",
} as unknown as WorkspaceAccount

function renderForm(privilegeMode: WorkspacePrivilegeMode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  queryClient.setQueryData(accountQueryOptions(scope).queryKey, account)
  render(
    <QueryClientProvider client={queryClient}>
      <WorkspaceProvider mode="api" privilegeMode={privilegeMode} scope={scope}>
        <ProjectCreationForm scope={scope} />
      </WorkspaceProvider>
    </QueryClientProvider>
  )
}

describe("ProjectCreationForm lead", () => {
  afterEach(cleanup)

  it("makes you the lead outside Administrator view", () => {
    renderForm("normal")

    expect(screen.getByText("Project lead")).toBeTruthy()
    expect(screen.getByText("Avery Chen")).toBeTruthy()
    expect(document.getElementById("project_lead")).toBeNull()
  })

  it("lets an administrator in Administrator view choose the lead", () => {
    renderForm("elevated")

    expect(document.getElementById("project_lead")).not.toBeNull()
  })

  it("explains a refused lead", async () => {
    const { HubApiClientError } = await import("@/data/crucible/result")
    vi.mocked(createWorkspaceProject).mockRejectedValue(
      new HubApiClientError({
        conflictCode: "lead_must_be_caller",
        correlationId: "c-1",
        kind: "forbidden",
        message: "You do not have permission to perform this action.",
        retryable: false,
      })
    )
    renderForm("normal")

    fireEvent.change(screen.getByLabelText(/Title/), {
      target: { value: "Operando study" },
    })
    fireEvent.change(screen.getByLabelText(/Organization/), {
      target: { value: "Molecular Foundry" },
    })
    fireEvent.change(screen.getByLabelText(/Project ID/), {
      target: { value: "operando-study" },
    })
    fireEvent.submit(screen.getByLabelText(/Title/).closest("form")!)

    await waitFor(() =>
      expect(
        screen.getByText(
          "Only an administrator in Administrator view can make someone else the lead. Create the project with yourself as lead, then transfer it from the project's Manage tab."
        )
      ).toBeTruthy()
    )
  })
})
