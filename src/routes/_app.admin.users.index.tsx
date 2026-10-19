import { useMemo } from "react"
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { Link, createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import { DirectorySearchField } from "@/components/crucible/directory-search-field"
import { MfidText } from "@/components/crucible/mfid-text"
import { PageHeader } from "@/components/crucible/page-header"
import { PageLayout } from "@/components/crucible/page-layout"
import {
  PersonIdentity,
  personDisplayName,
} from "@/components/crucible/person-identity"
import { PlatformRoleBadge } from "@/components/crucible/platform-role-badge"
import { ResourceCreationLink } from "@/components/crucible/resource-creation-actions"
import { ResourceFullPageLink } from "@/components/crucible/resource-full-page-link"
import { SelectableTextLink } from "@/components/crucible/selectable-text-link"
import { SortableTableHead } from "@/components/crucible/sortable-table-head"
import { TableSortControl } from "@/components/crucible/table-sort-control"
import type { TableSortField } from "@/components/crucible/table-sort-control"
import {
  useAdministrationScope,
  useWorkspacePrivilegeMode,
  useWorkspaceMode,
  useWorkspaceScope,
} from "@/components/crucible/workspace-provider"
import { CollectionPagination } from "@/components/crucible/collection-pagination"
import { Card, CardContent } from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
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
import { canOpenUserAdministration } from "@/data/crucible/administration"
import { AdministrationUnavailable } from "@/components/crucible/administrator-view-required"
import type { SortDirection } from "@/data/crucible/collection-query"
import {
  collectionCursorSchema,
  sortDirectionSchema,
} from "@/data/crucible/collection-query"
import {
  crucibleKeys,
  identityScopeWithPrivilegeMode,
} from "@/data/crucible/query-keys"
import {
  cursorPageTotal,
  flattenCursorPages,
} from "@/data/crucible/cursor-pages"
import {
  userAdminPageLimit,
  usersCursorQueryOptions,
} from "@/data/crucible/users.queries"
import type {
  WorkspaceAccount,
  WorkspaceAdminUser,
} from "@/data/crucible/workspace-source"
import { prefetchInfiniteQueryWithReadableCache } from "@/data/query-prefetch"
import { UserCreateDialog } from "@/features/admin/user-create-dialog"
import { formatUsername } from "@/lib/username"
import { ActivityTime } from "@/components/crucible/activity-time"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import {
  userActivityFilterOptions,
  userActivityFilters,
} from "@/data/crucible/user-activity"

const userSortFieldSchema = z.enum([
  "account",
  "unique_id",
  "email",
  "last_active",
])
export type UserSortField = z.infer<typeof userSortFieldSchema>

function apiUserSort(sort: UserSortField | undefined) {
  if (sort === "account") return "name" as const
  return sort
}

const userSearchSchema = z.object({
  activity: z.enum(userActivityFilters).optional().catch(undefined),
  create: z.boolean().optional().catch(undefined),
  cursor: collectionCursorSchema,
  direction: sortDirectionSchema.optional().catch(undefined),
  q: z.string().trim().min(3).max(200).optional().catch(undefined),
  sort: userSortFieldSchema.optional().catch(undefined),
})

export const Route = createFileRoute("/_app/admin/users/")({
  head: () => ({ meta: [{ title: "Users | Crucible Hub" }] }),
  validateSearch: userSearchSchema,
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
    if (!account || !canOpenUserAdministration(account, source.privilegeMode))
      return
    const administrationScope = identityScopeWithPrivilegeMode(
      source.scope,
      "elevated"
    )
    const options = usersCursorQueryOptions(administrationScope, {
      activity: deps.activity,
      cursor: deps.cursor,
      direction: deps.direction,
      includeTotal: true,
      is_service_account: false,
      limit: userAdminPageLimit,
      query: deps.query,
      sort: apiUserSort(deps.sort),
    })
    const request = prefetchInfiniteQueryWithReadableCache(
      context.queryClient,
      options
    )
    if (cause !== "stay" && request) await request
  },
  pendingComponent: UsersPending,
  component: UsersAdminPage,
})

