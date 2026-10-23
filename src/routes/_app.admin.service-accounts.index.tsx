import { ApiKeyStatusBadge } from "@/components/crucible/api-credential-card"
import { useMemo, useState } from "react"
import type { InfiniteData } from "@tanstack/react-query"
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { Link, createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import { ActivityTime } from "@/components/crucible/activity-time"
import { CollectionPagination } from "@/components/crucible/collection-pagination"
import { DirectorySearchField } from "@/components/crucible/directory-search-field"
import { MfidText } from "@/components/crucible/mfid-text"
import { PageHeader } from "@/components/crucible/page-header"
import { PageLayout } from "@/components/crucible/page-layout"
import {
  PersonIdentity,
  personDisplayName,
} from "@/components/crucible/person-identity"
import { PendingRegion } from "@/components/crucible/pending-region"
import { ResourceCreationLink } from "@/components/crucible/resource-creation-actions"
import { ResourceFullPageLink } from "@/components/crucible/resource-full-page-link"
import { SelectableTextLink } from "@/components/crucible/selectable-text-link"
import { SortableTableHead } from "@/components/crucible/sortable-table-head"
import { TableSortControl } from "@/components/crucible/table-sort-control"
import type { TableSortField } from "@/components/crucible/table-sort-control"
import { PlatformRoleBadge } from "@/components/crucible/platform-role-badge"
import {
  useAdministrationScope,
  useWorkspaceMode,
  useWorkspacePrivilegeMode,
  useWorkspaceScope,
} from "@/components/crucible/workspace-provider"
import { Card, CardContent } from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  CollectionLoadError,
  CollectionTablePending,
  CollectionUpdateError,
  CollectionUpdateStatus,
} from "@/components/crucible/collection-state"
import { accountQueryOptions } from "@/data/crucible/account.queries"
import type { SortDirection } from "@/data/crucible/collection-query"
import {
  collectionCursorSchema,
  sortDirectionSchema,
} from "@/data/crucible/collection-query"
import {
  cursorPageTotal,
  flattenCursorPages,
} from "@/data/crucible/cursor-pages"
import { canOpenServiceAccountAdministration } from "@/data/crucible/administration"
import { AdministrationUnavailable } from "@/components/crucible/administrator-view-required"
import {
  crucibleKeys,
  identityScopeWithPrivilegeMode,
} from "@/data/crucible/query-keys"
import {
  serviceAccountPageLimit,
  serviceAccountsCursorQueryOptions,
} from "@/data/crucible/service-accounts.queries"
import {
  userActivityFilterOptions,
  userActivityFilters,
} from "@/data/crucible/user-activity"
import type {
  WorkspaceAccount,
  WorkspaceServiceAccount,
  WorkspaceServiceAccountCredential,
  WorkspaceServiceAccountPage,
} from "@/data/crucible/workspace-source"
import { prefetchInfiniteQueryWithReadableCache } from "@/data/query-prefetch"
import { OneTimeCredentialDialog } from "@/features/service-accounts/one-time-credential-dialog"
import { ServiceAccountCreateDialog } from "@/features/service-accounts/service-account-create-dialog"
import { useEnteringClassName } from "@/hooks/use-entering-keys"
import { formatUsername } from "@/lib/username"

const serviceAccountSortFieldSchema = z.enum([
  "account",
  "unique_id",
  "last_active",
])
export type ServiceAccountSortField = z.infer<
  typeof serviceAccountSortFieldSchema
>

function apiServiceAccountSort(sort: ServiceAccountSortField | undefined) {
  if (!sort || sort === "account") return "username" as const
  return sort
}

const serviceAccountSearchSchema = z.object({
  activity: z.enum(userActivityFilters).optional().catch(undefined),
  create: z.boolean().optional().catch(undefined),
  cursor: collectionCursorSchema,
  direction: sortDirectionSchema.optional().catch(undefined),
  q: z.string().trim().min(1).max(200).optional().catch(undefined),
  sort: serviceAccountSortFieldSchema.optional().catch(undefined),
})

