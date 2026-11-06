import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  AccountSignInMethodsCard,
  addableSignInMethods,
} from "./account-sign-in-methods-card"
import type { AccountLinkOutcome } from "./account-sign-in-methods-card"
import {
  confirmWorkspaceAccountLinkFn,
  getPendingWorkspaceAccountLink,
  getWorkspaceAccountIdentities,
  startWorkspaceAccountLinkFn,
} from "@/data/crucible/account-identities.functions"
import { identityScope } from "@/data/crucible/query-keys"
import { getHubSignInOptions } from "@/data/crucible/session.functions"
import type { WorkspaceAccountIdentity } from "@/data/crucible/workspace-source"

vi.mock("@/data/crucible/account-identities.functions", () => ({
  cancelWorkspaceAccountLinkFn: vi.fn(async () => ({ status: "ok" })),
  confirmWorkspaceAccountLinkFn: vi.fn(),
  getPendingWorkspaceAccountLink: vi.fn(),
  getWorkspaceAccountIdentities: vi.fn(),
  removeWorkspaceAccountIdentityFn: vi.fn(),
  startWorkspaceAccountLinkFn: vi.fn(),
}))
vi.mock("@/data/crucible/session.functions", () => ({
  getHubSignInOptions: vi.fn(),
}))
vi.mock("@/components/crucible/notifications", () => ({
  notifyError: vi.fn(),
  notifySuccess: vi.fn(),
}))

const orcidLogin: WorkspaceAccountIdentity = {
  created_at: "2026-10-01T00:00:00Z",
  id: 1,
  label: null,
  last_used_at: "2026-10-05T00:00:00Z",
  orcid: "0000-0002-1825-0097",
  provider_key: "orcid",
  provider_name: "ORCID",
  verified_at: "2026-10-01T00:00:00Z",
}

const labLogin: WorkspaceAccountIdentity = {
  created_at: "2026-10-02T00:00:00Z",
  id: 2,
  label: "a.chen@lab.example",
  last_used_at: null,
  orcid: null,
  provider_key: "lbl",
  provider_name: "Berkeley Lab",
  verified_at: null,
}

const orcidMethod = { display_name: "ORCID", is_orcid: true, key: "orcid" }
const labMethod = { display_name: "Berkeley Lab", is_orcid: false, key: "lbl" }

const ok = <T,>(data: T) => ({ status: "ok" as const, data })
const failure = (kind: string, conflictCode?: string) => ({
  status: "error" as const,
  error: {
    correlationId: "test",
    kind,
    message: "Failed.",
    retryable: false,
    ...(conflictCode ? { conflictCode } : {}),
  },
})

function renderCard(linkOutcome?: AccountLinkOutcome) {
  const onLinkOutcomeHandled = vi.fn()
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <AccountSignInMethodsCard
        linkOutcome={linkOutcome}
        onLinkOutcomeHandled={onLinkOutcomeHandled}
        scope={identityScope("server-1", "person-1")}
      />
    </QueryClientProvider>
  )
  return { onLinkOutcomeHandled }
}

describe("addableSignInMethods", () => {
  it("offers only providers the person has not linked, and no second ORCID", () => {
    expect(
      addableSignInMethods([orcidMethod, labMethod], [orcidLogin])
    ).toEqual([labMethod])
    expect(
      addableSignInMethods(
        [orcidMethod],
        [{ ...orcidLogin, provider_key: null }]
      )
    ).toEqual([])
    expect(addableSignInMethods(null, [orcidLogin])).toEqual([])
  })
})

