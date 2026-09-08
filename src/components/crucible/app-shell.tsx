import { Link, useRouterState } from "@tanstack/react-router"

import { BrandMark } from "@/components/crucible/brand-mark"
import { CreateMenu } from "@/components/crucible/create-menu"
import { GlobalSearch } from "@/components/crucible/global-search"
import { KeyboardShortcuts } from "@/components/crucible/keyboard-shortcuts"
import {
  AccountIcon,
  CollapseSidebarIcon,
  ExpandSidebarIcon,
  ThemeIcon,
  WorkspaceIcon,
} from "@/components/crucible/icons"
import { ResourceTypeIcon } from "@/components/crucible/resource-type-icon"
import type { ResourceType } from "@/components/crucible/resource-type-icon"
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
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  sidebarMenuButtonVariants,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import type { Workspace } from "@/data/crucible/workspace-source"
import { initials } from "@/lib/format"

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
}: {
  account?: Workspace["account"]
  children: React.ReactNode
}) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const projectMfid = pathname.match(/^\/projects\/([^/]+)/)?.[1]

  return (
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
        </SidebarContent>
        <SidebarUtilities projectActive={Boolean(projectMfid)} />
        <SidebarRail />
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur sm:px-6">
          <SidebarTrigger className="md:hidden" />
          <GlobalSearch projectMfid={projectMfid} />
          {account ? (
            <CreateMenu
              isServiceAccount={Boolean(account.is_service_account)}
            />
          ) : null}
          <div className="ml-auto border-l pl-3">
            {account ? (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      aria-label="Open account menu"
                      className="h-auto gap-2 px-1 py-0.5"
                      variant="ghost"
                    />
                  }
                >
                  <Avatar size="sm">
                    <AvatarFallback className="bg-muted text-foreground ring-2 ring-(--resource-person)">
                      {initials(account.first_name, account.last_name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden text-left lg:grid">
                    <span className="text-label">
                      {account.first_name} {account.last_name}
                    </span>
                    <span className="text-supporting text-muted-foreground">
                      {account.username ?? "No username"}
                    </span>
                  </span>
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
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
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
            <BrandMark />
            <span className="truncate text-brand">Crucible Hub</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeader>
  )
}

function SidebarUtilities({ projectActive }: { projectActive: boolean }) {
  const { isMobile, state, toggleSidebar } = useSidebar()
  const { setTheme, theme } = useTheme()
  const expanded = isMobile || state === "expanded"

  return (
    <SidebarFooter>
      <SidebarMenu>
        <SidebarMenuItem>
          <KeyboardShortcuts projectActive={projectActive} />
        </SidebarMenuItem>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  aria-label="Theme"
                  className={sidebarMenuButtonVariants({
                    className: "justify-start",
                  })}
                  data-sidebar="menu-button"
                  title="Theme"
                  variant="ghost"
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
