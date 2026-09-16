import { useQuery } from "@tanstack/react-query"
import { Link, useRouterState } from "@tanstack/react-router"

import { BrandMark } from "@/components/crucible/brand-mark"
import { CreateMenu } from "@/components/crucible/create-menu"
import { GlobalSearch } from "@/components/crucible/global-search"
import { KeyboardShortcuts } from "@/components/crucible/keyboard-shortcuts"
import { PersonIdentity } from "@/components/crucible/person-identity"
import { QrScannerAction } from "@/components/crucible/qr-scanner-action"
import {
  AccountIcon,
  CollapseSidebarIcon,
  ExpandSidebarIcon,
  ThemeIcon,
  WorkspaceIcon,
} from "@/components/crucible/icons"
import {
  PrincipalTypeIcon,
  ResourceTypeIcon,
} from "@/components/crucible/resource-type-icon"
import type { ResourceType } from "@/components/crucible/resource-type-icon"
import { ResourceSiblingNavigationProvider } from "@/components/crucible/resource-sibling-navigation"
import { useTheme } from "@/components/theme-provider"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import type { Workspace } from "@/data/crucible/workspace-source"
import type { IdentityScope } from "@/data/crucible/query-keys"
import {
  projectQueryOptions,
  projectSummaryQueryOptions,
} from "@/data/crucible/projects.queries"
import { RecentlyViewedProvider } from "@/features/recently-viewed/recently-viewed"

type NavPath = "/" | "/data" | "/projects" | "/instruments"

const primaryItems = [
  { label: "Home", to: "/", kind: "home" },
  {
    label: "Projects",
    to: "/projects",
    kind: "resource",
    resourceType: "project",
  },
  {
    label: "Data",
    to: "/data",
    kind: "resource",
    resourceType: "dataset",
  },
  {
    label: "Instruments",
    to: "/instruments",
    kind: "resource",
    resourceType: "instrument",
  },
] satisfies ReadonlyArray<{
  kind: "home" | "resource"
  label: string
  resourceType?: ResourceType
  to: NavPath
}>

