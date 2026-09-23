import { useQuery } from "@tanstack/react-query"
import { Link, useRouterState } from "@tanstack/react-router"

import { BrandMark } from "@/components/crucible/brand-mark"
import {
  AdministratorViewProvider,
  AdministratorViewStatus,
  useAdministratorViewControl,
} from "@/components/crucible/administrator-view-control"
import { CreateMenu } from "@/components/crucible/create-menu"
import { GlobalSearch } from "@/components/crucible/global-search"
import { KeyboardShortcuts } from "@/components/crucible/keyboard-shortcuts"
import { PersonIdentity } from "@/components/crucible/person-identity"
import { QrScannerAction } from "@/components/crucible/qr-scanner-action"
import {
  AccountIcon,
  AdministratorViewDisabledIcon,
  AdministratorViewEnabledIcon,
  AdministratorViewIcon,
  CollapseSidebarIcon,
  DeletionRequestsIcon,
  ExpandSidebarIcon,
  RecentResourcesIcon,
  ThemeIcon,
  WorkspaceIcon,
} from "@/components/crucible/icons"
import {
  DataCollectionIcon,
  PrincipalTypeIcon,
  ResourceTypeIcon,
} from "@/components/crucible/resource-type-icon"
import type { ResourceType } from "@/components/crucible/resource-type-icon"
import { ResourceSiblingNavigationProvider } from "@/components/crucible/resource-sibling-navigation"
import { useTheme } from "@/components/theme-provider"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
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
import { Switch } from "@/components/ui/switch"
import type { Workspace } from "@/data/crucible/workspace-source"
import type { WorkspacePrivilegeMode } from "@/data/crucible/privilege-mode"
import { canOpenServiceAccountAdministration } from "@/data/crucible/administration"
import type { IdentityScope } from "@/data/crucible/query-keys"
import {
  projectQueryOptions,
  projectSummaryQueryOptions,
} from "@/data/crucible/projects.queries"
import {
  RecentlyViewedScope,
  useRecentlyViewed,
} from "@/features/recently-viewed/recently-viewed"
import type { RecentlyViewedResource } from "@/features/recently-viewed/recently-viewed"

type NavPath = "/" | "/data" | "/projects" | "/instruments"
const sidebarRecentLimit = 4

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
    kind: "data",
  },
  {
    label: "Instruments",
    to: "/instruments",
    kind: "resource",
    resourceType: "instrument",
  },
] satisfies ReadonlyArray<{
  kind: "data" | "home" | "resource"
  label: string
  resourceType?: ResourceType
  to: NavPath
}>

export function AppShell({
  account,
  children,
  privilegeMode = "normal",
  scope,
}: {
  account?: Workspace["account"]
  children: React.ReactNode
  privilegeMode?: WorkspacePrivilegeMode
  scope?: IdentityScope
}) {
  const location = useRouterState({
    select: (state) => state.location,
  })
  const pathname = location.pathname
  const deletionRequestsActive = pathname === "/deletion-requests"
  const projectMfid = activeProjectMfid(pathname, location.search)
  const recentlyViewedIdentity =
    scope?.slice(0, 3).join(":") ?? account?.unique_id ?? "anonymous"

  const shell = (
    <RecentlyViewedScope identityKey={recentlyViewedIdentity}>
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
                          ) : item.kind === "data" ? (
                            <DataCollectionIcon />
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
            {account ? (
              <SidebarGroup>
                <SidebarGroupLabel>Administration</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {account.authorization.can_elevate ? (
                      <SidebarMenuItem>
                        <SidebarAdministratorViewControl />
                      </SidebarMenuItem>
                    ) : null}
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        isActive={deletionRequestsActive}
                        tooltip="Deletion requests"
                        render={
                          <Link
                            aria-current={
                              deletionRequestsActive ? "page" : undefined
                            }
                            search={{ view: "submitted" }}
                            to="/deletion-requests"
                          />
                        }
                      >
                        <DeletionRequestsIcon aria-hidden="true" />
                        <span>Deletion requests</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    {canOpenServiceAccountAdministration(account) ? (
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
                              preload={false}
                              to="/admin/service-accounts"
                            />
                          }
                        >
                          <PrincipalTypeIcon type="service_account" />
                          <span>Service accounts</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ) : null}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ) : null}
            <SidebarRecentResources />
          </SidebarContent>
          <SidebarUtilities
            pathname={pathname}
            projectActive={Boolean(projectMfid)}
          />
          <SidebarRail />
        </Sidebar>
        <SidebarInset>
          <header className="sticky top-0 z-20 flex h-app-header items-center gap-3 border-b bg-background/95 px-4 backdrop-blur sm:px-6">
            <SidebarTrigger className="md:hidden" />
            <AppSearch
              preferFullProject={pathname.startsWith("/projects/")}
              projectMfid={projectMfid}
              scope={scope}
            />
            <QrScannerAction />
            {account ? <CreateMenu account={account} /> : null}
            {account && scope ? (
              <AccountControls
                account={account}
                administrationActive={pathname.startsWith("/admin")}
                privilegeMode={privilegeMode}
              />
            ) : (
              <div className="ml-auto border-l pl-3">
                <Avatar size="sm">
                  <AvatarFallback className="text-foreground">?</AvatarFallback>
                </Avatar>
              </div>
            )}
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
    </RecentlyViewedScope>
  )

  return account && scope ? (
    <AdministratorViewProvider privilegeMode={privilegeMode} scope={scope}>
      {shell}
    </AdministratorViewProvider>
  ) : (
    shell
  )
}