const sortFields = [
  { field: "account", label: "Account", preferredDirection: "asc" },
  { field: "unique_id", label: "Crucible ID", preferredDirection: "asc" },
  { field: "email", label: "Email", preferredDirection: "asc" },
  { field: "last_active", kind: "date", label: "Last active" },
] as const satisfies readonly TableSortField<UserSortField>[]

function UsersAdminPage() {
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
  const result = useInfiniteQuery(
    usersCursorQueryOptions(administrationScope, {
      activity: search.activity,
      cursor: search.cursor,
      direction,
      includeTotal: true,
      is_service_account: false,
      limit: userAdminPageLimit,
      query: search.q,
      sort: apiUserSort(sort),
    })
  )
  const users = useMemo(
    () => flattenCursorPages(result.data?.pages),
    [result.data]
  )
  const total = cursorPageTotal(result.data?.pages)
  const updating = result.isFetching && !result.isFetchingNextPage
  const createOpen = search.create === true

  if (!canOpenUserAdministration(account, privilegeMode)) {
    return (
      <AdministrationUnavailable
        account={account}
        description="Turn on administrator view to find, create, and manage Crucible users."
        title="Users"
      />
    )
  }

  function handleCreated() {
    if (mode !== "api") return
    void queryClient.invalidateQueries({
      queryKey: crucibleKeys.userAdminQueries(administrationScope),
    })
  }

  function handleSortChange(
    nextField: UserSortField,
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
      to: "/admin/users",
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
      to: "/admin/users",
    })
  }

  return (
    <PageLayout>
      <UsersPageHeader canCreate />
      <div className="flex flex-wrap items-center gap-3">
        <UserSearchField />
        <UserActivityFilterField />
      </div>
      {result.isPending ? (
        <CollectionTablePending label="users" presentation="users" />
      ) : result.isError && !result.data ? (
        <CollectionLoadError
          label="Users"
          retry={() => void result.refetch()}
        />
      ) : (
        <>
          {result.isError && !result.isFetchNextPageError ? (
            <CollectionUpdateError
              label="Users"
              preserved
              retry={() => void result.refetch()}
            />
          ) : null}
          <UserCollection
            direction={direction}
            hasNextPage={Boolean(result.hasNextPage)}
            isLoadingMore={result.isFetchingNextPage}
            loadMoreError={result.isFetchNextPageError}
            onSortChange={handleSortChange}
            onLoadMore={() => void result.fetchNextPage()}
            query={search.q}
            sort={sort}
            total={total}
            updating={updating}
            users={users}
          />
        </>
      )}
      <UserCreateDialog
        onCreated={handleCreated}
        onOpenChange={setCreateOpen}
        open={createOpen}
        scope={administrationScope}
      />
    </PageLayout>
  )
}

function UsersPending() {
  const scope = useWorkspaceScope()
  const privilegeMode = useWorkspacePrivilegeMode()
  const { data: account } = useQuery(accountQueryOptions(scope))
  return (
    <PageLayout>
      <UsersPageHeader
        canCreate={
          account ? canOpenUserAdministration(account, privilegeMode) : false
        }
      />
      <div className="flex flex-wrap items-center gap-3">
        <UserSearchField />
        <UserActivityFilterField />
      </div>
      <CollectionTablePending label="users" presentation="users" />
    </PageLayout>
  )
}

function UsersPageHeader({ canCreate }: { canCreate: boolean }) {
  const search = Route.useSearch()
  return (
    <PageHeader
      actions={
        canCreate ? (
          <ResourceCreationLink
            label="Create user"
            render={
              <Link
                search={{
                  create: true,
                  cursor: undefined,
                  direction: search.direction,
                  q: search.q,
                  sort: search.sort,
                }}
                to="/admin/users"
              />
            }
          />
        ) : null
      }
      title="Users"
    />
  )
}

