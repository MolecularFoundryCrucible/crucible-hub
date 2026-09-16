import { useSuspenseQuery } from "@tanstack/react-query"
import {
  Outlet,
  createFileRoute,
  retainSearchParams,
} from "@tanstack/react-router"
import { z } from "zod"

import { AppShell } from "@/components/crucible/app-shell"
import { WorkspaceProvider } from "@/components/crucible/workspace-provider"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { accountQueryOptions } from "@/data/crucible/account.queries"
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
  loader: async ({ abortController, context, deps }) => {
    const scenario = deps.scenario ?? defaultFixtureScenario
    const source = await getWorkspace({
      data: { scenario: deps.scenario },
      signal: abortController.signal,
    })
    if (source.status === "unavailable") return source

    const scope = identityScope(
      source.mode === "fixture" ? fixtureServerId(scenario) : "crucible-hosted",
      source.workspace.account.unique_id
    )
    const { account } = source.workspace
    context.queryClient.setQueryData(
      crucibleKeys.accountProfile(scope),
      account
    )

    return { status: "ready" as const, mode: source.mode, scope }
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

  return <ReadyWorkspace mode={source.mode} scope={source.scope} />
}

function ReadyWorkspace({
  mode,
  scope,
}: {
  mode: "api" | "fixture"
  scope: ReturnType<typeof identityScope>
}) {
  const { data: account } = useSuspenseQuery(accountQueryOptions(scope))

  return (
    <WorkspaceProvider mode={mode} scope={scope}>
      <AppShell account={account} scope={scope}>
        <Outlet />
      </AppShell>
    </WorkspaceProvider>
  )
}
