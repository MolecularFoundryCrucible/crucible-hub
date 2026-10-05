import { useSuspenseQuery } from "@tanstack/react-query"
import { Link, Navigate, createFileRoute } from "@tanstack/react-router"

import { SystemHealthIcon } from "@/components/crucible/icons"
import { PageHeader } from "@/components/crucible/page-header"
import { PageLayout } from "@/components/crucible/page-layout"
import { useWorkspaceScope } from "@/components/crucible/workspace-provider"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { accountQueryOptions } from "@/data/crucible/account.queries"
import { canOpenSystemDiagnostics } from "@/data/crucible/administration"
import { SystemDiagnosticsCard } from "@/features/admin/system-diagnostics-card"

export const Route = createFileRoute("/_app/admin/system")({
  head: () => ({ meta: [{ title: "System diagnostics | Crucible Hub" }] }),
  component: SystemDiagnosticsAdminPage,
})

function SystemDiagnosticsAdminPage() {
  const scope = useWorkspaceScope()
  const { data: account } = useSuspenseQuery(accountQueryOptions(scope))

  if (!canOpenSystemDiagnostics(account)) {
    return <Navigate replace to="/" />
  }

  return (
    <PageLayout>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link to="/admin" />}>
              Administration
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>System diagnostics</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <PageHeader
        description="Live operational metrics, readiness probe diagnostics, and schema revision state."
        icon={<SystemHealthIcon aria-hidden="true" />}
        title="System diagnostics"
      />
      <div className="flex flex-col gap-6">
        <SystemDiagnosticsCard />
      </div>
    </PageLayout>
  )
}
