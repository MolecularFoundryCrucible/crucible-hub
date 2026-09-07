import { useSuspenseQuery } from "@tanstack/react-query"
import { Link, createFileRoute } from "@tanstack/react-router"

import { PageHeader } from "@/components/crucible/page-header"
import { PageLayout } from "@/components/crucible/page-layout"
import { RouteContentPending } from "@/components/crucible/route-content-pending"
import { useWorkspaceScope } from "@/components/crucible/workspace-provider"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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
import { initials } from "@/lib/format"

export const Route = createFileRoute("/_app/people/$personId")({
  loader: async ({ context, params, parentMatchPromise }) => {
    const source = (await parentMatchPromise).loaderData
    if (!source || source.status === "unavailable") return
    await context.queryClient.ensureQueryData(
      personQueryOptions(source.scope, params.personId)
    )
  },
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

  const name = `${person.first_name} ${person.last_name}`

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
        <CardHeader className="flex-row items-center gap-4">
          <Avatar className="size-14">
            <AvatarFallback>
              {initials(person.first_name, person.last_name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <CardTitle>{name}</CardTitle>
            <CardDescription>
              {person.username ? `@${person.username}` : "No username provided"}
            </CardDescription>
          </div>
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