function UserSearchField() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()

  return (
    <DirectorySearchField
      label="Search users"
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
          to: "/admin/users",
        })
      }}
      placeholder="Search by name, username, or email"
      query={search.q}
    />
  )
}

function UserCollection({
  direction = "asc",
  hasNextPage,
  isLoadingMore,
  loadMoreError,
  onSortChange,
  onLoadMore,
  query,
  sort,
  total,
  updating,
  users,
}: {
  direction?: SortDirection
  hasNextPage: boolean
  isLoadingMore: boolean
  loadMoreError: boolean
  onSortChange: (field: UserSortField, direction: SortDirection) => void
  onLoadMore: () => void
  query?: string
  sort?: UserSortField
  total: number | null
  updating: boolean
  users: readonly WorkspaceAdminUser[]
}) {
  return (
    <>
      <CollectionUpdateStatus label="users" updating={updating} />
      {users.length > 0 ? (
        <Card aria-busy={updating}>
          <CardContent className="px-0">
            <Table
              aria-label="Users directory"
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
                <col className="identity-directory-mfid-column" />
                <col className="identity-directory-email-column" />
                <col className="identity-directory-role-column" />
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
                    className="identity-directory-mfid"
                    direction={direction}
                    field="unique_id"
                    label="Crucible ID"
                    onChange={onSortChange}
                    preferredDirection="asc"
                  />
                  <SortableTableHead
                    active={sort === "email"}
                    direction={direction}
                    field="email"
                    label="Email"
                    onChange={onSortChange}
                    preferredDirection="asc"
                  />
                  <TableHead className="identity-directory-role">
                    Platform role
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
                {users.map((user) => {
                  return (
                    <TableRow key={user.unique_id}>
                      <TableCell className="identity-directory-account">
                        <PersonIdentity
                          className="min-w-0"
                          nameContent={
                            <SelectableTextLink
                              className="block truncate"
                              render={
                                <Link
                                  params={{ userId: user.unique_id }}
                                  to="/users/$userId"
                                />
                              }
                            >
                              {personDisplayName(user)}
                            </SelectableTextLink>
                          }
                          person={user}
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
                          title={user.unique_id}
                          value={user.unique_id}
                        />
                      </TableCell>
                      <TableCell
                        className="identity-directory-email"
                        data-label="Email"
                      >
                        {user.email ? (
                          <span className="block truncate text-body">
                            {user.email}
                          </span>
                        ) : (
                          <span className="text-body text-muted-foreground">
                            None
                          </span>
                        )}
                      </TableCell>
                      <TableCell
                        className="identity-directory-role"
                        data-label="Platform role"
                      >
                        {user.platform_role ? (
                          <PlatformRoleBadge role={user.platform_role} />
                        ) : (
                          <span className="text-body text-muted-foreground">
                            None
                          </span>
                        )}
                      </TableCell>
                      <TableCell
                        className="identity-directory-activity"
                        data-label="Last active"
                        kind="date"
                      >
                        <ActivityTime
                          fallback="Never"
                          value={user.last_active_at}
                        />
                      </TableCell>
                      <TableCell
                        kind="action"
                        className="identity-directory-action"
                      >
                        <ResourceFullPageLink
                          kind="user"
                          mfid={user.unique_id}
                          name={formatUsername(user.username, "raw")}
                          presentation="table"
                        />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Empty className="min-h-state border">
          <EmptyHeader>
            <EmptyTitle>No users found</EmptyTitle>
            {query ? (
              <EmptyDescription>No users match this search.</EmptyDescription>
            ) : null}
          </EmptyHeader>
        </Empty>
      )}
      {users.length ? (
        <CollectionPagination
          disabled={updating}
          hasNextPage={hasNextPage}
          isError={loadMoreError}
          isLoading={isLoadingMore}
          label="users"
          loaded={users.length}
          onLoadMore={onLoadMore}
          total={total}
        />
      ) : null}
    </>
  )
}

function UserActivityFilterField() {
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
          to: "/admin/users",
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
