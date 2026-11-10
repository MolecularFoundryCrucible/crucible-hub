import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  RotateServiceAccountKeyAction,
  ServiceAccountProfileCard,
} from "./service-account-detail"
import { ServiceAccountSecurityCard } from "@/features/account-profile/security-card"
import { getWorkspaceApiKeys } from "@/data/crucible/api-keys.functions"
import { identityScope } from "@/data/crucible/query-keys"
import type { WorkspaceServiceAccountDetail } from "@/data/crucible/workspace-source"

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
  getRouteApi: () => ({
    useLoaderData: () => ({ sessionAuth: true, status: "ready" }),
  }),
  useBlocker: () => ({ proceed: vi.fn(), reset: vi.fn(), status: "idle" }),
}))

vi.mock("@/data/crucible/api-keys.functions", () => ({
  createWorkspaceApiKeyFn: vi.fn(),
  getWorkspaceApiKeys: vi.fn(async () => ({
    data: { items: [], nextCursor: null, total: 2 },
    status: "ok",
  })),
  renameWorkspaceApiKeyFn: vi.fn(),
  revokeWorkspaceApiKeyFn: vi.fn(),
}))

vi.mock("@/data/crucible/auth-events.functions", () => ({
  getWorkspaceAuthEvents: vi.fn(async () => ({
    data: { items: [], nextCursor: null, total: 0 },
    status: "ok",
  })),
}))

const scope = identityScope("server-1", "admin-1", "elevated")

const serviceAccount: WorkspaceServiceAccountDetail = {
  api_key_status: null,
  email: null,
  first_name: "Beamline",
  is_service_account: true,
  last_active_at: null,
  last_name: "Uploader",
  platform_role: "contributor",
  unique_id: "sa-1",
  username: "beamline-uploader",
}

function wrap(children: React.ReactNode) {
  return (
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      {children}
    </QueryClientProvider>
  )
}

describe("service account page", () => {
  afterEach(cleanup)

  it("shows the same profile fields as a person", () => {
    render(
      wrap(
        <ServiceAccountProfileCard
          account={serviceAccount}
          canChangePlatformRole
          mode="api"
          scope={scope}
        />
      )
    )

    expect(screen.getByText("Profile")).toBeTruthy()
    expect(screen.getByText("Beamline Uploader")).toBeTruthy()
    expect(screen.getByText("beamline-uploader")).toBeTruthy()
    expect(screen.getByText("Platform role")).toBeTruthy()
    expect(screen.getByText("Last active")).toBeTruthy()
    expect(screen.getByText("Crucible ID")).toBeTruthy()
  })

  it("opens Security on API keys with only keys and history", async () => {
    render(
      wrap(
        <ServiceAccountSecurityCard
          name="Beamline Uploader"
          rotateAction={
            <RotateServiceAccountKeyAction
              account={serviceAccount}
              scope={scope}
            />
          }
          scope={scope}
          userId="sa-1"
        />
      )
    )

    const keysTab = screen.getByRole("tab", { name: /API keys/ })
    expect(keysTab.getAttribute("aria-selected")).toBe("true")
    expect(screen.getByRole("tab", { name: /Sign-in history/ })).toBeTruthy()
    expect(screen.queryByRole("tab", { name: /Sign-in methods/ })).toBeNull()
    expect(screen.queryByRole("tab", { name: /Sessions/ })).toBeNull()
    expect(screen.getByRole("button", { name: /Rotate key/ })).toBeTruthy()
    await waitFor(() => expect(keysTab.textContent).toContain("2"))
    expect(vi.mocked(getWorkspaceApiKeys)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: "sa-1" }),
      })
    )
  })
})
