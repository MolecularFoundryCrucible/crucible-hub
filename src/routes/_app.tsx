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
import { dataPageLimit } from "@/data/crucible/data.queries"
import {
  defaultFixtureScenario,
  fixtureScenarioSchema,
  fixtureServerId,
} from "@/data/crucible/fixture-scenarios"
import { instrumentPageLimit } from "@/data/crucible/instruments.queries"
import { projectPageLimit } from "@/data/crucible/projects.queries"
import { crucibleKeys, identityScope } from "@/data/crucible/query-keys"
import { getWorkspace } from "@/data/crucible/workspace.functions"
import { workspaceQueryOptions } from "@/data/crucible/workspace.queries"
import { workspaceContent } from "@/data/crucible/workspace-source"

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
    const { account, instruments, projects } = source.workspace
    context.queryClient.setQueryData(
      crucibleKeys.accountProfile(scope),
      account
    )
    context.queryClient.setQueryData(
      crucibleKeys.workspace(scope),
      workspaceContent(source.workspace)
    )
    if (source.mode === "fixture") {
      context.queryClient.setQueryData(
        crucibleKeys.projects(scope, { limit: projectPageLimit, offset: 0 }),
        {
          items: projects.slice(0, projectPageLimit),
          limit: projectPageLimit,
          offset: 0,
          total: projects.length,
        }
      )
      if (scenario !== "degraded") {
        context.queryClient.setQueryData(
          crucibleKeys.instruments(scope, {
            limit: instrumentPageLimit,
            offset: 0,
          }),
          {
            items: instruments.slice(0, instrumentPageLimit),
            limit: instrumentPageLimit,
            offset: 0,
            total: instruments.length,
          }
        )
      }
      context.queryClient.setQueryData(
        crucibleKeys.samples(scope, { cursor: null, limit: dataPageLimit }),
        {
          items: source.workspace.samples.slice(0, dataPageLimit),
          limit: dataPageLimit,
          nextCursor:
            source.workspace.samples.length > dataPageLimit
              ? `fixture:${dataPageLimit}`
              : null,
          total: source.workspace.samples.length,
        }
      )
      if (scenario !== "partial") {
        context.queryClient.setQueryData(
          crucibleKeys.datasets(scope, { cursor: null, limit: dataPageLimit }),
          {
            items: source.workspace.datasets.slice(0, dataPageLimit),
            limit: dataPageLimit,
            nextCursor:
              source.workspace.datasets.length > dataPageLimit
                ? `fixture:${dataPageLimit}`
                : null,
            total: source.workspace.datasets.length,
          }
        )
      }
    }

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
  const { data: workspace } = useSuspenseQuery(workspaceQueryOptions(scope))
  const { data: account } = useSuspenseQuery(accountQueryOptions(scope))

  return (
    <WorkspaceProvider mode={mode} scope={scope} workspace={workspace}>
      <AppShell account={account}>
        <Outlet />
      </AppShell>
    </WorkspaceProvider>
  )
}
