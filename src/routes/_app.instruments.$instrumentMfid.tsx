import { useSuspenseQuery } from "@tanstack/react-query"
import { Link, Outlet, createFileRoute } from "@tanstack/react-router"

import { PageHeader } from "@/components/crucible/page-header"
import { PageLayout } from "@/components/crucible/page-layout"
import { EntityRefreshAction } from "@/components/crucible/entity-refresh-action"
import { ResourceCreationActions } from "@/components/crucible/resource-creation-actions"
import { ResourceTypeIcon } from "@/components/crucible/resource-type-icon"
import {
  ResourceSectionNavigation,
  resourceSectionActiveProps,
  resourceSectionLinkClassName,
} from "@/components/crucible/resource-section-navigation"
import { RouteContentPending } from "@/components/crucible/route-content-pending"
import { useWorkspaceScope } from "@/components/crucible/workspace-provider"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { crucibleKeys } from "@/data/crucible/query-keys"
import { resourceSummaryQueryOptions } from "@/data/crucible/resources.queries"
import { hubPageTitle } from "@/lib/page-title"
import { useRememberRecentlyViewed } from "@/features/recently-viewed/recently-viewed"

export const Route = createFileRoute("/_app/instruments/$instrumentMfid")({
  loader: async ({ context, params, parentMatchPromise }) => {
    const source = (await parentMatchPromise).loaderData
    if (!source || source.status === "unavailable") return

    const resource = await context.queryClient.ensureQueryData(
      resourceSummaryQueryOptions(source.scope, params.instrumentMfid)
    )
    if (!resource || resource.kind !== "instrument") {
      return { isInstrument: false, scope: source.scope }
    }
    return {
      instrumentMfid: resource.unique_id,
      instrumentName: resource.name,
      isInstrument: true,
      scope: source.scope,
    }
  },
  head: ({ loaderData }) => ({
    meta: [{ title: hubPageTitle(loaderData?.instrumentName) }],
  }),
  pendingComponent: RouteContentPending,
  component: InstrumentPage,
})

function InstrumentPage() {
  const { instrumentMfid } = Route.useParams()
  const scope = useWorkspaceScope()
  const resourceOptions = resourceSummaryQueryOptions(scope, instrumentMfid)
  const { data: resource, dataUpdatedAt } = useSuspenseQuery(resourceOptions)
  useRememberRecentlyViewed(
    resource?.kind === "instrument"
      ? {
          kind: "instrument",
          name: resource.name,
          projectId: null,
          uniqueId: resource.unique_id,
        }
      : null
  )

  if (!resource || resource.kind !== "instrument") {
    return (
      <Card className="mx-auto mt-16 max-w-state">
        <CardHeader>
          <CardTitle>Instrument not found</CardTitle>
          <CardDescription>
            This instrument is not available in the current workspace.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <PageLayout>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink
              render={<Link search={{ cursor: undefined }} to="/instruments" />}
            >
              Instruments
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{resource.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader
        eyebrow={resource.instrument_id ?? undefined}
        icon={
          <ResourceTypeIcon
            className="mt-1 size-6 shrink-0"
            type="instrument"
          />
        }
        title={resource.name}
      />

      <ResourceSectionNavigation
        actions={
          <>
            <ResourceCreationActions
              instrumentMfid={resource.unique_id}
              kinds={["dataset"]}
            />
            <EntityRefreshAction
              exact={false}
              label={`Refresh details for ${resource.name}`}
              queryKey={crucibleKeys.resourceDetails(scope, instrumentMfid)}
              refreshedAt={dataUpdatedAt}
              subject="Instrument details"
            />
          </>
        }
        label="Instrument sections"
      >
        <Link
          activeOptions={{ includeSearch: false }}
          activeProps={resourceSectionActiveProps}
          className={resourceSectionLinkClassName}
          params={{ instrumentMfid }}
          search={{ cursor: undefined }}
          to="/instruments/$instrumentMfid/datasets"
        >
          Data
        </Link>
        <Link
          activeOptions={{ exact: true, includeSearch: false }}
          activeProps={resourceSectionActiveProps}
          className={resourceSectionLinkClassName}
          params={{ instrumentMfid }}
          search={{}}
          to="/instruments/$instrumentMfid"
        >
          Overview
        </Link>
        {resource.capabilities?.can_change_status === true ||
        resource.capabilities?.can_manage_access === true ||
        resource.capabilities?.can_transfer === true ? (
          <Link
            activeOptions={{ includeSearch: false }}
            activeProps={resourceSectionActiveProps}
            className={resourceSectionLinkClassName}
            params={{ instrumentMfid }}
            search={{}}
            to="/instruments/$instrumentMfid/settings"
          >
            Manage
          </Link>
        ) : null}
      </ResourceSectionNavigation>

      <Outlet />
    </PageLayout>
  )
}
