import { useQuery } from "@tanstack/react-query"
import { Link, useRouterState } from "@tanstack/react-router"

import { AppFooter } from "@/components/crucible/app-footer"
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
  CollapseSidebarIcon,
  PreferencesIcon,
  CreateResourceIcon,
  DeletionRequestsIcon,
  ExpandSidebarIcon,
  RecentResourcesIcon,
  SignOutIcon,
  ThemeIcon,
  WorkspaceIcon,
} from "@/components/crucible/icons"
import {
  DataCollectionIcon,
  PrincipalTypeIcon,
  ResourceTypeIcon,
} from "@/components/crucible/resource-type-icon"
import { ResourceSiblingNavigationProvider } from "@/components/crucible/resource-sibling-navigation"
import { SessionTabSync } from "@/components/crucible/session-tab-sync"
import { useAccountPreferencesEnabled } from "@/components/crucible/workspace-provider"
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
  DropdownMenuSeparator,
  DropdownMenuSubmitItem,
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
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubAction,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import { Switch } from "@/components/ui/switch"
import type { Workspace } from "@/data/crucible/workspace-source"
import type { WorkspacePrivilegeMode } from "@/data/crucible/privilege-mode"
import {
  canOpenPlatformAdministration,
  canOpenServiceAccountAdministration,
  canUseAdministratorView,
} from "@/data/crucible/administration"
import { pendingDeletionRequestsCountQueryOptions } from "@/data/crucible/deletion-requests.queries"
import { identityScope } from "@/data/crucible/query-keys"
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
import { useThemePreference } from "@/features/preferences/theme-preference"
import { useAccountPreferences } from "@/features/preferences/use-account-preferences"
import { resourceDisplayName } from "@/lib/resource-name"

const sidebarRecentLimit = 4
const administrationRevealClassName =
  "animate-in fade-in-0 slide-in-from-top-1 duration-standard ease-enter"

