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

import {
  AccountSignInMethodsSection,
  PersonSignInMethodsSection,
  addableSignInMethods,
} from "./account-sign-in-methods-card"
import type { AccountLinkOutcome } from "./account-sign-in-methods-card"
import {
  cancelWorkspaceAccountLinkFn,
  confirmWorkspaceAccountLinkFn,
  getPendingWorkspaceAccountLink,
  getWorkspaceAccountIdentities,
  getWorkspaceUserIdentities,
  startWorkspaceAccountLinkFn,
} from "@/data/crucible/account-identities.functions"
import { getWorkspaceAccount } from "@/data/crucible/account.functions"
import {
  issueWorkspaceUserPasswordLinkFn,
  setWorkspaceAccountPasswordFn,
} from "@/data/crucible/passwords.functions"
import { WorkspaceProvider } from "@/components/crucible/workspace-provider"
import { allFeaturesEnabled } from "@/data/crucible/features"
import { identityScope } from "@/data/crucible/query-keys"
import { getHubSignInOptions } from "@/data/crucible/session.functions"
import type { WorkspaceAccountIdentity } from "@/data/crucible/workspace-source"

vi.mock("@/data/crucible/account-identities.functions", () => ({
  cancelWorkspaceAccountLinkFn: vi.fn(async () => ({ status: "ok" })),
  confirmWorkspaceAccountLinkFn: vi.fn(),
  getPendingWorkspaceAccountLink: vi.fn(),
  getWorkspaceAccountIdentities: vi.fn(),
  getWorkspaceUserIdentities: vi.fn(),
  removeWorkspaceAccountIdentityFn: vi.fn(),
  removeWorkspaceUserIdentityFn: vi.fn(),
  startWorkspaceAccountLinkFn: vi.fn(),
}))
vi.mock("@/data/crucible/account.functions", () => ({
  getWorkspaceAccount: vi.fn(),
}))
vi.mock("@/data/crucible/passwords.functions", () => ({
  issueWorkspaceUserPasswordLinkFn: vi.fn(),
  removeWorkspaceUserPasswordFn: vi.fn(),
  setWorkspaceAccountPasswordFn: vi.fn(),
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

const orcidMethod = {
  display_name: "ORCID",
  is_orcid: true,
  key: "orcid",
  kind: "oidc" as const,
  registration_url: null,
}
const labMethod = {
  ...orcidMethod,
  display_name: "Berkeley Lab",
  is_orcid: false,
  key: "lbl",
}
const passwordMethod = {
  ...orcidMethod,
  display_name: "Password",
  is_orcid: false,
  key: "password",
  kind: "password" as const,
}

function mockAccount(signInMethods: string[] | null) {
  vi.mocked(getWorkspaceAccount).mockResolvedValue({
    data: {
      is_service_account: false,
      sign_in_methods: signInMethods,
      unique_id: "person-1",
      username: "achen",
    },
    status: "ok",
  } as never)
}

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

async function chooseFromMenu(trigger: string, item: string | RegExp) {
  fireEvent.click(await screen.findByRole("button", { name: trigger }))
  return screen.findByRole("menuitem", { name: item })
}

function renderCard(linkOutcome?: AccountLinkOutcome) {
  const onLinkOutcomeHandled = vi.fn()
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <AccountSignInMethodsSection
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
    expect(addableSignInMethods([passwordMethod, labMethod], [])).toEqual([
      labMethod,
    ])
  })
})