export const Route = createFileRoute("/_app/admin/service-accounts/")({
  head: () => ({ meta: [{ title: "Service accounts | Crucible Hub" }] }),
  validateSearch: serviceAccountSearchSchema,
  loaderDeps: ({ search }) => ({
    activity: search.activity,
    cursor: search.cursor,
    direction: search.direction,
    query: search.q,
    sort: search.sort,
  }),
  loader: async ({ cause, context, deps, parentMatchPromise }) => {
    const source = (await parentMatchPromise).loaderData
    if (!source || source.status === "unavailable") return
    const account = context.queryClient.getQueryData<WorkspaceAccount>(
      crucibleKeys.accountProfile(source.scope)
    )
    if (
      !account ||
      !canOpenServiceAccountAdministration(account, source.privilegeMode)
    )
      return
    const administrationScope = identityScopeWithPrivilegeMode(
      source.scope,
      "elevated"
    )
    const options = serviceAccountsCursorQueryOptions(administrationScope, {
      activity: deps.activity,
      cursor: deps.cursor,
      direction: deps.direction,
      includeTotal: true,
      limit: serviceAccountPageLimit,
      query: deps.query,
      sort: apiServiceAccountSort(deps.sort),
    })
    const request = prefetchInfiniteQueryWithReadableCache(
      context.queryClient,
      options
    )
    if (cause !== "stay" && request) await request
  },
  pendingComponent: ServiceAccountsPending,
  component: ServiceAccountsPage,
})

const sortFields = [
  { field: "account", label: "Account", preferredDirection: "asc" },
  { field: "unique_id", label: "Crucible ID", preferredDirection: "asc" },
  { field: "last_active", kind: "date", label: "Last active" },
] as const satisfies readonly TableSortField<ServiceAccountSortField>[]

function ServiceAccountsPage() {
  const scope = useWorkspaceScope()
  const administrationScope = useAdministrationScope()
  const privilegeMode = useWorkspacePrivilegeMode()
  const mode = useWorkspaceMode()
  const queryClient = useQueryClient()
  const { data: account } = useSuspenseQuery(accountQueryOptions(scope))
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const sort = search.sort ?? "account"
  const direction = search.direction ?? "asc"
  const options = serviceAccountsCursorQueryOptions(administrationScope, {
    activity: search.activity,
    cursor: search.cursor,
    direction,
    includeTotal: true,
    limit: serviceAccountPageLimit,
    query: search.q,
    sort: apiServiceAccountSort(sort),
  })
  const result = useInfiniteQuery({
    ...options,
    enabled: canOpenServiceAccountAdministration(account, privilegeMode),
  })
  const serviceAccounts = useMemo(
    () => flattenCursorPages(result.data?.pages),
    [result.data]
  )
  const total = cursorPageTotal(result.data?.pages)
  const updating = result.isFetching && !result.isFetchingNextPage
  const createOpen = search.create === true
  const [credential, setCredential] =
    useState<WorkspaceServiceAccountCredential>()

  if (!canOpenServiceAccountAdministration(account, privilegeMode)) {
    return (
      <AdministrationUnavailable
        account={account}
        description="Turn on administrator view to create and manage service accounts."
        title="Service accounts"
      />
    )
  }

  function handleCreated(created: WorkspaceServiceAccountCredential) {
    setCredential(created)
    if (mode === "api") {
      void queryClient.invalidateQueries({
        queryKey: crucibleKeys.serviceAccountAdminQueries(administrationScope),
      })
      return
    }
    if (!search.cursor && !search.q && !search.activity) {
      queryClient.setQueryData<InfiniteData<WorkspaceServiceAccountPage>>(
        options.queryKey,
        (current) => {
          const firstPage = current?.pages[0]
          if (!current || !firstPage) return current
          return {
            ...current,
            pages: [
              {
                ...firstPage,
                items: [
                  {
                    email: null,
                    first_name: "",
                    is_service_account: true,
                    last_active_at: null,
                    last_name: "",
                    platform_role: "contributor",
                    unique_id: created.unique_id,
                    username: created.username,
                  },
                  ...firstPage.items,
                ],
                total: firstPage.total === null ? null : firstPage.total + 1,
              },
              ...current.pages.slice(1),
            ],
          }
        }
      )
    }
  }

  function handleSortChange(
    nextField: ServiceAccountSortField,
    nextDirection: SortDirection
  ) {
    void navigate({
      replace: true,
      search: {
        ...search,
        cursor: undefined,
        direction: nextDirection,
        sort: nextField,
      },
      state: {},
      to: "/admin/service-accounts",
    })
  }

  function setCreateOpen(open: boolean) {
    void navigate({
      replace: true,
      search: {
        activity: search.activity,
        create: open ? true : undefined,
        cursor: search.cursor,
        direction: search.direction,
        q: search.q,
        sort: search.sort,
      },
      state: {},
      to: "/admin/service-accounts",
    })
  }

  return (
    <PageLayout>
      <ServiceAccountsPageHeader canCreate />
      <div className="flex flex-wrap items-center gap-3">
        <ServiceAccountSearchField />
        <ServiceAccountActivityFilterField />
      </div>
      {result.isPending ? (
        <CollectionTablePending
          label="service accounts"
          presentation="service-accounts"
        />
      ) : result.isError && !result.data ? (
        <CollectionLoadError
          label="Service accounts"
          retry={() => void result.refetch()}
        />
      ) : (
        <>
          {result.isError && !result.isFetchNextPageError ? (
            <CollectionUpdateError
              label="Service accounts"
              preserved
              retry={() => void result.refetch()}
            />
          ) : null}
          <ServiceAccountCollection
            direction={direction}
            hasNextPage={Boolean(result.hasNextPage)}
            isLoadingMore={result.isFetchingNextPage}
            loadMoreError={result.isFetchNextPageError}
            onLoadMore={() => void result.fetchNextPage()}
            onSortChange={handleSortChange}
            query={search.q}
            serviceAccounts={serviceAccounts}
            sort={sort}
            total={total}
            updating={updating}
          />
        </>
      )}
      <ServiceAccountCreateDialog
        onCreated={handleCreated}
        onOpenChange={setCreateOpen}
        open={createOpen}
        scope={administrationScope}
      />
      <OneTimeCredentialDialog
        credential={credential}
        onClose={() => setCredential(undefined)}
        title="Service account created"
      />
    </PageLayout>
  )
}