describe("AccountSignInMethodsCard", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getHubSignInOptions).mockResolvedValue({
      methods: [orcidMethod, labMethod],
      origin: null,
    })
  })
  afterEach(cleanup)

  it("lists each login and keeps the only one from being removed", async () => {
    vi.mocked(getWorkspaceAccountIdentities).mockResolvedValue(ok([orcidLogin]))
    renderCard()

    expect(await screen.findByText("ORCID")).toBeTruthy()
    expect(
      screen.getByRole("link", { name: "0000-0002-1825-0097, verified" })
    ).toBeTruthy()
    expect(
      screen.getByRole("button", { name: "Remove" }).hasAttribute("disabled")
    ).toBe(true)
    expect(
      await screen.findByRole("button", { name: "Add Berkeley Lab" })
    ).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Add ORCID" })).toBeNull()
  })

  it("warns before removing a login", async () => {
    vi.mocked(getWorkspaceAccountIdentities).mockResolvedValue(
      ok([orcidLogin, labLogin])
    )
    renderCard()

    const remove = await screen.findAllByRole("button", { name: "Remove" })
    fireEvent.click(remove[1])
    expect(
      await screen.findByText(/creates a new, separate Crucible account/)
    ).toBeTruthy()
    expect(
      screen.getByText("Remove Berkeley Lab (a.chen@lab.example)?")
    ).toBeTruthy()
  })

  it("sends the browser to the provider when adding a login", async () => {
    vi.mocked(getWorkspaceAccountIdentities).mockResolvedValue(ok([orcidLogin]))
    vi.mocked(startWorkspaceAccountLinkFn).mockResolvedValue(
      ok({
        authorizationUrl: "https://api.example.test/auth/hub/link/start?x=1",
      })
    )
    const assign = vi.fn()
    vi.stubGlobal("location", { ...window.location, assign })
    renderCard()

    fireEvent.click(
      await screen.findByRole("button", { name: "Add Berkeley Lab" })
    )
    await waitFor(() =>
      expect(assign).toHaveBeenCalledWith(
        "https://api.example.test/auth/hub/link/start?x=1"
      )
    )
    expect(vi.mocked(startWorkspaceAccountLinkFn)).toHaveBeenCalledWith({
      data: { providerKey: "lbl" },
    })
    vi.unstubAllGlobals()
  })

  it("asks for a recent sign-in when adding a login needs one", async () => {
    vi.mocked(getWorkspaceAccountIdentities).mockResolvedValue(ok([orcidLogin]))
    vi.mocked(startWorkspaceAccountLinkFn).mockResolvedValue(
      failure("reauthentication-required") as never
    )
    renderCard()

    fireEvent.click(
      await screen.findByRole("button", { name: "Add Berkeley Lab" })
    )
    expect(
      await screen.findByText(/Adding a sign-in method needs a recent sign-in/)
    ).toBeTruthy()
  })

  it("hides itself while the API has sign-in methods turned off", async () => {
    vi.mocked(getWorkspaceAccountIdentities).mockResolvedValue(
      failure("conflict", "identity_lookup_off") as never
    )
    renderCard()

    await waitFor(() =>
      expect(vi.mocked(getWorkspaceAccountIdentities)).toHaveBeenCalled()
    )
    await waitFor(() =>
      expect(screen.queryByText("Sign-in methods")).toBeNull()
    )
  })

  it("confirms an available login and returns to the list", async () => {
    vi.mocked(getWorkspaceAccountIdentities).mockResolvedValue(ok([orcidLogin]))
    vi.mocked(getPendingWorkspaceAccountLink).mockResolvedValue(
      ok({
        label: "a.chen@lab.example",
        orcid: null,
        providerName: "Berkeley Lab",
        status: "available",
      }) as never
    )
    vi.mocked(confirmWorkspaceAccountLinkFn).mockResolvedValue(ok(undefined))
    const { onLinkOutcomeHandled } = renderCard("pending")

    expect(
      await screen.findByText(
        "Add Berkeley Lab (a.chen@lab.example) as a way to sign in to your Crucible account?"
      )
    ).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Add sign-in method" }))
    await waitFor(() => expect(onLinkOutcomeHandled).toHaveBeenCalled())
    expect(vi.mocked(confirmWorkspaceAccountLinkFn)).toHaveBeenCalledTimes(1)
  })

  it.each([
    ["linked_elsewhere", /already belongs to another Crucible account/],
    ["second_orcid", /already has an ORCID/],
    ["orcid_of_another", /ask an administrator/],
    ["unknown", /can't be added to your account/],
  ] as const)(
    "explains a %s login without offering to confirm",
    async (status, message) => {
      vi.mocked(getWorkspaceAccountIdentities).mockResolvedValue(
        ok([orcidLogin])
      )
      vi.mocked(getPendingWorkspaceAccountLink).mockResolvedValue(
        ok({
          label: null,
          orcid: "0000-0002-1825-0097",
          providerName: "ORCID",
          status,
        })
      )
      renderCard("pending")

      expect(await screen.findByText(message)).toBeTruthy()
      expect(
        screen.queryByRole("button", { name: "Add sign-in method" })
      ).toBeNull()
    }
  )

  it("reports a link that did not finish and clears the outcome", async () => {
    vi.mocked(getWorkspaceAccountIdentities).mockResolvedValue(ok([orcidLogin]))
    const { notifyError } = await import("@/components/crucible/notifications")
    const { onLinkOutcomeHandled } = renderCard("retry")

    await waitFor(() => expect(onLinkOutcomeHandled).toHaveBeenCalled())
    expect(vi.mocked(notifyError)).toHaveBeenCalledWith(
      "Sign-in method not added",
      expect.stringContaining("didn't ask you to sign in again")
    )
  })
})