function AccountControls({
  account,
  administrationActive,
  privilegeMode,
}: {
  account: Workspace["account"]
  administrationActive: boolean
  privilegeMode: WorkspacePrivilegeMode
}) {
  return (
    <div className="ml-auto flex items-center gap-2">
      {privilegeMode === "elevated" ? (
        <AdministratorViewStatus />
      ) : administrationActive ? (
        <Badge aria-label="Platform administration" variant="warning">
          <AdministratorViewIcon />
          <span className="hidden md:inline">Platform administration</span>
        </Badge>
      ) : null}
      <div className="border-l pl-3">
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
          <DropdownMenuContent align="end" className="min-w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Account</DropdownMenuLabel>
              <DropdownMenuItem render={<Link to="/account" />}>
                <AccountIcon />
                My profile
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

function SidebarRecentResources() {
  const items = useRecentlyViewed().slice(0, sidebarRecentLimit)
  const { isMobile, state } = useSidebar()

  if (items.length === 0) return null

  const collapsed = !isMobile && state === "collapsed"
  if (collapsed) {
    return (
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <SidebarMenuButton
                      aria-label="Recently viewed"
                      tooltip="Recently viewed"
                    />
                  }
                >
                  <RecentResourcesIcon aria-hidden="true" />
                  <span>Recent</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="w-(--sidebar-width)"
                  side="right"
                >
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>Recently viewed</DropdownMenuLabel>
                    {items.map((item) => (
                      <DropdownMenuItem
                        key={`${item.kind}:${item.uniqueId}`}
                        render={recentResourceLink(item)}
                      >
                        <ResourceTypeIcon type={item.kind} />
                        <span className="truncate">{item.name}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    )
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Recent</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={`${item.kind}:${item.uniqueId}`}>
              <SidebarMenuButton
                render={recentResourceLink(item)}
                tooltip={item.name}
              >
                <ResourceTypeIcon type={item.kind} />
                <span>{item.name}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

function recentResourceLink(item: RecentlyViewedResource) {
  const ariaLabel = `Open ${item.kind}: ${item.name}`
  if (item.kind === "project") {
    return (
      <Link
        aria-label={ariaLabel}
        params={{ projectMfid: item.uniqueId }}
        search={{ preview: undefined }}
        state={{}}
        to="/projects/$projectMfid"
      />
    )
  }
  if (item.kind === "instrument") {
    return (
      <Link
        aria-label={ariaLabel}
        params={{ instrumentMfid: item.uniqueId }}
        search={{}}
        state={{}}
        to="/instruments/$instrumentMfid"
      />
    )
  }
  if (item.kind === "sample") {
    return (
      <Link
        aria-label={ariaLabel}
        params={{ sampleMfid: item.uniqueId }}
        to="/samples/$sampleMfid"
      />
    )
  }
  return (
    <Link
      aria-label={ariaLabel}
      params={{ datasetMfid: item.uniqueId }}
      to="/datasets/$datasetMfid"
    />
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
              <DropdownMenuGroup>
                <DropdownMenuLabel>Theme</DropdownMenuLabel>
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
                  <DropdownMenuRadioItem value="system">
                    System
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="light">
                    Light
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="dark">
                    Dark
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuGroup>
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

function SidebarAdministratorViewControl() {
  const { isMobile, state } = useSidebar()
  const { active, pending, setActive } = useAdministratorViewControl()
  const expanded = isMobile || state === "expanded"
  const Icon = active
    ? AdministratorViewEnabledIcon
    : AdministratorViewDisabledIcon

  if (!expanded) {
    return (
      <SidebarMenuButton
        aria-label="Administrator view"
        aria-pressed={active}
        disabled={pending}
        onClick={() => setActive(!active)}
        tooltip={active ? "Administrator view on" : "Administrator view off"}
        variant={active ? "warning" : "default"}
      >
        <Icon aria-hidden="true" />
        <span>Administrator view</span>
      </SidebarMenuButton>
    )
  }

  return (
    <div className="flex h-8 items-center gap-2 rounded-md px-2 text-body">
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">Administrator view</span>
      <Switch
        aria-label="Administrator view"
        checked={active}
        disabled={pending}
        onCheckedChange={setActive}
        size="sm"
        variant="warning"
      />
    </div>
  )
}