export function AppShell({
  account,
  children,
  privilegeMode = "normal",
  sessionAuth = false,
  scope,
}: {
  account?: Workspace["account"]
  children: React.ReactNode
  privilegeMode?: WorkspacePrivilegeMode
  sessionAuth?: boolean
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

  const pendingCountQuery = useQuery({
    ...pendingDeletionRequestsCountQueryOptions(
      scope ?? identityScope("anonymous", "anonymous", "normal")
    ),
    enabled: Boolean(account && scope),
  })
  const pendingReviewCount = pendingCountQuery.data ?? 0
  const { preferences } = useAccountPreferences()
  const defaultDataSearch =
    preferences.default_record_kind === "datasets"
      ? { kind: "datasets" as const }
      : {}

  const isDataActive =
    pathname === "/data" ||
    pathname.startsWith("/datasets/") ||
    pathname.startsWith("/samples/")
  const isProjectsActive =
    pathname === "/projects" || pathname.startsWith("/projects/")
  const isInstrumentsActive =
    pathname === "/instruments" || pathname.startsWith("/instruments/")

  const dataKind = pathname.startsWith("/datasets/")
    ? "datasets"
    : pathname.startsWith("/samples/")
      ? "samples"
      : pathname === "/data"
        ? (location.search as { kind?: string }).kind === "datasets"
          ? "datasets"
          : "samples"
        : null

  const shell = (
    <RecentlyViewedScope identityKey={recentlyViewedIdentity}>
      {sessionAuth && account ? (
        <SessionTabSync
          accountMfid={account.unique_id}
          privilegeMode={privilegeMode}
        />
      ) : null}
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
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={pathname === "/"}
                      tooltip="Home"
                      render={
                        <Link
                          aria-current={pathname === "/" ? "page" : undefined}
                          to="/"
                        />
                      }
                    >
                      <WorkspaceIcon aria-hidden="true" />
                      <span>Home</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            <SidebarSeparator className="my-1" />
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={isDataActive}
                      tooltip="Data"
                      render={
                        <Link
                          aria-current={
                            pathname === "/data" ? "page" : undefined
                          }
                          search={defaultDataSearch}
                          to="/data"
                        />
                      }
                    >
                      <DataCollectionIcon />
                      <span>Data</span>
                    </SidebarMenuButton>
                    <SidebarMenuSub>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          isActive={dataKind === "samples"}
                          render={
                            <Link
                              aria-current={
                                dataKind === "samples" ? "page" : undefined
                              }
                              aria-label="Browse samples"
                              search={(prev: Record<string, unknown>) => ({
                                ...prev,
                                kind: "samples",
                              })}
                              to="/data"
                            />
                          }
                        >
                          <ResourceTypeIcon type="sample" />
                          <span>Samples</span>
                        </SidebarMenuSubButton>
                        {account?.capabilities.can_create_sample ? (
                          <SidebarMenuSubAction
                            aria-label="Create sample"
                            render={
                              <Link
                                aria-label="Create sample"
                                search={{ projectMfid: undefined }}
                                to="/samples/new"
                              />
                            }
                            showOnHover
                            title="Create sample"
                          >
                            <CreateResourceIcon aria-hidden="true" />
                            <span className="sr-only">Create sample</span>
                          </SidebarMenuSubAction>
                        ) : null}
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          isActive={dataKind === "datasets"}
                          render={
                            <Link
                              aria-current={
                                dataKind === "datasets" ? "page" : undefined
                              }
                              aria-label="Browse datasets"
                              search={(prev: Record<string, unknown>) => ({
                                ...prev,
                                kind: "datasets",
                              })}
                              to="/data"
                            />
                          }
                        >
                          <ResourceTypeIcon type="dataset" />
                          <span>Datasets</span>
                        </SidebarMenuSubButton>
                        {account?.capabilities.can_create_dataset ? (
                          <SidebarMenuSubAction
                            aria-label="Create dataset"
                            render={
                              <Link
                                aria-label="Create dataset"
                                search={{
                                  instrumentMfid: undefined,
                                  projectMfid: undefined,
                                }}
                                to="/datasets/new"
                              />
                            }
                            showOnHover
                            title="Create dataset"
                          >
                            <CreateResourceIcon aria-hidden="true" />
                            <span className="sr-only">Create dataset</span>
                          </SidebarMenuSubAction>
                        ) : null}
                      </SidebarMenuSubItem>
                    </SidebarMenuSub>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={isProjectsActive}
                      tooltip="Projects"
                      render={
                        <Link
                          aria-current={
                            pathname === "/projects" ? "page" : undefined
                          }
                          to="/projects"
                        />
                      }
                    >
                      <ResourceTypeIcon type="project" />
                      <span>Projects</span>
                    </SidebarMenuButton>
                    {account?.capabilities.can_create_project ? (
                      <SidebarMenuAction
                        aria-label="Create project"
                        render={
                          <Link
                            aria-label="Create project"
                            to="/projects/new"
                          />
                        }
                        showOnHover
                        title="Create project"
                      >
                        <CreateResourceIcon aria-hidden="true" />
                        <span className="sr-only">Create project</span>
                      </SidebarMenuAction>
                    ) : null}
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={isInstrumentsActive}
                      tooltip="Instruments"
                      render={
                        <Link
                          aria-current={
                            pathname === "/instruments" ? "page" : undefined
                          }
                          to="/instruments"
                        />
                      }
                    >
                      <ResourceTypeIcon type="instrument" />
                      <span>Instruments</span>
                    </SidebarMenuButton>
                    {account?.capabilities.can_register_instrument ? (
                      <SidebarMenuAction
                        aria-label="Register instrument"
                        render={
                          <Link
                            aria-label="Register instrument"
                            to="/instruments/new"
                          />
                        }
                        showOnHover
                        title="Register instrument"
                      >
                        <CreateResourceIcon aria-hidden="true" />
                        <span className="sr-only">Register instrument</span>
                      </SidebarMenuAction>
                    ) : null}
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            {account ? (
              <SidebarGroup>
                <SidebarGroupLabel>Administration</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {canUseAdministratorView(account) ? (
                      <SidebarMenuItem>
                        <SidebarAdministratorViewControl />
                      </SidebarMenuItem>
                    ) : null}
                    {canOpenPlatformAdministration(account, privilegeMode) ? (
                      <SidebarMenuItem
                        className={administrationRevealClassName}
                      >
                        <SidebarMenuButton
                          isActive={pathname.startsWith("/admin/users")}
                          tooltip="Users"
                          render={
                            <Link
                              aria-current={
                                pathname.startsWith("/admin/users")
                                  ? "page"
                                  : undefined
                              }
                              preload={false}
                              to="/admin/users"
                            />
                          }
                        >
                          <PrincipalTypeIcon type="user" />
                          <span>Users</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ) : null}
                    {canOpenServiceAccountAdministration(
                      account,
                      privilegeMode
                    ) ? (
                      <SidebarMenuItem
                        className={administrationRevealClassName}
                      >
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
                      {pendingReviewCount > 0 ? (
                        <SidebarMenuBadge
                          aria-label={`${pendingReviewCount} pending deletion requests`}
                          className="rounded-full border border-sidebar-border/60 bg-sidebar-accent px-1.5 text-label-compact text-sidebar-foreground"
                        >
                          {pendingReviewCount}
                        </SidebarMenuBadge>
                      ) : null}
                    </SidebarMenuItem>
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
                privilegeMode={privilegeMode}
                sessionAuth={sessionAuth}
              />
            ) : (
              <div className="ml-auto border-l pl-3">
                <Avatar size="sm">
                  <AvatarFallback className="text-foreground">?</AvatarFallback>
                </Avatar>
              </div>
            )}
          </header>
          <main className="mx-auto w-full max-w-content flex-1 p-page-gutter sm:p-page-gutter-medium lg:p-page-gutter-wide">
            <ResourceSiblingNavigationProvider
              key={scope?.join(":") ?? account?.unique_id ?? "anonymous"}
            >
              {children}
            </ResourceSiblingNavigationProvider>
          </main>
          <AppFooter />
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
  privilegeMode,
  sessionAuth,
}: {
  account: Workspace["account"]
  privilegeMode: WorkspacePrivilegeMode
  sessionAuth: boolean
}) {
  const preferencesEnabled = useAccountPreferencesEnabled()
  return (
    <div className="ml-auto flex items-center gap-2">
      {privilegeMode === "elevated" ? <AdministratorViewStatus /> : null}
      <div className="border-l pl-3">
        {sessionAuth ? (
          <form action="/hub/auth/logout" id="hub-sign-out" method="post" />
        ) : null}
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
              {preferencesEnabled ? (
                <DropdownMenuItem render={<Link to="/preferences" />}>
                  <PreferencesIcon />
                  Preferences
                </DropdownMenuItem>
              ) : null}
              {sessionAuth ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuSubmitItem
                    form="hub-sign-out"
                    variant="destructive"
                  >
                    <SignOutIcon aria-hidden="true" />
                    Sign out
                  </DropdownMenuSubmitItem>
                </>
              ) : null}
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
                        <span className="truncate">
                          {resourceDisplayName(item.kind, item.name, {
                            mfid: item.uniqueId,
                          })}
                        </span>
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
                tooltip={resourceDisplayName(item.kind, item.name, {
                  mfid: item.uniqueId,
                })}
              >
                <ResourceTypeIcon type={item.kind} />
                <span>
                  {resourceDisplayName(item.kind, item.name, {
                    mfid: item.uniqueId,
                  })}
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

function recentResourceLink(item: RecentlyViewedResource) {
  const ariaLabel = `Open ${item.kind}: ${resourceDisplayName(item.kind, item.name, { mfid: item.uniqueId })}`
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
  if (!projectMfid || !scope) return <GlobalSearch scope={scope} />
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
  return (
    <ProjectSearchAction
      project={project}
      projectMfid={projectMfid}
      scope={scope}
    />
  )
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
  return (
    <ProjectSearchAction
      project={project}
      projectMfid={projectMfid}
      scope={scope}
    />
  )
}

function ProjectSearchAction({
  project,
  projectMfid,
  scope,
}: {
  project?: { project_id: string; title?: string | null } | null
  projectMfid: string
  scope: IdentityScope
}) {
  return (
    <GlobalSearch
      projectMfid={projectMfid}
      projectName={
        project
          ? resourceDisplayName("project", project.title, {
              identifier: project.project_id,
              mfid: projectMfid,
            })
          : undefined
      }
      scope={scope}
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
  return (
    <SidebarHeader className="h-14 justify-center">
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            size="lg"
            tooltip="Crucible Hub"
            render={<Link aria-label="Crucible Hub" to="/" />}
          >
            <BrandMark className="overflow-hidden rounded-md" />
            <span className="truncate text-brand">Crucible Hub</span>
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
  const { setTheme, theme } = useThemePreference()
  const preferencesEnabled = useAccountPreferencesEnabled()
  const expanded = isMobile || state === "expanded"

  return (
    <SidebarFooter>
      <SidebarMenu>
        {preferencesEnabled ? (
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={pathname === "/preferences"}
              tooltip="Preferences"
              render={
                <Link
                  aria-current={
                    pathname === "/preferences" ? "page" : undefined
                  }
                  to="/preferences"
                />
              }
            >
              <PreferencesIcon aria-hidden="true" />
              <span>Preferences</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ) : null}
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
    <label className="flex h-8 cursor-pointer items-center gap-2 rounded-md px-2 text-body">
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
    </label>
  )
}