describe("AccountSignInMethodsCard", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getHubSignInOptions).mockResolvedValue({
      methods: [orcidMethod, labMethod],
      origin: null,
    })
    mockAccount(null)
  })
  afterEach(cleanup)

  it("lists each login and keeps the only one from being removed", async () => {
    vi.mocked(getWorkspaceAccountIdentities).mockResolvedValue(ok([orcidLogin]))
    renderCard()

    expect(await screen.findByText("ORCID")).toBeTruthy()
    expect(
      screen.getByRole("link", { name: "0000-0002-1825-0097" })
    ).toBeTruthy()
    expect(screen.getByRole("img", { name: "Verified" })).toBeTruthy()
    const remove = await chooseFromMenu("Actions for ORCID", /Remove/)
    expect(remove.getAttribute("aria-disabled")).toBe("true")
    cleanup()
    renderCard()
    expect(
      await chooseFromMenu("Add sign-in method", "Berkeley Lab")
    ).toBeTruthy()
    expect(screen.queryByRole("menuitem", { name: "ORCID" })).toBeNull()
  })

  it("warns before removing a login", async () => {
    vi.mocked(getWorkspaceAccountIdentities).mockResolvedValue(
      ok([orcidLogin, labLogin])
    )
    renderCard()

    fireEvent.click(
      await chooseFromMenu(
        "Actions for Berkeley Lab (a.chen@lab.example)",
        "Remove"
      )
    )
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
        authorizationUrl: "https://api.example.test/oauth/link/start?x=1",
      })
    )
    const assign = vi.fn()
    vi.stubGlobal("location", { ...window.location, assign })
    renderCard()

    fireEvent.click(await chooseFromMenu("Add sign-in method", "Berkeley Lab"))
    await waitFor(() =>
      expect(assign).toHaveBeenCalledWith(
        "https://api.example.test/oauth/link/start?x=1"
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

    fireEvent.click(await chooseFromMenu("Add sign-in method", "Berkeley Lab"))
    expect(
      await screen.findByText(/Adding a sign-in method needs a recent sign-in/)
    ).toBeTruthy()
  })

  it("asks to wait after too many sign-in links", async () => {
    vi.mocked(getWorkspaceAccountIdentities).mockResolvedValue(ok([orcidLogin]))
    vi.mocked(startWorkspaceAccountLinkFn).mockResolvedValue(
      failure("rate-limited", "too_many_links") as never
    )
    renderCard()

    fireEvent.click(await chooseFromMenu("Add sign-in method", "Berkeley Lab"))
    expect(
      await screen.findByText(
        "You've started too many sign-in links. Try again in about 10 minutes."
      )
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

  it("drops a returning link while the API has sign-in methods turned off", async () => {
    vi.mocked(getWorkspaceAccountIdentities).mockResolvedValue(
      failure("conflict", "identity_lookup_off") as never
    )
    const { onLinkOutcomeHandled } = renderCard("pending")

    await waitFor(() => expect(onLinkOutcomeHandled).toHaveBeenCalled())
    expect(vi.mocked(cancelWorkspaceAccountLinkFn)).toHaveBeenCalled()
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

  it("sets a first password from the add menu", async () => {
    vi.mocked(getHubSignInOptions).mockResolvedValue({
      methods: [orcidMethod, passwordMethod],
      origin: null,
    })
    mockAccount(["ORCID"])
    vi.mocked(getWorkspaceAccountIdentities).mockResolvedValue(ok([orcidLogin]))
    vi.mocked(setWorkspaceAccountPasswordFn).mockResolvedValue(ok(undefined))
    renderCard()

    fireEvent.click(await chooseFromMenu("Add sign-in method", "Password"))
    const dialog = await screen.findByRole("dialog", { name: "Set a password" })
    expect(screen.getByText(/sign in with your username, achen/)).toBeTruthy()
    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "correct horse battery" },
    })
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "correct horse battery" },
    })
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Set password" })
    )
    await waitFor(() =>
      expect(vi.mocked(setWorkspaceAccountPasswordFn)).toHaveBeenCalledWith({
        data: { newPassword: "correct horse battery" },
      })
    )
  })

  it("refuses mismatched passwords without asking the API", async () => {
    vi.mocked(getHubSignInOptions).mockResolvedValue({
      methods: [passwordMethod],
      origin: null,
    })
    mockAccount([])
    vi.mocked(getWorkspaceAccountIdentities).mockResolvedValue(ok([]))
    renderCard()

    fireEvent.click(await chooseFromMenu("Add sign-in method", "Password"))
    const dialog = await screen.findByRole("dialog", { name: "Set a password" })
    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "one long password" },
    })
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "another long password" },
    })
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Set password" })
    )
    expect(await screen.findByText("The passwords don't match.")).toBeTruthy()
    expect(vi.mocked(setWorkspaceAccountPasswordFn)).not.toHaveBeenCalled()
  })

  it("asks for the current password when the API says one exists", async () => {
    vi.mocked(getHubSignInOptions).mockResolvedValue({
      methods: [orcidMethod, passwordMethod],
      origin: null,
    })
    vi.mocked(getWorkspaceAccountIdentities).mockResolvedValue(ok([orcidLogin]))
    vi.mocked(setWorkspaceAccountPasswordFn).mockResolvedValueOnce({
      status: "error",
      error: {
        correlationId: "test",
        fieldErrors: { current_password: ["Enter your current password."] },
        kind: "validation",
        message: "Enter your current password.",
        retryable: false,
      },
    })
    renderCard()

    fireEvent.click(await chooseFromMenu("Add sign-in method", "Password"))
    const dialog = await screen.findByRole("dialog", { name: "Set a password" })
    for (const label of ["New password", "Confirm new password"]) {
      fireEvent.change(screen.getByLabelText(label), {
        target: { value: "a new long password" },
      })
    }
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Set password" })
    )
    expect(
      await screen.findByText("Enter your current password to change it.")
    ).toBeTruthy()
    expect(screen.getByRole("dialog", { name: "Change password" })).toBeTruthy()
    expect(screen.getByLabelText("Current password")).toBeTruthy()
  })

  it("keeps only Remove for a password when passwords are switched off", async () => {
    vi.mocked(getHubSignInOptions).mockResolvedValue({
      methods: [orcidMethod, passwordMethod],
      origin: null,
    })
    mockAccount(["password", "ORCID"])
    vi.mocked(getWorkspaceAccountIdentities).mockResolvedValue(ok([orcidLogin]))
    const scope = identityScope("server-1", "person-1")
    render(
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <WorkspaceProvider
          features={{ ...allFeaturesEnabled, passwords: false }}
          mode="api"
          scope={scope}
        >
          <AccountSignInMethodsSection
            onLinkOutcomeHandled={vi.fn()}
            scope={scope}
          />
        </WorkspaceProvider>
      </QueryClientProvider>
    )

    expect(await chooseFromMenu("Actions for Password", /Remove/)).toBeTruthy()
    expect(
      screen.queryByRole("menuitem", { name: "Change password" })
    ).toBeNull()
  })

  it("lists a password and offers to change it", async () => {
    vi.mocked(getHubSignInOptions).mockResolvedValue({
      methods: [orcidMethod, passwordMethod],
      origin: null,
    })
    mockAccount(["password", "ORCID"])
    vi.mocked(getWorkspaceAccountIdentities).mockResolvedValue(ok([orcidLogin]))
    renderCard()

    fireEvent.click(
      await chooseFromMenu("Actions for Password", "Change password")
    )
    expect(
      await screen.findByRole("dialog", { name: "Change password" })
    ).toBeTruthy()
    expect(screen.getByLabelText("Current password")).toBeTruthy()
    cleanup()
    renderCard()
    const remove = await chooseFromMenu("Actions for ORCID", /Remove/)
    expect(remove.getAttribute("aria-disabled")).toBeNull()
  })
})

