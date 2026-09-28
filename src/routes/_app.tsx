import { useSuspenseQuery } from "@tanstack/react-query"
import {
  Outlet,
  createFileRoute,
  redirect,
  retainSearchParams,
} from "@tanstack/react-router"
import { z } from "zod"

import { AppShell } from "@/components/crucible/app-shell"
import { WorkspaceProvider } from "@/components/crucible/workspace-provider"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { accountQueryOptions } from "@/data/crucible/account.queries"
import {
  accountNeedsSetup,
  accountSetupDestination,
} from "@/data/crucible/account-setup"
import {
  defaultFixtureScenario,
  fixtureScenarioSchema,
  fixtureServerId,
} from "@/data/crucible/fixture-scenarios"
import { crucibleKeys, identityScope } from "@/data/crucible/query-keys"
import { getWorkspace } from "@/data/crucible/workspace.functions"

export const Route = createFileRoute("/_app")({
  validateSearch: z.object({
    scenario: fixtureScenarioSchema.optional().catch(undefined),
  }),
  search: {
    middlewares: [retainSearchParams(["scenario"])],
  },
  loaderDeps: ({ search }) => ({ scenario: search.scenario }),
  loader: async ({ abortController, context, deps, location }) => {
    const scenario = deps.scenario ?? defaultFixtureScenario
    const source = await getWorkspace({
      data: { scenario: deps.scenario },
      signal: abortController.signal,
    })
    if (source.status === "unavailable") {
      if (source.authRequired) {
        const current = new URL(location.href, "http://127.0.0.1:3000")
        const pathname = current.pathname.startsWith("/hub/")
          ? current.pathname
          : `/hub${current.pathname}`
        throw redirect({
          to: "/auth/sign-in",
          search: { returnTo: `${pathname}${current.search}${current.hash}` },
          replace: true,
          headers: { "Cache-Control": "private, no-store" },
        })
      }
      return source
    }

    if (source.sessionAuth && accountNeedsSetup(source.workspace.account)) {
      const current = new URL(location.href, "http://127.0.0.1:3000")
      const pathname = current.pathname.startsWith("/hub/")
        ? current.pathname
        : `/hub${current.pathname}`
      throw redirect({
        to: "/account/setup",
        search: {
          returnTo: accountSetupDestination(
            `${pathname}${current.search}${current.hash}`
          ),
        },
        replace: true,
        headers: { "Cache-Control": "private, no-store" },
      })
    }

    const scope = identityScope(
      source.mode === "fixture" ? fixtureServerId(scenario) : "crucible-hosted",
      source.workspace.account.unique_id,
      source.privilegeMode
    )
    const { account } = source.workspace
    context.queryClient.setQueryData(
      crucibleKeys.accountProfile(scope),
      account
    )

    return {
      status: "ready" as const,
      mode: source.mode,
      privilegeMode: source.privilegeMode,
      sessionAuth: source.sessionAuth ?? false,
      scope,
    }
  },
  staleTime: Infinity,
  component: WorkspaceLayout,
})

function WorkspaceLayout() {
  const source = Route.useLoaderData()

  if (source.status === "unavailable") {
    return (
      <AppShell>
        <Card className="mx-auto mt-16 max-w-state">
          <CardHeader>
            <CardTitle>Workspace connection pending</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground">
            {source.reason}
          </CardContent>
        </Card>
      </AppShell>
    )
  }

  return (
    <ReadyWorkspace
      mode={source.mode}
      privilegeMode={source.privilegeMode}
      sessionAuth={source.sessionAuth}
      scope={source.scope}
    />
  )
}

function ReadyWorkspace({
  mode,
  privilegeMode,
  sessionAuth,
  scope,
}: {
  mode: "api" | "fixture"
  privilegeMode: "elevated" | "normal"
  sessionAuth: boolean
  scope: ReturnType<typeof identityScope>
}) {
  const { data: account } = useSuspenseQuery(accountQueryOptions(scope))

  return (
    <WorkspaceProvider mode={mode} privilegeMode={privilegeMode} scope={scope}>
      <AppShell
        account={account}
        privilegeMode={privilegeMode}
        scope={scope}
        sessionAuth={sessionAuth}
      >
        <Outlet />
      </AppShell>
    </WorkspaceProvider>
  )
}