function ServiceAccountsPending() {
  const scope = useWorkspaceScope()
  const privilegeMode = useWorkspacePrivilegeMode()
  const { data: account } = useQuery(accountQueryOptions(scope))
  return (
    <PageLayout>
      <ServiceAccountsPageHeader
        canCreate={
          account
            ? canOpenServiceAccountAdministration(account, privilegeMode)
            : false
        }
      />
      <div className="flex flex-wrap items-center gap-3">
        <ServiceAccountSearchField />
        <ServiceAccountActivityFilterField />
      </div>
      <CollectionTablePending
        label="service accounts"
        presentation="service-accounts"
      />
    </PageLayout>
  )
}

function ServiceAccountsPageHeader({ canCreate }: { canCreate: boolean }) {
  const search = Route.useSearch()
  return (
    <PageHeader
      actions={
        canCreate ? (
          <ResourceCreationLink
            kind="service_account"
            label="Create service account"
            render={
              <Link
                search={{
                  activity: search.activity,
                  create: true,
                  cursor: undefined,
                  direction: search.direction,
                  q: search.q,
                  sort: search.sort,
                }}
                to="/admin/service-accounts"
              />
            }
          />
        ) : null
      }
      title="Service accounts"
    />
  )
}

function ServiceAccountSearchField() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()

  return (
    <DirectorySearchField
      label="Search service accounts"
      onSearch={(query) => {
        void navigate({
          replace: true,
          search: {
            activity: search.activity,
            cursor: undefined,
            direction: search.direction,
            q: query,
            sort: search.sort,
          },
          state: {},
          to: "/admin/service-accounts",
        })
      }}
      placeholder="Search by name or username"
      query={search.q}
    />
  )
}

