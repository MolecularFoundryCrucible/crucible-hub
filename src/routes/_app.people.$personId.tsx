import { useSuspenseQuery } from "@tanstack/react-query"
import { Link, createFileRoute } from "@tanstack/react-router"

import { PageHeader } from "@/components/crucible/page-header"
import { PageLayout } from "@/components/crucible/page-layout"
import {
  PersonIdentity,
  personDisplayName,
} from "@/components/crucible/person-identity"
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
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
  pendingComponent: RouteContentPending,
  component: PersonPage,
})

function PersonPage() {
  const { personId } = Route.useParams()
  const scope = useWorkspaceScope()
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
          <BreadcrumbItem>
            <BreadcrumbPage>{name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader eyebrow="Person" title={name} />

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
              <dd className="font-mono text-identifier break-all text-muted-foreground sm:break-normal sm:whitespace-nowrap">
                {person.unique_id}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </PageLayout>
  )
}
