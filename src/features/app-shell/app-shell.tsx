import { useEffect, useState } from "react"
import { useViewerPresentation } from "@/hooks/use-viewer-presentation"
import { useWindowClass } from "@/hooks/use-window-class"
import { useQuery } from "@tanstack/react-query"
import { Link, useRouterState } from "@tanstack/react-router"
import { AppFooter } from "@/components/crucible/app-footer"
import {
  AdministratorViewProvider,
  useOptionalAdministratorViewControl,
} from "@/components/crucible/administrator-view-control"
import {
  InspectorPaneProvider,
  InspectorPaneToggle,
  useInspectorPane,
} from "@/components/crucible/inspector-pane"
import { PendingRegion } from "@/components/crucible/pending-region"
import {
  readDocumentCookies,
  writePresentationCookie,
} from "@/lib/viewer-presentation"
import { windowClassCookie } from "@/lib/window-class"
import { CreateMenu } from "@/components/crucible/create-menu"
import { KeyboardShortcuts } from "@/components/crucible/keyboard-shortcuts"
import {
  CreateResourceIcon,
  DeletionRequestsIcon,
  JoinRequestsIcon,
  WorkspaceIcon,
} from "@/components/crucible/icons"
import {
  DataCollectionIcon,
  ResourceTypeIcon,
} from "@/components/crucible/resource-type-icon"
import { ResourceSiblingNavigationProvider } from "@/components/crucible/resource-sibling-navigation"
import { SessionTabSync } from "@/components/crucible/session-tab-sync"
import { TimeZoneSync } from "@/components/crucible/time-zone-sync"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { createDialogHandle } from "@/components/ui/dialog"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
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
} from "@/components/ui/sidebar"
import type { Workspace } from "@/data/crucible/workspace-source"
import type { WorkspacePrivilegeMode } from "@/data/crucible/privilege-mode"
import { canUseAdministratorView } from "@/data/crucible/administration"
import { pendingDeletionRequestsCountQueryOptions } from "@/data/crucible/deletion-requests.queries"
import { pendingJoinRequestsCountQueryOptions } from "@/data/crucible/join-requests.queries"
import { identityScope } from "@/data/crucible/query-keys"
import type { IdentityScope } from "@/data/crucible/query-keys"
import { DockedPreviewPane } from "@/features/resource-inspector/docked-preview-pane"
import { switchDataKind } from "@/features/data/data-filter-state"
import { RecentlyViewedScope } from "@/features/recently-viewed/recently-viewed"
import { useAccountPreferences } from "@/hooks/use-account-preferences"

