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
import { PersonIdentity } from "@/components/crucible/person-identity"
import { PlatformRoleBadge } from "@/components/crucible/platform-role-badge"
import {
  useWorkspaceMode,
  useWorkspaceScope,
} from "@/components/crucible/workspace-provider"
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
import { crucibleKeys } from "@/data/crucible/query-keys"
import {
  serviceAccountPageLimit,
  serviceAccountsQueryOptions,
} from "@/data/crucible/service-accounts.queries"
import type {
  WorkspaceAccount,
  WorkspaceServiceAccountCredential,
  WorkspaceServiceAccountPage,
} from "@/data/crucible/workspace-source"
import { OneTimeCredentialDialog } from "@/features/service-accounts/one-time-credential-dialog"
import { ServiceAccountCreateDialog } from "@/features/service-accounts/service-account-create-dialog"

const serviceAccountSearchSchema = z.object({
  offset: z.coerce.number().int().min(0).optional().catch(undefined),
  q: z.string().trim().min(3).max(200).optional().catch(undefined),
})

export const Route = createFileRoute("/_app/admin/service-accounts/")({
  head: () => ({ meta: [{ title: "Service accounts | Crucible Hub" }] }),
  validateSearch: serviceAccountSearchSchema,
  loaderDeps: ({ search }) => ({ offset: search.offset ?? 0, query: search.q }),
  loader: async ({ cause, context, deps, parentMatchPromise }) => {
    const source = (await parentMatchPromise).loaderData
    if (!source || source.status === "unavailable") return
    const account = context.queryClient.getQueryData<WorkspaceAccount>(
      crucibleKeys.accountProfile(source.scope)
    )
    if (!account?.capabilities.can_manage_service_accounts) return
    const options = serviceAccountsQueryOptions(source.scope, {
      limit: serviceAccountPageLimit,
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
  pendingComponent: ServiceAccountsPending,
  component: ServiceAccountsPage,
})

function ServiceAccountsPage() {
  const scope = useWorkspaceScope()
  const mode = useWorkspaceMode()
  const queryClient = useQueryClient()
  const { data: account } = useSuspenseQuery(accountQueryOptions(scope))
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const offset = search.offset ?? 0
  const options = serviceAccountsQueryOptions(scope, {
    limit: serviceAccountPageLimit,
    offset,
    query: search.q,
  })
  const result = useQuery({
    ...options,
    enabled: account.capabilities.can_manage_service_accounts,
  })
  const [createOpen, setCreateOpen] = useState(false)
  const [credential, setCredential] =
    useState<WorkspaceServiceAccountCredential>()
  const [searchError, setSearchError] = useState<string>()

  if (!account.capabilities.can_manage_service_accounts) {
    return <Navigate replace to="/" />
  }

  function handleCreated(created: WorkspaceServiceAccountCredential) {
    setCredential(created)
    if (mode === "api") {
      void queryClient.invalidateQueries({
        queryKey: crucibleKeys.serviceAccountAdminQueries(scope),
      })
      return
    }
    if (offset === 0 && !search.q) {
      queryClient.setQueryData<WorkspaceServiceAccountPage>(
        options.queryKey,
        (current) =>
          current
            ? {
                ...current,
                items: [
                  {
                    email: null,
                    first_name: "",
                    is_service_account: true,
                    last_name: "",
                    platform_role: "contributor",
                    unique_id: created.unique_id,
                    username: created.username,
                  },
                  ...current.items,
                ],
                total: current.total === null ? null : current.total + 1,
              }
            : current
      )
    }
  }

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const query = String(formData.get("service-account-search") ?? "").trim()
    if (query.length > 0 && query.length < 3) {
      setSearchError("Enter at least 3 characters.")
      return
    }
    setSearchError(undefined)
    void navigate({
      search: { offset: undefined, q: query || undefined },
      state: {},
      to: "/admin/service-accounts",
    })
  }

  return (
    <PageLayout>
      <PageHeader
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <CreateResourceIcon data-icon="inline-start" />
            Create service account
          </Button>
        }
        title="Service accounts"
      />
      <form className="max-w-reading" onSubmit={submitSearch}>
        <FieldGroup>
          <Field orientation="responsive">
            <FieldLabel className="sr-only" htmlFor="service-account-search">
              Search service accounts
            </FieldLabel>
            <Input
              defaultValue={search.q ?? ""}
              id="service-account-search"
              key={search.q ?? "all"}
              name="service-account-search"
              placeholder="Search by name or username"
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
                    to: "/admin/service-accounts",
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
      {result.isPending ? (
        <CollectionTablePending label="service accounts" />
      ) : result.isError && !result.data ? (
        <CollectionLoadError
          label="Service accounts"
          retry={() => void result.refetch()}
        />
      ) : (
        <>
          {result.isError ? (
            <CollectionUpdateError
              label="Service accounts"
              preserved
              retry={() => void result.refetch()}
            />
          ) : null}
          <ServiceAccountCollection
            page={result.data}
            query={search.q}
            updating={result.isFetching}
          />
        </>
      )}
      <ServiceAccountCreateDialog
        onCreated={handleCreated}
        onOpenChange={setCreateOpen}
        open={createOpen}
        scope={scope}
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
  return (
    <PageLayout>
      <PageHeader title="Service accounts" />
      <CollectionTablePending label="service accounts" />
    </PageLayout>
  )
}

function ServiceAccountCollection({
  page,
  query,
  updating,
}: {
  page: WorkspaceServiceAccountPage
  query?: string
  updating: boolean
}) {
  const hasPrevious = page.offset > 0
  const hasNext =
    page.total === null
      ? page.items.length === page.limit
      : page.offset + page.items.length < page.total

  return (
    <>
      <CollectionUpdateStatus label="service accounts" updating={updating} />
      {page.items.length > 0 ? (
        <Card aria-busy={updating}>
          <CardContent className="px-0">
            <Table
              aria-label="Service accounts"
              className="identity-directory-table"
            >
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead>Crucible ID</TableHead>
                  <TableHead>Platform role</TableHead>
                  <TableHead className="text-center">
                    <span className="sr-only">Open</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {page.items.map((serviceAccount) => (
                  <TableRow key={serviceAccount.unique_id}>
                    <TableCell className="identity-directory-account">
                      <Link
                        className="block min-w-48"
                        params={{
                          serviceAccountMfid: serviceAccount.unique_id,
                        }}
                        to="/admin/service-accounts/$serviceAccountMfid"
                      >
                        <PersonIdentity
                          interactive
                          person={serviceAccount}
                          presentation="avatar"
                          size="sm"
                        />
                      </Link>
                    </TableCell>
                    <TableCell
                      className="identity-directory-mfid"
                      data-label="Crucible ID"
                    >
                      <MfidText value={serviceAccount.unique_id} />
                    </TableCell>
                    <TableCell
                      className="identity-directory-role"
                      data-label="Platform role"
                    >
                      <PlatformRoleBadge role={serviceAccount.platform_role} />
                    </TableCell>
                    <TableCell className="identity-directory-action text-center">
                      <Link
                        aria-label={`Open @${serviceAccount.username}`}
                        className={buttonVariants({
                          size: "table-action",
                          variant: "ghost",
                        })}
                        params={{
                          serviceAccountMfid: serviceAccount.unique_id,
                        }}
                        to="/admin/service-accounts/$serviceAccountMfid"
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
            <EmptyTitle>No service accounts found</EmptyTitle>
            {query ? (
              <EmptyDescription>
                No service accounts match this search.
              </EmptyDescription>
            ) : null}
          </EmptyHeader>
        </Empty>
      )}
      <CollectionPageNavigation
        label="Service-account pages"
        previous={
          hasPrevious ? (
            <Link
              className={buttonVariants({ variant: "outline" })}
              search={{
                offset: Math.max(0, page.offset - page.limit) || undefined,
                q: query,
              }}
              to="/admin/service-accounts"
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
              to="/admin/service-accounts"
            >
              Next
            </Link>
          ) : undefined
        }
      />
    </>
  )
}