export function AppShell({
  account,
  children,
  scope,
}: {
  account?: Workspace["account"]
  children: React.ReactNode
  scope?: IdentityScope
}) {
  const location = useRouterState({
    select: (state) => state.location,
  })
  const pathname = location.pathname
  const projectMfid = activeProjectMfid(pathname, location.search)

  return (
    <RecentlyViewedProvider key={account?.unique_id ?? "anonymous"}>
      <SidebarProvider>
        <Sidebar
          aria-label="Primary navigation"
          role="navigation"
          collapsible="icon"
        >
          <SidebarBrand />
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {primaryItems.map((item) => {
                    const isActive =
                      item.to === "/"
                        ? pathname === "/"
                        : item.to === "/data" &&
                            (pathname.startsWith("/datasets/") ||
                              pathname.startsWith("/samples/"))
                          ? true
                          : pathname === item.to ||
                            pathname.startsWith(`${item.to}/`)
                    return (
                      <SidebarMenuItem key={item.to}>
                        <SidebarMenuButton
                          isActive={isActive}
                          tooltip={item.label}
                          render={
                            <Link
                              aria-current={isActive ? "page" : undefined}
                              to={item.to}
                            />
                          }
                        >
                          {item.kind === "resource" ? (
                            <ResourceTypeIcon type={item.resourceType} />
                          ) : (
                            <WorkspaceIcon aria-hidden="true" />
                          )}
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            {account?.capabilities.can_manage_service_accounts ? (
              <SidebarGroup>
                <SidebarGroupLabel>Administration</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        isActive={pathname.startsWith(
                          "/admin/service-accounts"
                        )}
                        tooltip="Service accounts"
                        render={
                          <Link
                            aria-current={
                              pathname.startsWith("/admin/service-accounts")
                                ? "page"
                                : undefined
                            }
                            to="/admin/service-accounts"
                          />
                        }
                      >
                        <PrincipalTypeIcon type="service_account" />
                        <span>Service accounts</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ) : null}
          </SidebarContent>
          <SidebarUtilities
            pathname={pathname}
            projectActive={Boolean(projectMfid)}
          />
          <SidebarRail />
        </Sidebar>
        <SidebarInset>
          <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur sm:px-6">
            <SidebarTrigger className="md:hidden" />
            <AppSearch
              preferFullProject={pathname.startsWith("/projects/")}
              projectMfid={projectMfid}
              scope={scope}
            />
            <QrScannerAction />
            {account ? (
              <CreateMenu capabilities={account.capabilities} />
            ) : null}
            <div className="ml-auto border-l pl-3">
              {account ? (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        aria-label="Open account menu"
                        size="lg"
                        variant="ghost"
                      />
                    }
                  >
                    <PersonIdentity
                      detailsClassName="hidden lg:grid"
                      person={account}
                      presentation="avatar"
                      size="sm"
                    />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-48">
                    <DropdownMenuGroup>
                      <DropdownMenuLabel>Account</DropdownMenuLabel>
                      <DropdownMenuItem render={<Link to="/account" />}>
                        <AccountIcon />
                        My profile
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Avatar size="sm">
                  <AvatarFallback className="text-foreground">?</AvatarFallback>
                </Avatar>
              )}
            </div>
          </header>
          <div className="mx-auto w-full max-w-content flex-1 p-page-gutter sm:p-page-gutter-medium lg:p-page-gutter-wide">
            <ResourceSiblingNavigationProvider
              key={scope?.join(":") ?? account?.unique_id ?? "anonymous"}
            >
              {children}
            </ResourceSiblingNavigationProvider>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </RecentlyViewedProvider>
  )
}

function AppSearch({
  preferFullProject,
  projectMfid,
  scope,
}: {
  preferFullProject: boolean
  projectMfid?: string
  scope?: IdentityScope
}) {
  if (!projectMfid || !scope) return <GlobalSearch />
  return (
    <ProjectContextSearch
      preferFullProject={preferFullProject}
      projectMfid={projectMfid}
      scope={scope}
    />
  )
}

function ProjectContextSearch({
  preferFullProject,
  projectMfid,
  scope,
}: {
  preferFullProject: boolean
  projectMfid: string
  scope: IdentityScope
}) {
  return preferFullProject ? (
    <ProjectContextSearchOverview projectMfid={projectMfid} scope={scope} />
  ) : (
    <ProjectContextSearchSummary projectMfid={projectMfid} scope={scope} />
  )
}

function ProjectContextSearchOverview({
  projectMfid,
  scope,
}: {
  projectMfid: string
  scope: IdentityScope
}) {
  const { data: project } = useQuery(projectQueryOptions(scope, projectMfid))
  return <ProjectSearchAction project={project} projectMfid={projectMfid} />
}

function ProjectContextSearchSummary({
  projectMfid,
  scope,
}: {
  projectMfid: string
  scope: IdentityScope
}) {
  const { data: project } = useQuery(
    projectSummaryQueryOptions(scope, projectMfid)
  )
  return <ProjectSearchAction project={project} projectMfid={projectMfid} />
}

function ProjectSearchAction({
  project,
  projectMfid,
}: {
  project?: { project_id: string; title?: string | null } | null
  projectMfid: string
}) {
  return (
    <GlobalSearch
      projectMfid={projectMfid}
      projectName={project?.title ?? project?.project_id}
    />
  )
}

function activeProjectMfid(pathname: string, search: Record<string, unknown>) {
  const routeProjectMfid = pathname.match(/^\/projects\/([^/]+)/)?.[1]
  if (routeProjectMfid) return routeProjectMfid

  const contextualProjectMfid =
    pathname === "/search"
      ? search.projectMfid
      : /^\/(datasets|samples)\/[^/]+/.test(pathname)
        ? search.fromProject
        : undefined
  return typeof contextualProjectMfid === "string"
    ? contextualProjectMfid
    : undefined
}

function SidebarBrand() {
  const { isMobile, state } = useSidebar()
  const collapsed = !isMobile && state === "collapsed"

  return (
    <SidebarHeader className="h-14 justify-center">
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            className={collapsed ? "justify-center" : undefined}
            size="lg"
            tooltip="Crucible Hub"
            render={<Link aria-label="Crucible Hub" to="/" />}
          >
            <BrandMark
              className={collapsed ? undefined : "overflow-hidden rounded-md"}
            />
            {collapsed ? null : (
              <span className="truncate text-brand">Crucible Hub</span>
            )}
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeader>
  )
}

function SidebarUtilities({
  pathname,
  projectActive,
}: {
  pathname: string
  projectActive: boolean
}) {
  const { isMobile, state, toggleSidebar } = useSidebar()
  const { setTheme, theme } = useTheme()
  const expanded = isMobile || state === "expanded"

  return (
    <SidebarFooter>
      <SidebarMenu>
        <SidebarMenuItem>
          <KeyboardShortcuts
            pathname={pathname}
            projectActive={projectActive}
          />
        </SidebarMenuItem>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <SidebarMenuButton
                  aria-label="Theme"
                  tooltip="Theme"
                  title="Theme"
                />
              }
            >
              <ThemeIcon aria-hidden="true" />
              <span>Theme</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="right">
              <DropdownMenuRadioGroup
                onValueChange={(value) => {
                  if (
                    value === "system" ||
                    value === "light" ||
                    value === "dark"
                  ) {
                    setTheme(value)
                  }
                }}
                value={theme}
              >
                <DropdownMenuLabel>Theme</DropdownMenuLabel>
                <DropdownMenuRadioItem value="system">
                  System
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="light">
                  Light
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton
            onClick={toggleSidebar}
            tooltip={expanded ? "Collapse navigation" : "Expand navigation"}
          >
            {expanded ? (
              <CollapseSidebarIcon aria-hidden="true" />
            ) : (
              <ExpandSidebarIcon aria-hidden="true" />
            )}
            <span>
              {expanded ? "Collapse navigation" : "Expand navigation"}
            </span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>
  )
}
