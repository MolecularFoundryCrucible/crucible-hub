import { useState } from "react"
import {
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { Link, Navigate, createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import {
  CreateResourceIcon,
  OpenFullPageIcon,
  SearchIcon,
} from "@/components/crucible/icons"
import { MfidText } from "@/components/crucible/mfid-text"
import { PageHeader } from "@/components/crucible/page-header"
import { PageLayout } from "@/components/crucible/page-layout"
import {
  PersonIdentity,
  personDisplayName,
} from "@/components/crucible/person-identity"
import { SelectableTextLink } from "@/components/crucible/selectable-text-link"
import {
  useAdministrationScope,
  useWorkspaceMode,
  useWorkspaceScope,
} from "@/components/crucible/workspace-provider"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
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
import { CollectionPageNavigation } from "@/components/crucible/collection-page-navigation"
import { accountQueryOptions } from "@/data/crucible/account.queries"
import { canOpenUserAdministration } from "@/data/crucible/administration"
import {
  crucibleKeys,
  identityScopeWithPrivilegeMode,
} from "@/data/crucible/query-keys"
import {
  userAdminPageLimit,
  usersListQueryOptions,
} from "@/data/crucible/users.queries"
import type {
  WorkspaceAccount,
  WorkspaceAdminUser,
  WorkspaceAdminUserPage,
} from "@/data/crucible/workspace-source"
import { UserCreateDialog } from "@/features/admin/user-create-dialog"
import { formatUsername } from "@/lib/username"

const userSearchSchema = z.object({
  create: z.boolean().optional().catch(undefined),
  offset: z.coerce.number().int().min(0).optional().catch(undefined),
  q: z.string().trim().min(3).max(200).optional().catch(undefined),
})

export const Route = createFileRoute("/_app/admin/users/")({
  head: () => ({ meta: [{ title: "Users | Crucible Hub" }] }),
  validateSearch: userSearchSchema,
  loaderDeps: ({ search }) => ({ offset: search.offset ?? 0, query: search.q }),
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
    const options = usersListQueryOptions(administrationScope, {
      limit: userAdminPageLimit,
      ...deps,
    })
    const hasData =
      context.queryClient.getQueryData(options.queryKey) !== undefined
    const request = context.queryClient.prefetchQuery(options)
    if (cause === "stay" || hasData) {
      void request
      return
    }
    await request
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
  const offset = search.offset ?? 0
  const options = usersListQueryOptions(administrationScope, {
    limit: userAdminPageLimit,
    offset,
    query: search.q,
  })
  const result = useQuery({
    ...options,
    enabled: canOpenUserAdministration(account),
  })
  const createOpen = search.create === true

  if (!canOpenUserAdministration(account)) {
    return <Navigate replace to="/" />
  }

  function handleCreated(created: WorkspaceAdminUser) {
    if (mode === "api") {
      void queryClient.invalidateQueries({
        queryKey: crucibleKeys.userAdminQueries(administrationScope),
      })
      return
    }
    if (offset === 0 && !search.q) {
      queryClient.setQueryData<WorkspaceAdminUserPage>(
        options.queryKey,
        (current) =>
          current
            ? {
                ...current,
                items: [created, ...current.items],
                total: current.total === null ? null : current.total + 1,
              }
            : current
      )
    }
  }

  function setCreateOpen(open: boolean) {
    void navigate({
      replace: true,
      search: {
        create: open ? true : undefined,
        offset: search.offset,
        q: search.q,
      },
      state: {},
      to: "/admin/users",
    })
  }

  return (
    <PageLayout>
      <UsersPageHeader canCreate />
      <UserSearchForm />
      {result.isPending ? (
        <CollectionTablePending label="users" presentation="service-accounts" />
      ) : result.isError && !result.data ? (
        <CollectionLoadError
          label="Users"
          retry={() => void result.refetch()}
        />
      ) : (
        <>
          {result.isError ? (
            <CollectionUpdateError
              label="Users"
              preserved
              retry={() => void result.refetch()}
            />
          ) : null}
          <UserCollection
            page={result.data}
            query={search.q}
            updating={result.isFetching}
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
      <UserSearchForm />
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
            search={{ create: true, offset: search.offset, q: search.q }}
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

function UserSearchForm() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const [searchError, setSearchError] = useState<string>()

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const query = String(formData.get("user-search") ?? "").trim()
    if (query.length > 0 && query.length < 3) {
      setSearchError("Enter at least 3 characters.")
      return
    }
    setSearchError(undefined)
    void navigate({
      search: { offset: undefined, q: query || undefined },
      state: {},
      to: "/admin/users",
    })
  }

  return (
    <form className="max-w-reading" onSubmit={submitSearch}>
      <FieldGroup>
        <Field orientation="responsive">
          <FieldLabel className="sr-only" htmlFor="user-search">
            Search users
          </FieldLabel>
          <Input
            defaultValue={search.q ?? ""}
            id="user-search"
            key={search.q ?? "all"}
            name="user-search"
            placeholder="Search by name, username, or email"
            type="search"
          />
          <Button type="submit" variant="outline">
            <SearchIcon data-icon="inline-start" />
            Search
          </Button>
          {search.q ? (
            <Button
              onClick={() => {
                setSearchError(undefined)
                void navigate({
                  search: { offset: undefined, q: undefined },
                  state: {},
                  to: "/admin/users",
                })
              }}
              type="button"
              variant="ghost"
            >
              Clear
            </Button>
          ) : null}
        </Field>
      </FieldGroup>
      {searchError ? (
        <p className="mt-2 text-body text-destructive" role="alert">
          {searchError}
        </p>
      ) : null}
    </form>
  )
}

function UserCollection({
  page,
  query,
  updating,
}: {
  page?: WorkspaceAdminUserPage
  query?: string
  updating: boolean
}) {
  if (!page) return null
  const hasPrevious = page.offset > 0
  const hasNext =
    page.total === null
      ? page.items.length === page.limit
      : page.offset + page.items.length < page.total

  return (
    <>
      <CollectionUpdateStatus label="users" updating={updating} />
      {page.items.length > 0 ? (
        <Card aria-busy={updating}>
          <CardContent className="px-0">
            <Table
              aria-label="Users directory"
              className="identity-directory-table"
            >
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Crucible ID</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-center">
                    <span className="sr-only">Open</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {page.items.map((user) => (
                  <TableRow key={user.unique_id}>
                    <TableCell className="identity-directory-account">
                      <PersonIdentity
                        className="min-w-48"
                        nameContent={
                          <SelectableTextLink
                            className="block"
                            render={
                              <Link
                                params={{ userMfid: user.unique_id }}
                                to="/admin/users/$userMfid"
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
                    <TableCell data-label="Email">
                      {"email" in user && user.email ? (
                        <span className="text-body">{user.email}</span>
                      ) : (
                        <span className="text-body text-muted-foreground">
                          None
                        </span>
                      )}
                    </TableCell>
                    <TableCell data-label="Type">
                      <Badge
                        variant={
                          user.is_service_account ? "secondary" : "outline"
                        }
                      >
                        {user.is_service_account ? "Service account" : "User"}
                      </Badge>
                    </TableCell>
                    <TableCell className="identity-directory-action text-center">
                      <Link
                        aria-label={`Open user ${formatUsername(user.username, "raw")}`}
                        className={buttonVariants({
                          size: "table-action",
                          variant: "ghost",
                        })}
                        params={{ userMfid: user.unique_id }}
                        to="/admin/users/$userMfid"
                      >
                        <OpenFullPageIcon aria-hidden="true" />
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
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
      <CollectionPageNavigation
        label="User pages"
        previous={
          hasPrevious ? (
            <Link
              className={buttonVariants({ variant: "outline" })}
              search={{
                offset: Math.max(0, page.offset - page.limit) || undefined,
                q: query,
              }}
              to="/admin/users"
            >
              Previous
            </Link>
          ) : undefined
        }
        next={
          hasNext ? (
            <Link
              className={buttonVariants({ variant: "outline" })}
              search={{ offset: page.offset + page.limit, q: query }}
              to="/admin/users"
            >
              Next
            </Link>
          ) : undefined
        }
      />
    </>
  )
}
