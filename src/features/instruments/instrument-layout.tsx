import { useSuspenseQuery } from "@tanstack/react-query"
import { Link, Outlet, getRouteApi } from "@tanstack/react-router"
import { PageHeader } from "@/components/crucible/page-header"
import { PageLayout } from "@/components/crucible/page-layout"
import { EntityRefreshAction } from "@/components/crucible/entity-refresh-action"
import { ResourceCreationActions } from "@/components/crucible/resource-creation-actions"
import { ResourceTypeIcon } from "@/components/crucible/resource-type-icon"
import {
  ResourceSectionNavigation,
  ResourceSectionPanel,
  resourceSectionActiveProps,
  resourceSectionLinkClassName,
} from "@/components/crucible/resource-section-navigation"
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
import { resourceDisplayName } from "@/lib/resource-name"
import { useRememberRecentlyViewed } from "@/features/recently-viewed/recently-viewed"

const route = getRouteApi("/_app/instruments/$instrumentMfid")

export function InstrumentPage() {
  const { instrumentMfid } = route.useParams()
  const scope = useWorkspaceScope()
  const resourceOptions = resourceSummaryQueryOptions(scope, instrumentMfid)
  const { data: resource, dataUpdatedAt } = useSuspenseQuery(resourceOptions)
  const displayName =
    resource?.kind === "instrument"
      ? resourceDisplayName("instrument", resource.name, {
          identifier: resource.instrument_id,
          mfid: resource.unique_id,
        })
      : ""
  useRememberRecentlyViewed(
    resource?.kind === "instrument"
      ? {
          identifier: resource.instrument_id ?? null,
          kind: "instrument",
          name: displayName,
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
            This instrument doesn't exist or you don't have access to it.
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
            <BreadcrumbPage>{displayName}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader
        icon={<ResourceTypeIcon className="size-5" type="instrument" />}
        identifier={
          resource.instrument_id && resource.instrument_id !== resource.name
            ? resource.instrument_id
            : undefined
        }
        title={displayName}
      />

      <ResourceSectionNavigation
        actions={
          <>
            <ResourceCreationActions
              instrumentMfid={resource.unique_id}
              kinds={["dataset"]}
              variant="outline"
            />
            <EntityRefreshAction
              exact={false}
              label={`Refresh details for ${displayName}`}
              queryKey={crucibleKeys.resourceDetails(scope, instrumentMfid)}
              refreshedAt={dataUpdatedAt}
              subject="Instrument details"
            />
          </>
        }
        label="Instrument sections"
      >
        <Link
          activeOptions={{ exact: true, includeSearch: false }}
          activeProps={resourceSectionActiveProps}
          viewTransition
          className={resourceSectionLinkClassName}
          params={{ instrumentMfid }}
          search={{}}
          to="/instruments/$instrumentMfid"
        >
          Data
        </Link>
        <Link
          activeOptions={{ includeSearch: false }}
          activeProps={resourceSectionActiveProps}
          viewTransition
          className={resourceSectionLinkClassName}
          params={{ instrumentMfid }}
          search={{}}
          to="/instruments/$instrumentMfid/overview"
        >
          Overview
        </Link>
        {resource.capabilities?.can_change_status === true ||
        resource.capabilities?.can_manage_access === true ||
        resource.capabilities?.can_view_access === true ||
        resource.capabilities?.can_transfer === true ? (
          <Link
            activeOptions={{ includeSearch: false }}
            activeProps={resourceSectionActiveProps}
            viewTransition
            className={resourceSectionLinkClassName}
            params={{ instrumentMfid }}
            search={{}}
            to="/instruments/$instrumentMfid/settings"
          >
            Manage
          </Link>
        ) : null}
      </ResourceSectionNavigation>

      <ResourceSectionPanel>
        <Outlet />
      </ResourceSectionPanel>
    </PageLayout>
  )
}
