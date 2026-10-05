import { useSuspenseQuery } from "@tanstack/react-query"
import { Link, Navigate, createFileRoute } from "@tanstack/react-router"

import {
  JoinRequestIcon,
  OpenFullPageIcon,
  PersonIcon,
  SystemHealthIcon,
  UserGroupIcon,
} from "@/components/crucible/icons"
import { PageHeader } from "@/components/crucible/page-header"
import { PageLayout } from "@/components/crucible/page-layout"
import { PrincipalTypeIcon } from "@/components/crucible/resource-type-icon"
import { useWorkspaceScope } from "@/components/crucible/workspace-provider"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { accountQueryOptions } from "@/data/crucible/account.queries"
import { canOpenPlatformAdministration } from "@/data/crucible/administration"
import { SystemDiagnosticsCard } from "@/features/admin/system-diagnostics-card"

export const Route = createFileRoute("/_app/admin/")({
  head: () => ({ meta: [{ title: "Administration | Crucible Hub" }] }),
  component: AdminOverviewPage,
})

const adminModules = [
  {
    description:
      "Manage user directory, create accounts, edit profile metadata, provision API keys, and review project memberships.",
    href: "/admin/users" as const,
    icon: <PersonIcon aria-hidden="true" className="size-5" />,
    title: "Users",
  },
  {
    description:
      "Manage programmatic service accounts, configure platform roles, and rotate API credentials.",
    href: "/admin/service-accounts" as const,
    icon: <PrincipalTypeIcon type="service_account" />,
    title: "Service accounts",
  },
  {
    description:
      "Inspect access groups, create new groups, and audit assigned user memberships.",
    href: "/admin/access-groups" as const,
    icon: <UserGroupIcon aria-hidden="true" className="size-5" />,
    title: "Access groups",
  },
  {
    description:
      "Review platform-wide pending join requests with notes and approve or reject access.",
    href: "/admin/join-requests" as const,
    icon: <JoinRequestIcon aria-hidden="true" className="size-5" />,
    title: "Join requests",
  },
  {
    description:
      "Inspect live API version, git commit, database latency, and applied schema revisions.",
    href: "/admin/system" as const,
    icon: <SystemHealthIcon aria-hidden="true" className="size-5" />,
    title: "System diagnostics",
  },
]

function AdminOverviewPage() {
  const scope = useWorkspaceScope()
  const { data: account } = useSuspenseQuery(accountQueryOptions(scope))

  if (!canOpenPlatformAdministration(account)) {
    return <Navigate replace to="/" />
  }

  return (
    <PageLayout>
      <PageHeader
        description="Platform administration tools, directory management, and system diagnostics."
        title="Administration"
      />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {adminModules.map((m) => (
          <Card className="flex flex-col justify-between" key={m.href}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {m.icon}
                {m.title}
              </CardTitle>
              <CardDescription className="mt-2 text-body">
                {m.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Link
                className="inline-flex items-center gap-1.5 text-brand text-label hover:underline"
                to={m.href}
              >
                Open {m.title}
                <OpenFullPageIcon aria-hidden="true" className="size-4" />
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="mt-4">
        <SystemDiagnosticsCard />
      </div>
    </PageLayout>
  )
}