function ServiceAccountCollection({
  direction = "asc",
  hasNextPage,
  isLoadingMore,
  loadMoreError,
  onLoadMore,
  onSortChange,
  query,
  serviceAccounts,
  sort,
  total,
  updating,
}: {
  direction?: SortDirection
  hasNextPage: boolean
  isLoadingMore: boolean
  loadMoreError: boolean
  onLoadMore: () => void
  onSortChange: (
    field: ServiceAccountSortField,
    direction: SortDirection
  ) => void
  query?: string
  serviceAccounts: readonly WorkspaceServiceAccount[]
  sort?: ServiceAccountSortField
  total: number | null
  updating: boolean
}) {
  const enterClassName = useEnteringClassName(
    serviceAccounts.map((item) => item.unique_id)
  )
  return (
    <>
      <CollectionUpdateStatus label="service accounts" updating={updating} />
      {serviceAccounts.length > 0 ? (
        <PendingRegion pending={updating} render={<Card />}>
          <CardContent className="px-0">
            <Table
              aria-label="Service accounts"
              before={
                <TableSortControl
                  direction={direction}
                  fields={sortFields}
                  onChange={onSortChange}
                  sort={sort}
                />
              }
              className="identity-directory-table table-fixed"
            >
              <colgroup>
                <col className="identity-directory-account-column" />
                <col className="identity-directory-mfid-column w-column-secondary" />
                <col className="identity-directory-role-column" />
                <col className="identity-directory-key-column" />
                <col className="identity-directory-activity-column" />
                <col className="identity-directory-action-column" />
              </colgroup>
              <TableHeader>
                <TableRow>
                  <SortableTableHead
                    active={sort === "account"}
                    direction={direction}
                    field="account"
                    label="Account"
                    onChange={onSortChange}
                    preferredDirection="asc"
                  />
                  <SortableTableHead
                    active={sort === "unique_id"}
                    direction={direction}
                    field="unique_id"
                    label="Crucible ID"
                    onChange={onSortChange}
                    preferredDirection="asc"
                  />
                  <TableHead className="identity-directory-role">
                    Platform role
                  </TableHead>
                  <TableHead className="identity-directory-key">
                    API key
                  </TableHead>
                  <SortableTableHead
                    active={sort === "last_active"}
                    direction={direction}
                    field="last_active"
                    kind="date"
                    label="Last active"
                    onChange={onSortChange}
                    preferredDirection="desc"
                  />
                  <TableHead kind="action">
                    <span className="sr-only">Open</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {serviceAccounts.map((serviceAccount) => (
                  <TableRow
                    className={enterClassName(serviceAccount.unique_id)}
                    key={serviceAccount.unique_id}
                  >
                    <TableCell className="identity-directory-account">
                      <PersonIdentity
                        className="min-w-0"
                        nameContent={
                          <SelectableTextLink
                            className="block truncate"
                            render={
                              <Link
                                params={{
                                  serviceAccountMfid: serviceAccount.unique_id,
                                }}
                                to="/admin/service-accounts/$serviceAccountMfid"
                              />
                            }
                          >
                            {personDisplayName(serviceAccount)}
                          </SelectableTextLink>
                        }
                        person={serviceAccount}
                        presentation="avatar"
                        size="sm"
                      />
                    </TableCell>
                    <TableCell
                      className="identity-directory-mfid"
                      data-label="Crucible ID"
                    >
                      <MfidText
                        className="block truncate"
                        title={serviceAccount.unique_id}
                        value={serviceAccount.unique_id}
                      />
                    </TableCell>
                    <TableCell
                      className="identity-directory-role"
                      data-label="Platform role"
                    >
                      <PlatformRoleBadge role={serviceAccount.platform_role} />
                    </TableCell>
                    <TableCell
                      className="identity-directory-key"
                      data-label="API key"
                    >
                      <ApiKeyStatusBadge
                        status={serviceAccount.api_key_status}
                      />
                    </TableCell>
                    <TableCell
                      className="identity-directory-activity"
                      data-label="Last active"
                      kind="date"
                    >
                      <ActivityTime
                        fallback="Never"
                        value={serviceAccount.last_active_at}
                      />
                    </TableCell>
                    <TableCell
                      kind="action"
                      className="identity-directory-action"
                    >
                      <ResourceFullPageLink
                        kind="service-account"
                        mfid={serviceAccount.unique_id}
                        name={formatUsername(serviceAccount.username, "raw")}
                        presentation="table"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </PendingRegion>
      ) : (
        <PendingRegion
          pending={updating}
          render={<Empty className="min-h-state border" />}
        >
          <EmptyHeader>
            <EmptyTitle>No service accounts found</EmptyTitle>
            {query ? (
              <EmptyDescription>
                No service accounts match this search.
              </EmptyDescription>
            ) : null}
          </EmptyHeader>
        </PendingRegion>
      )}
      {serviceAccounts.length ? (
        <CollectionPagination
          disabled={updating}
          hasNextPage={hasNextPage}
          isError={loadMoreError}
          isLoading={isLoadingMore}
          label="service accounts"
          loaded={serviceAccounts.length}
          onLoadMore={onLoadMore}
          total={total}
        />
      ) : null}
    </>
  )
}

function ServiceAccountActivityFilterField() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <NativeSelect
      aria-label="Activity"
      onChange={(event) => {
        const activity = userActivityFilters.find(
          (filter) => filter === event.target.value
        )
        void navigate({
          replace: true,
          search: { ...search, activity, cursor: undefined },
          state: {},
          to: "/admin/service-accounts",
        })
      }}
      value={search.activity ?? ""}
    >
      {userActivityFilterOptions.map((option) => (
        <NativeSelectOption key={option.value} value={option.value}>
          {option.label}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  )
}