describe("PersonSignInMethodsSection passwords", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getHubSignInOptions).mockResolvedValue({
      methods: [orcidMethod, passwordMethod],
      origin: null,
    })
    vi.mocked(getWorkspaceUserIdentities).mockResolvedValue(ok([orcidLogin]))
  })
  afterEach(cleanup)

  function renderPerson(signInMethods: string[]) {
    render(
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <PersonSignInMethodsSection
          password={{ canHavePassword: true, signInMethods }}
          personName="Ada Chen"
          scope={identityScope("server-1", "admin-1")}
          userId="person-2"
        />
      </QueryClientProvider>
    )
  }

  it("creates a setup link for someone without a password", async () => {
    vi.mocked(issueWorkspaceUserPasswordLinkFn).mockResolvedValue(
      ok({
        expires_at: "2026-11-10T00:00:00Z",
        purpose: "setup" as const,
        url: "https://api.example.test/oauth/password-link#t",
      })
    )
    renderPerson(["ORCID"])

    fireEvent.click(
      await screen.findByRole("button", { name: "Password setup link" })
    )
    expect(
      await screen.findByRole("dialog", { name: "Password setup link" })
    ).toBeTruthy()
    expect(
      screen.getByDisplayValue("https://api.example.test/oauth/password-link#t")
    ).toBeTruthy()
    expect(
      screen.getByText(/Send this link to Ada Chen privately/)
    ).toBeTruthy()
  })

  it("offers a reset link and removal for someone with a password", async () => {
    renderPerson(["password", "ORCID"])

    expect(
      await chooseFromMenu("Actions for Password", "Password reset link")
    ).toBeTruthy()
    expect(screen.getByRole("menuitem", { name: "Remove" })).toBeTruthy()
    expect(
      screen.queryByRole("button", { name: "Password setup link" })
    ).toBeNull()
  })
})