import {
  AccountControls,
  SidebarBrand,
  SidebarUtilities,
  SidebarAdministratorViewControl,
  SidebarAdministrationLinks,
} from "./sidebar-sections"
import { SidebarRecentResources } from "./sidebar-recent-resources"
import { AppSearch, activeProjectMfid } from "./project-context-search"

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
  const presentation = useViewerPresentation()
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const projectMfid = useRouterState({
    select: (state) =>
      activeProjectMfid(state.location.pathname, state.location.search),
  })
  const dataKindSearch = useRouterState({
    select: (state) => (state.location.search as { kind?: string }).kind,
  })
  const deletionRequestsActive = pathname === "/deletion-requests"
  const joinRequestsActive = pathname === "/join-requests"
  const [shortcuts] = useState(createDialogHandle)
  const windowClass = useWindowClass()
  useEffect(() => {
    if (readDocumentCookies()[windowClassCookie] !== windowClass)
      writePresentationCookie(windowClassCookie, windowClass)
  }, [windowClass])
  const recentlyViewedIdentity =
    scope?.slice(0, 3).join(":") ?? account?.unique_id ?? "anonymous"

  const pendingCountQuery = useQuery({
    ...pendingDeletionRequestsCountQueryOptions(
      scope ?? identityScope("anonymous", "anonymous", "normal")
    ),
    enabled: Boolean(account && scope),
  })
  const pendingReviewCount = pendingCountQuery.data ?? 0
  const joinCountQuery = useQuery({
    ...pendingJoinRequestsCountQueryOptions(
      scope ?? identityScope("anonymous", "anonymous", "normal")
    ),
    enabled: Boolean(account && scope),
  })
  const pendingJoinCount = joinCountQuery.data ?? 0
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
        ? dataKindSearch === "datasets"
          ? "datasets"
          : "samples"
        : null

  const shell = (
    <RecentlyViewedScope identityKey={recentlyViewedIdentity}>
      <TimeZoneSync />
      {sessionAuth && account ? (
        <SessionTabSync
          accountMfid={account.unique_id}
          privilegeMode={privilegeMode}
        />
      ) : null}
      <InspectorPaneProvider
        initialOpen={presentation.inspectorOpen}
        resetKey={`${recentlyViewedIdentity}:${privilegeMode}`}
      >
        <SidebarProvider
          autoCollapsed={windowClass === "medium"}
          defaultOpen={presentation.sidebarOpen}
        >
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
                                search={
                                  pathname === "/data"
                                    ? (prev: Record<string, unknown>) =>
                                        switchDataKind(prev, "samples")
                                    : {}
                                }
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
                              tooltip="Create sample"
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
                                search={
                                  pathname === "/data"
                                    ? (prev: Record<string, unknown>) =>
                                        switchDataKind(prev, "datasets")
                                    : { kind: "datasets" }
                                }
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
                              tooltip="Create dataset"
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
                            search={{}}
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
                          tooltip="Create project"
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
                            search={{}}
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
                          tooltip="Register instrument"
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
                      <SidebarAdministrationLinks
                        account={account}
                        pathname={pathname}
                        privilegeMode={privilegeMode}
                      />
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
                          >
                            {pendingReviewCount}
                          </SidebarMenuBadge>
                        ) : null}
                      </SidebarMenuItem>
                      <SidebarMenuItem>
                        <SidebarMenuButton
                          isActive={joinRequestsActive}
                          tooltip="Join requests"
                          render={
                            <Link
                              aria-current={
                                joinRequestsActive ? "page" : undefined
                              }
                              search={{
                                view:
                                  pendingJoinCount > 0
                                    ? "reviewable"
                                    : "submitted",
                              }}
                              to="/join-requests"
                            />
                          }
                        >
                          <JoinRequestsIcon aria-hidden="true" />
                          <span>Join requests</span>
                        </SidebarMenuButton>
                        {pendingJoinCount > 0 ? (
                          <SidebarMenuBadge
                            aria-label={`${pendingJoinCount} pending join requests`}
                          >
                            {pendingJoinCount}
                          </SidebarMenuBadge>
                        ) : null}
                      </SidebarMenuItem>
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              ) : null}
              <SidebarRecentResources />
            </SidebarContent>
            <SidebarUtilities shortcuts={shortcuts} />
            <SidebarRail />
          </Sidebar>
          <PreviewPaneInset>
            <header className="sticky top-0 z-(--layer-navigation) flex h-app-header items-center gap-3 border-b bg-background/95 px-page-margin backdrop-blur">
              <SidebarTrigger className="md:hidden" />
              <AppSearch
                preferFullProject={pathname.startsWith("/projects/")}
                projectMfid={projectMfid}
                scope={scope}
              />
              {account ? <CreateMenu account={account} /> : null}
              {account && scope ? (
                <AccountControls account={account} sessionAuth={sessionAuth} />
              ) : (
                <div className="ml-auto border-l pl-3">
                  <Avatar size="sm">
                    <AvatarFallback className="text-foreground">
                      ?
                    </AvatarFallback>
                  </Avatar>
                </div>
              )}
              <InspectorPaneToggle />
            </header>
            <AppMain>
              <ResourceSiblingNavigationProvider
                key={recentlyViewedIdentity}
                resetKey={privilegeMode}
              >
                {children}
              </ResourceSiblingNavigationProvider>
            </AppMain>
            <AppFooter />
          </PreviewPaneInset>
          <DockedPreviewPane />
          <KeyboardShortcuts
            handle={shortcuts}
            pathname={pathname}
            projectActive={Boolean(projectMfid)}
          />
        </SidebarProvider>
      </InspectorPaneProvider>
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

function PreviewPaneInset({ children }: { children: React.ReactNode }) {
  const pane = useInspectorPane()
  return (
    <SidebarInset data-inspector-pane={pane?.open ? "open" : "closed"}>
      {children}
    </SidebarInset>
  )
}

function AppMain({ children }: { children: React.ReactNode }) {
  const pending = useOptionalAdministratorViewControl()?.pending ?? false
  return (
    <PendingRegion
      className="@container/content mx-auto w-full max-w-content flex-1 px-page-margin py-page-block"
      pending={pending}
      render={<main />}
    >
      {children}
    </PendingRegion>
  )
}
