import { useMemo } from "react"
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { Link, Navigate, createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import {
  CreateResourceIcon,
  OpenFullPageIcon,
} from "@/components/crucible/icons"
import { DirectorySearchField } from "@/components/crucible/directory-search-field"
import { MfidText } from "@/components/crucible/mfid-text"
import { PageHeader } from "@/components/crucible/page-header"
import { PageLayout } from "@/components/crucible/page-layout"
import {
  PersonIdentity,
  personDisplayName,
} from "@/components/crucible/person-identity"
import { PlatformRoleBadge } from "@/components/crucible/platform-role-badge"
import { SelectableTextLink } from "@/components/crucible/selectable-text-link"
import { SortableTableHead } from "@/components/crucible/sortable-table-head"
import {
  useAdministrationScope,
  useWorkspaceMode,
  useWorkspaceScope,
} from "@/components/crucible/workspace-provider"
import { CollectionPagination } from "@/components/crucible/collection-pagination"
import { buttonVariants } from "@/components/ui/button"
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

const userSortFieldSchema = z.enum(["account", "unique_id", "email"])
export type UserSortField = z.infer<typeof userSortFieldSchema>

function apiUserSort(sort: UserSortField | undefined) {
  if (sort === "account") return "name" as const
  return sort
}

const userSearchSchema = z.object({
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
    if (!account || !canOpenUserAdministration(account)) return
    const administrationScope = identityScopeWithPrivilegeMode(
      source.scope,
      "elevated"
    )
    const options = usersCursorQueryOptions(administrationScope, {
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

function UsersAdminPage() {
  const scope = useWorkspaceScope()
  const administrationScope = useAdministrationScope()
  const mode = useWorkspaceMode()
  const queryClient = useQueryClient()
  const { data: account } = useSuspenseQuery(accountQueryOptions(scope))
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const sort = search.sort ?? "account"
  const direction = search.direction ?? "asc"
  const result = useInfiniteQuery(
    usersCursorQueryOptions(administrationScope, {
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

  if (!canOpenUserAdministration(account)) {
    return <Navigate replace to="/" />
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
      <UserSearchField />
      {result.isPending ? (
        <CollectionTablePending label="users" presentation="service-accounts" />
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
  const { data: account } = useQuery(accountQueryOptions(scope))
  return (
    <PageLayout>
      <UsersPageHeader
        canCreate={account ? canOpenUserAdministration(account) : false}
      />
      <UserSearchField />
      <CollectionTablePending label="users" presentation="service-accounts" />
    </PageLayout>
  )
}

function UsersPageHeader({ canCreate }: { canCreate: boolean }) {
  const search = Route.useSearch()
  return (
    <PageHeader
      actions={
        canCreate ? (
          <Link
            className={buttonVariants()}
            search={{
              create: true,
              cursor: undefined,
              direction: search.direction,
              q: search.q,
              sort: search.sort,
            }}
            to="/admin/users"
          >
            <CreateResourceIcon data-icon="inline-start" />
            Create user
          </Link>
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
              className="identity-directory-table"
            >
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
                  <SortableTableHead
                    active={sort === "email"}
                    direction={direction}
                    field="email"
                    label="Email"
                    onChange={onSortChange}
                    preferredDirection="asc"
                  />
                  <TableHead>Platform role</TableHead>
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
                          className="min-w-0 sm:min-w-48"
                          nameContent={
                            <SelectableTextLink
                              className="block"
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
                        <MfidText value={user.unique_id} />
                      </TableCell>
                      <TableCell
                        className="identity-directory-email"
                        data-label="Email"
                      >
                        {user.email ? (
                          <span className="text-body break-words">
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
                        kind="action"
                        className="identity-directory-action"
                      >
                        <Link
                          aria-label={`Open user ${formatUsername(user.username, "raw")}`}
                          className={buttonVariants({
                            size: "table-action",
                            variant: "ghost",
                          })}
                          params={{ userId: user.unique_id }}
                          to="/users/$userId"
                        >
                          <OpenFullPageIcon aria-hidden="true" />
                        </Link>
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
