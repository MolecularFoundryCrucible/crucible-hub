import { createFileRoute, redirect } from "@tanstack/react-router"
import { z } from "zod"

import { AuthPage } from "@/components/crucible/auth-page"
import { Button } from "@/components/ui/button"
import {
  accountNeedsSetup,
  accountSetupDestination,
} from "@/data/crucible/account-setup"
import { getWorkspace } from "@/data/crucible/workspace.functions"
import { AccountSetupForm } from "@/features/account-profile/account-setup-form"

export const Route = createFileRoute("/account/setup")({
  validateSearch: z.object({
    returnTo: z.string().max(1024).optional().catch(undefined),
  }),
  loaderDeps: ({ search }) => ({
    returnTo: accountSetupDestination(search.returnTo),
  }),
  loader: async ({ abortController, deps }) => {
    const source = await getWorkspace({
      data: {},
      signal: abortController.signal,
    })
    if (source.status === "unavailable") {
      if (source.authRequired) {
        throw redirect({
          to: "/auth/sign-in",
          search: { returnTo: deps.returnTo },
          replace: true,
          headers: { "Cache-Control": "private, no-store" },
        })
      }
      return { status: "unavailable" as const, reason: source.reason }
    }
    if (!source.sessionAuth || !accountNeedsSetup(source.workspace.account)) {
      throw redirect({ href: deps.returnTo, replace: true })
    }
    return { status: "ready" as const, account: source.workspace.account }
  },
  component: AccountSetupPage,
})

function AccountSetupPage() {
  const source = Route.useLoaderData()
  const { returnTo } = Route.useSearch()

  if (source.status === "unavailable") {
    return (
      <AuthPage error title="Account unavailable">
        <p className="text-body text-muted-foreground">{source.reason}</p>
        <Button
          className="mt-4"
          nativeButton={false}
          render={<a href="/hub/account/setup" />}
          size="lg"
          variant="outline"
        >
          Try again
        </Button>
      </AuthPage>
    )
  }

  return (
    <AuthPage
      title="Complete your account"
      footer={
        <form action="/hub/auth/logout" method="post">
          <Button type="submit" variant="ghost">
            Sign out
          </Button>
        </form>
      }
    >
      <AccountSetupForm account={source.account} returnTo={returnTo} />
    </AuthPage>
  )
}
