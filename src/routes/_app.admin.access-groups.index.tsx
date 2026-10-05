import {
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { Link, Navigate, createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import {
  CollectionLoadError,
  CollectionTablePending,
  CollectionUpdateError,
} from "@/components/crucible/collection-state"
import {
  CreateResourceIcon,
  OpenFullPageIcon,
} from "@/components/crucible/icons"
import { PageHeader } from "@/components/crucible/page-header"
import { PageLayout } from "@/components/crucible/page-layout"
import { SelectableTextLink } from "@/components/crucible/selectable-text-link"
import {
  useAdministrationScope,
  useWorkspaceMode,
  useWorkspaceScope,
} from "@/components/crucible/workspace-provider"
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
import { accessGroupsListQueryOptions } from "@/data/crucible/access-groups.queries"
import { accountQueryOptions } from "@/data/crucible/account.queries"
import { canOpenAccessGroupAdministration } from "@/data/crucible/administration"
import {
  crucibleKeys,
  identityScopeWithPrivilegeMode,
} from "@/data/crucible/query-keys"
import type {
  WorkspaceAccessGroup,
  WorkspaceAccount,
} from "@/data/crucible/workspace-source"
import { AccessGroupCreateDialog } from "@/features/admin/access-group-create-dialog"

const groupSearchSchema = z.object({
  create: z.boolean().optional().catch(undefined),
})

export const Route = createFileRoute("/_app/admin/access-groups/")({
  head: () => ({ meta: [{ title: "Access groups | Crucible Hub" }] }),
  validateSearch: groupSearchSchema,
  loader: async ({ cause, context, parentMatchPromise }) => {
    const source = (await parentMatchPromise).loaderData
    if (!source || source.status === "unavailable") return
    const account = context.queryClient.getQueryData<WorkspaceAccount>(
      crucibleKeys.accountProfile(source.scope)
    )
    if (!account || !canOpenAccessGroupAdministration(account)) return
    const administrationScope = identityScopeWithPrivilegeMode(
      source.scope,
      "elevated"
    )
    const options = accessGroupsListQueryOptions(administrationScope)
    const hasData =
      context.queryClient.getQueryData(options.queryKey) !== undefined
    const request = context.queryClient.prefetchQuery(options)
    if (cause === "stay" || hasData) {
      void request
      return
    }
    await request
  },
  pendingComponent: AccessGroupsPending,
  component: AccessGroupsAdminPage,
})

function AccessGroupsAdminPage() {
  const scope = useWorkspaceScope()
  const administrationScope = useAdministrationScope()
  const mode = useWorkspaceMode()
  const queryClient = useQueryClient()
  const { data: account } = useSuspenseQuery(accountQueryOptions(scope))
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const options = accessGroupsListQueryOptions(administrationScope)
  const result = useQuery({
    ...options,
    enabled: canOpenAccessGroupAdministration(account),
  })
  const createOpen = search.create === true

  if (!canOpenAccessGroupAdministration(account)) {
    return <Navigate replace to="/" />
  }

  function handleCreated(created: WorkspaceAccessGroup) {
    if (mode === "api") {
      void queryClient.invalidateQueries({
        queryKey: crucibleKeys.accessGroupAdminQueries(administrationScope),
      })
      return
    }
    queryClient.setQueryData<readonly WorkspaceAccessGroup[]>(
      options.queryKey,
      (current) => (current ? [created, ...current] : [created])
    )
  }

  function setCreateOpen(open: boolean) {
    void navigate({
      replace: true,
      search: { create: open ? true : undefined },
      state: {},
      to: "/admin/access-groups",
    })
  }

  const groups = result.data ?? []

  return (
    <PageLayout>
      <PageHeader
        actions={
          <Link
            className={buttonVariants()}
            search={{ create: true }}
            to="/admin/access-groups"
          >
            <CreateResourceIcon data-icon="inline-start" />
            Create access group
          </Link>
        }
        title="Access groups"
      />
      {result.isPending ? (
        <CollectionTablePending
          label="access groups"
          presentation="resources"
        />
      ) : result.isError && !result.data ? (
        <CollectionLoadError
          label="Access groups"
          retry={() => void result.refetch()}
        />
      ) : (
        <>
          {result.isError ? (
            <CollectionUpdateError
              label="Access groups"
              preserved
              retry={() => void result.refetch()}
            />
          ) : null}
          {groups.length > 0 ? (
            <Card aria-busy={result.isFetching}>
              <CardContent className="px-0">
                <Table aria-label="Access groups">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Group name</TableHead>
                      <TableHead>ID</TableHead>
                      <TableHead className="text-center">
                        <span className="sr-only">Open</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groups.map((group) => (
                      <TableRow key={group.group_name}>
                        <TableCell>
                          <SelectableTextLink
                            render={
                              <Link
                                params={{ groupName: group.group_name }}
                                to="/admin/access-groups/$groupName"
                              />
                            }
                          >
                            {group.group_name}
                          </SelectableTextLink>
                        </TableCell>
                        <TableCell className="font-mono text-muted-foreground">
                          {group.id}
                        </TableCell>
                        <TableCell className="text-center">
                          <Link
                            aria-label={`Open access group ${group.group_name}`}
                            className={buttonVariants({
                              size: "table-action",
                              variant: "ghost",
                            })}
                            params={{ groupName: group.group_name }}
                            to="/admin/access-groups/$groupName"
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
                <EmptyTitle>No access groups found</EmptyTitle>
                <EmptyDescription>
                  Create an access group to get started.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </>
      )}
      <AccessGroupCreateDialog
        onCreated={handleCreated}
        onOpenChange={setCreateOpen}
        open={createOpen}
        scope={administrationScope}
      />
    </PageLayout>
  )
}

function AccessGroupsPending() {
  return (
    <PageLayout>
      <PageHeader title="Access groups" />
      <CollectionTablePending label="access groups" presentation="resources" />
    </PageLayout>
  )
}
