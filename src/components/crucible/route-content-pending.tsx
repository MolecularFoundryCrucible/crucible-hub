import { Link } from "@tanstack/react-router"

import { ApiCredentialCard } from "@/components/crucible/api-credential-card"
import { ContentBoundary } from "@/components/crucible/content-layout"
import {
  PageHeader,
  PageHeaderSkeleton,
} from "@/components/crucible/page-header"
import { PageLayout } from "@/components/crucible/page-layout"
import {
  CollectionTablePending,
  ResourceListPending,
} from "@/components/crucible/collection-state"
import { PrincipalTypeIcon } from "@/components/crucible/resource-type-icon"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export function IdentityDetailPending({
  kind,
}: {
  kind: "person" | "service_account"
}) {
  const serviceAccount = kind === "service_account"
  return (
    <PageLayout>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink
              render={
                serviceAccount ? (
                  <Link to="/admin/service-accounts" />
                ) : (
                  <Link search={{ kind: "person" }} to="/search" />
                )
              }
            >
              {serviceAccount ? "Service accounts" : "People"}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem className="min-w-0 flex-1 shrink">
            <BreadcrumbPage>
              <Skeleton className="h-5 w-40 max-w-full" />
              <span className="sr-only">Loading account name</span>
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <PageHeaderSkeleton
        icon={
          <PrincipalTypeIcon
            className="mt-1 size-6 shrink-0"
            type={serviceAccount ? "service_account" : "user"}
          />
        }
      />
      <IdentityDetailContentPending kind={kind} />
    </PageLayout>
  )
}

export function IdentityDetailContentPending({
  kind,
}: {
  kind: "person" | "service_account"
}) {
  const serviceAccount = kind === "service_account"
  const fields = serviceAccount
    ? ["Username", "Platform role", "Crucible ID", "Last active"]
    : [
        "Username",
        "Platform role",
        "Email",
        "Crucible ID / ORCID",
        "Last active",
      ]
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <Card aria-busy="true">
          <CardHeader>
            <CardTitle>Identity</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <PendingPrincipalIdentity />
            <dl className="grid grid-cols-2 gap-4">
              {fields.map((label) => (
                <div
                  className={
                    label === "Email" || label.startsWith("Crucible ID")
                      ? "col-span-2 grid gap-1 sm:col-span-1"
                      : "grid gap-1"
                  }
                  key={label}
                >
                  <dt className="text-label text-muted-foreground">{label}</dt>
                  <dd>
                    <Skeleton className="h-5 w-32" />
                  </dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
        <ApiCredentialCard loading />
      </div>
      {!serviceAccount ? (
        <Card aria-busy="true">
          <CardHeader>
            <CardTitle>Projects</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <CollectionTablePending
              framed={false}
              label="user projects"
              presentation="user-projects"
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

function PendingPrincipalIdentity() {
  return (
    <div className="flex items-center gap-3">
      <Skeleton className="size-12 rounded-full" />
      <div className="grid flex-1 gap-2">
        <Skeleton className="h-5 w-40 max-w-full" />
        <Skeleton className="h-4 w-28 max-w-full" />
      </div>
    </div>
  )
}

export function SearchRoutePending() {
  return (
    <PageLayout>
      <PageHeader title="Find anything in Crucible" />
      <ContentBoundary width="reading">
        <div aria-label="Loading search" className="flex gap-2" role="status">
          <Skeleton className="h-8 flex-1" />
          <Skeleton className="h-8 w-24" />
        </div>
      </ContentBoundary>
      <div className="flex gap-2">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton className="h-8 w-20" key={index} />
        ))}
      </div>
      <Card aria-busy="true">
        <CardHeader>
          <CardTitle>Search results</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <ResourceListPending label="search results" />
        </CardContent>
      </Card>
    </PageLayout>
  )
}
