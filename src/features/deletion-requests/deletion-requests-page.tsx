import {
  useIsFetching,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { Link, getRouteApi } from "@tanstack/react-router"
import {
  CollectionSection,
  CollectionToolbar,
} from "@/components/crucible/collection-browser"
import { PageHeader } from "@/components/crucible/page-header"
import { RefreshButton } from "@/components/crucible/refresh-button"
import { PageLayout } from "@/components/crucible/page-layout"
import { ResourceIdentityLink } from "@/components/crucible/resource-identity-link"
import {
  ResourcePreviewContext,
  useResourcePreviewNavigation,
} from "@/components/crucible/resource-preview-navigation"
import { ResourceTypeIcon } from "@/components/crucible/resource-type-icon"
import { SegmentedControl } from "@/components/crucible/segmented-control"
import {
  useWorkspacePrivilegeMode,
  useWorkspaceScope,
} from "@/components/crucible/workspace-provider"
import { buttonVariants } from "@/components/ui/button"
import { accountQueryOptions } from "@/data/crucible/account.queries"
import { projectSummaryQueryOptions } from "@/data/crucible/projects.queries"
import { crucibleKeys } from "@/data/crucible/query-keys"
import { deletionRequestPageLimit } from "@/data/crucible/deletion-requests.queries"
import { DeletionRequestQueue } from "@/features/deletion-requests/deletion-request-queue"
import { DeletionAuditQueue } from "@/features/deletion-requests/deletion-audit-queue"
import { ResourceInspector } from "@/features/resource-inspector/resource-inspector"
import type { WorkspaceAccount } from "@/data/crucible/workspace-source"
import {
  deletionRequestStatus,
  deletionRequestScope,
  defaultDeletionRequestDirection,
  deletionAuditScope,
} from "@/features/deletion-requests/deletion-requests-search"

const route = getRouteApi("/_app/deletion-requests")

const requestViews = [
  { label: "Your requests", value: "submitted" },
  { label: "Needs review", value: "reviewable" },
] as const

export function DeletionRequestsPage() {
  const baseScope = useWorkspaceScope()
  const { data: account } = useSuspenseQuery(accountQueryOptions(baseScope))
  return <DeletionRequestsContent account={account} />
}

function DeletionRequestsContent({ account }: { account: WorkspaceAccount }) {
  const scope = useWorkspaceScope()
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const requestedView = search.view ?? "submitted"
  const canViewDeletionAudit = !account.is_service_account
  const view =
    requestedView === "approved" && !canViewDeletionAudit
      ? "submitted"
      : requestedView
  const sort = search.sort ?? "request_time"
  const direction = search.direction ?? defaultDeletionRequestDirection(sort)
  const views = canViewDeletionAudit
    ? [...requestViews, { label: "Approved", value: "approved" } as const]
    : requestViews
  const projectResult = useQuery({
    ...projectSummaryQueryOptions(scope, search.projectMfid ?? "unavailable"),
    enabled: Boolean(search.projectMfid),
  })
  const project = projectResult.data
  const projectName =
    project?.title?.trim() || project?.project_id || search.projectMfid
  const navigation = useResourcePreviewNavigation({
    kind: "deletion-requests",
    preview: search.preview,
  })
  const privilegeMode = useWorkspacePrivilegeMode()
  const auditScope = deletionAuditScope(privilegeMode)
  const queryClient = useQueryClient()
  const refreshKeys = [
    crucibleKeys.deletionRequestQueries(scope),
    crucibleKeys.deletionAuditQueries(scope),
  ]
  const refreshing =
    useIsFetching({ queryKey: refreshKeys[0] }) +
      useIsFetching({ queryKey: refreshKeys[1] }) >
    0

  return (
    <ResourcePreviewContext.Provider value={navigation}>
      <PageLayout>
        <PageHeader divider={false} title="Deletion requests" />
        <CollectionSection>
          <CollectionToolbar
            actions={
              <RefreshButton
                label="Refresh deletion requests"
                onClick={() => {
                  for (const queryKey of refreshKeys) {
                    void queryClient.refetchQueries({
                      queryKey,
                      type: "active",
                    })
                  }
                }}
                refreshing={refreshing}
              />
            }
            filters={
              view !== "approved" && search.projectMfid && projectName ? (
                <>
                  <ResourceIdentityLink
                    context={
                      project?.title?.trim() ? project.project_id : undefined
                    }
                    kind="project"
                    mfid={search.projectMfid}
                    name={projectName}
                  >
                    <span className="inline-flex max-w-72 min-w-0 items-center gap-2 text-body hover:underline">
                      <ResourceTypeIcon className="shrink-0" type="project" />
                      <span className="truncate">{projectName}</span>
                    </span>
                  </ResourceIdentityLink>
                  <Link
                    aria-label="Clear project filter"
                    className={buttonVariants({
                      size: "sm",
                      variant: "ghost",
                    })}
                    from="/deletion-requests"
                    search={(current) => ({
                      ...current,
                      projectMfid: undefined,
                    })}
                    to="/deletion-requests"
                  >
                    Clear
                  </Link>
                </>
              ) : undefined
            }
            primary={
              <SegmentedControl
                ariaLabel="Deletion request view"
                onValueChange={(nextView) => {
                  void navigate({
                    replace: true,
                    search: (current) => ({
                      ...current,
                      direction: undefined,
                      projectMfid:
                        nextView === "approved"
                          ? undefined
                          : current.projectMfid,
                      preview: undefined,
                      sort: undefined,
                      view: nextView,
                    }),
                    to: "/deletion-requests",
                  })
                }}
                options={views}
                value={view}
              />
            }
          />
          {view === "approved" && canViewDeletionAudit ? (
            <DeletionAuditQueue
              account={account}
              auditScope={auditScope}
              scope={scope}
            />
          ) : (
            <DeletionRequestQueue
              account={account}
              bulkReview={view === "reviewable"}
              emptyTitle={
                view === "reviewable"
                  ? "No requests need review"
                  : "No submitted requests"
              }
              filters={{
                direction,
                limit: deletionRequestPageLimit,
                projectMfid: search.projectMfid,
                scope: deletionRequestScope(view),
                sort,
                status: deletionRequestStatus(view),
              }}
              onSortChange={(nextSort, nextDirection) => {
                void navigate({
                  replace: true,
                  search: (current) => ({
                    ...current,
                    direction: nextDirection,
                    preview: undefined,
                    sort: nextSort === "request_time" ? undefined : nextSort,
                  }),
                  to: "/deletion-requests",
                })
              }}
              paginate
              scope={scope}
            />
          )}
        </CollectionSection>
      </PageLayout>
      <ResourceInspector navigation={navigation} />
    </ResourcePreviewContext.Provider>
  )
}
