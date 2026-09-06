import { Link, useRouterState } from "@tanstack/react-router"
import {
  ActivityIcon,
  DatabaseIcon,
  FolderKanbanIcon,
  HouseIcon,
  MicroscopeIcon,
  PlusIcon,
} from "lucide-react"

import { GlobalSearch } from "@/components/crucible/global-search"
import { ThemeSelect } from "@/components/theme-select"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
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
} from "@/components/ui/sidebar"
import type { Workspace } from "@/data/crucible/workspace-source"
import { initials } from "@/lib/format"

type NavPath = "/" | "/data" | "/projects" | "/instruments"

const primaryItems = [
  { label: "Home", to: "/", icon: HouseIcon },
  { label: "Projects", to: "/projects", icon: FolderKanbanIcon },
  { label: "Data", to: "/data", icon: DatabaseIcon },
  { label: "Instruments", to: "/instruments", icon: MicroscopeIcon },
] satisfies ReadonlyArray<{
  label: string
  to: NavPath
  icon: typeof HouseIcon
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

  return (
    <SidebarProvider>
      <Sidebar
        aria-label="Primary navigation"
        role="navigation"
        collapsible="icon"
      >
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                size="lg"
                tooltip="Crucible Hub"
                render={<Link to="/" />}
              >
                <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-label text-primary-foreground">
                  C
                </span>
                <span className="grid min-w-0 flex-1">
                  <span className="truncate text-label">Crucible</span>
                  <span className="truncate text-supporting text-muted-foreground">
                    Hub
                  </span>
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Workspace</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {primaryItems.map((item) => {
                  const isActive =
                    item.to === "/"
                      ? pathname === "/"
                      : pathname === item.to ||
                        pathname.startsWith(`${item.to}/`)
                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton
                        isActive={isActive}
                        tooltip={item.label}
                        render={<Link to={item.to} />}
                      >
                        <item.icon aria-hidden="true" />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    disabled
                    tooltip="Activity is coming later"
                  >
                    <ActivityIcon aria-hidden="true" />
                    <span>Activity</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <div className="sidebar-theme px-2">
            <ThemeSelect />
          </div>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur sm:px-6">
          <SidebarTrigger aria-label="Toggle primary navigation" />
          <Separator className="h-5" orientation="vertical" />
          <GlobalSearch />
          <Button disabled className="hidden sm:inline-flex">
            <PlusIcon aria-hidden="true" />
            Create
          </Button>
          <div className="ml-auto flex items-center gap-2 border-l pl-3">
            <Avatar size="sm">
              <AvatarFallback className="text-foreground">
                {account
                  ? initials(account.first_name, account.last_name)
                  : "?"}
              </AvatarFallback>
            </Avatar>
            <div className="hidden lg:grid">
              <span className="text-label">
                {account
                  ? `${account.first_name} ${account.last_name}`
                  : "Account unavailable"}
              </span>
              <span className="text-supporting text-muted-foreground">
                {account?.username ?? "Login exchange pending"}
              </span>
            </div>
          </div>
        </header>
        <div className="mx-auto w-full max-w-content flex-1 p-page-gutter sm:p-page-gutter-medium lg:p-page-gutter-wide">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
