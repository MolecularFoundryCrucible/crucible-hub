import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router"
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
  SignInHistorySection,
  authEventIssuer,
  authEventLabel,
} from "./sign-in-history-section"
import { getWorkspaceAuthEvents } from "@/data/crucible/auth-events.functions"
import { identityScope } from "@/data/crucible/query-keys"

vi.mock("@/data/crucible/auth-events.functions", () => ({
  getWorkspaceAuthEvents: vi.fn(),
}))

function renderSection(userId?: string) {
  const rootRoute = createRootRoute({
    component: () => (
      <SignInHistorySection
        scope={identityScope("server-1", "person-1")}
        userId={userId}
      />
    ),
  })
  const router = createRouter({
    history: createMemoryHistory(),
    routeTree: rootRoute.addChildren([
      createRoute({
        getParentRoute: () => rootRoute,
        path: "/users/$userId",
      }),
    ]),
  })
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}

describe("sign-in history labels", () => {
  it("names known events and keeps unknown ones readable", () => {
    expect(authEventLabel("sign_in_failed")).toBe("Sign-in failed")
    expect(authEventLabel("password_set")).toBe("Password set")
    expect(authEventLabel("mfa_enrolled")).toBe("Mfa enrolled")
  })

  it("names ORCID and otherwise shows the provider's host", () => {
    expect(authEventIssuer("https://orcid.org")).toBe("ORCID")
    expect(authEventIssuer("https://sandbox.orcid.org/")).toBe("ORCID")
    expect(authEventIssuer("https://login.example.edu/realms/lab")).toBe(
      "login.example.edu"
    )
    expect(authEventIssuer(null)).toBeNull()
  })
})

describe("SignInHistorySection", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  afterEach(cleanup)

  it("lists events newest first with provider, app and actor", async () => {
    vi.mocked(getWorkspaceAuthEvents).mockResolvedValue({
      data: {
        items: [
          {
            actor_unique_id: null,
            at: "2026-11-09T10:00:00Z",
            client_id: "crucible-hub",
            event: "sign_in",
            id: 2,
            issuer: "https://orcid.org",
          },
          {
            actor_unique_id: "admin-1",
            at: "2026-11-01T10:00:00Z",
            client_id: null,
            event: "approved",
            id: 1,
            issuer: null,
          },
        ],
        nextCursor: null,
        total: 2,
      },
      status: "ok",
    })
    renderSection()

    const table = await screen.findByRole("table", { name: "Sign-in history" })
    const rows = within(table).getAllByRole("row").slice(1)
    expect(within(rows[0]).getByText("Signed in")).toBeTruthy()
    expect(within(rows[0]).getByText("ORCID · Crucible Hub")).toBeTruthy()
    expect(within(rows[1]).getByText("Account approved")).toBeTruthy()
    expect(
      within(rows[1])
        .getByRole("link", { name: "by another person" })
        .getAttribute("href")
    ).toContain("/users/admin-1")
    expect(vi.mocked(getWorkspaceAuthEvents)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ limit: 20, userId: undefined }),
      })
    )
  })

  it("shows the five most recent events until expanded", async () => {
    vi.mocked(getWorkspaceAuthEvents).mockResolvedValue({
      data: {
        items: Array.from({ length: 8 }, (_, index) => ({
          actor_unique_id: null,
          at: `2026-11-0${9 - index}T10:00:00Z`,
          client_id: "crucible-hub",
          event: "sign_in",
          id: 8 - index,
          issuer: "https://orcid.org",
        })),
        nextCursor: null,
        total: 8,
      },
      status: "ok",
    })
    renderSection()

    const table = await screen.findByRole("table", { name: "Sign-in history" })
    expect(within(table).getAllByRole("row")).toHaveLength(6)

    const expand = screen.getByRole("button", { name: "Show all 8" })
    expect(expand.getAttribute("aria-expanded")).toBe("false")
    fireEvent.click(expand)
    expect(within(table).getAllByRole("row")).toHaveLength(9)

    const collapse = screen.getByRole("button", { name: "Show fewer" })
    expect(collapse.getAttribute("aria-expanded")).toBe("true")
    fireEvent.click(collapse)
    expect(within(table).getAllByRole("row")).toHaveLength(6)
  })

  it("offers no expand control when every event fits", async () => {
    vi.mocked(getWorkspaceAuthEvents).mockResolvedValue({
      data: {
        items: [
          {
            actor_unique_id: null,
            at: "2026-11-09T10:00:00Z",
            client_id: null,
            event: "sign_in",
            id: 1,
            issuer: null,
          },
        ],
        nextCursor: null,
        total: 1,
      },
      status: "ok",
    })
    renderSection()

    await screen.findByRole("table", { name: "Sign-in history" })
    expect(screen.queryByRole("button", { name: /^Show/ })).toBeNull()
  })

  it("asks for a person's history on their admin page", async () => {
    vi.mocked(getWorkspaceAuthEvents).mockResolvedValue({
      data: { items: [], nextCursor: null, total: 0 },
      status: "ok",
    })
    renderSection("person-2")

    expect(await screen.findByText("No sign-in history yet.")).toBeTruthy()
    await waitFor(() =>
      expect(vi.mocked(getWorkspaceAuthEvents)).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: "person-2" }),
        })
      )
    )
  })
})
