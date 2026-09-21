import { useSuspenseQuery } from "@tanstack/react-query"
import { Link, createFileRoute } from "@tanstack/react-router"

import { PageHeader } from "@/components/crucible/page-header"
import { PageLayout } from "@/components/crucible/page-layout"
import { MfidValue } from "@/components/crucible/mfid-value"
import {
  PersonIdentity,
  personDisplayName,
} from "@/components/crucible/person-identity"
import { PrincipalTypeIcon } from "@/components/crucible/resource-type-icon"
import { IdentityDetailPending } from "@/components/crucible/route-content-pending"
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
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { buttonVariants } from "@/components/ui/button"
import { accountQueryOptions } from "@/data/crucible/account.queries"
import { personQueryOptions } from "@/data/crucible/people.queries"
import { hubPageTitle } from "@/lib/page-title"

export const Route = createFileRoute("/_app/people/$personId")({
  loader: async ({ context, params, parentMatchPromise }) => {
    const source = (await parentMatchPromise).loaderData
    if (!source || source.status === "unavailable") return
    const person = await context.queryClient.ensureQueryData(
      personQueryOptions(source.scope, params.personId)
    )
    return {
      personName: person ? personDisplayName(person) : undefined,
    }
  },
  head: ({ loaderData }) => ({
    meta: [{ title: hubPageTitle(loaderData?.personName) }],
  }),
  pendingComponent: () => <IdentityDetailPending kind="person" />,
  component: PersonPage,
})

function PersonPage() {
  const { personId } = Route.useParams()
  const scope = useWorkspaceScope()
  const { data: account } = useSuspenseQuery(accountQueryOptions(scope))
  const { data: person } = useSuspenseQuery(personQueryOptions(scope, personId))

  if (!person) {
    return (
      <Card className="mx-auto mt-16 max-w-state">
        <CardHeader>
          <CardTitle>Person not found</CardTitle>
          <CardDescription>
            This public profile is not available in the current workspace.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const name = personDisplayName(person)

  return (
    <PageLayout>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink
              render={<Link search={{ kind: "person" }} to="/search" />}
            >
              People
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem className="min-w-0 flex-1 shrink">
            <BreadcrumbPage>{name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader
        actions={
          person.is_service_account &&
          account.capabilities.can_manage_service_accounts &&
          !account.is_service_account ? (
            <Link
              className={buttonVariants({ variant: "outline" })}
              params={{ serviceAccountMfid: person.unique_id }}
              to="/admin/service-accounts/$serviceAccountMfid"
            >
              <PrincipalTypeIcon
                data-icon="inline-start"
                type="service_account"
              />
              Manage service account
            </Link>
          ) : null
        }
        icon={
          <PrincipalTypeIcon
            className="mt-1 size-6 shrink-0"
            type={person.is_service_account ? "service_account" : "user"}
          />
        }
        title={name}
      />

      <Card className="max-w-2xl">
        <CardHeader>
          <PersonIdentity person={person} presentation="avatar" size="lg" />
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <dt className="text-label">Username</dt>
              <dd className="text-body text-muted-foreground">
                {person.username ?? "Not provided"}
              </dd>
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <dt className="text-label">Crucible ID</dt>
              <dd>
                <MfidValue value={person.unique_id} />
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </PageLayout>
  )
}
