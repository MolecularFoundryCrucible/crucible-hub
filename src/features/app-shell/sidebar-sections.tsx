import { Link } from "@tanstack/react-router"
import { BrandMark } from "@/components/crucible/brand-mark"
import {
  AdministratorViewStatus,
  useAdministratorViewControl,
  useOptionalAdministratorViewControl,
} from "@/components/crucible/administrator-view-control"
import { Reveal } from "@/components/crucible/reveal"
import { KeyboardShortcutsTrigger } from "@/components/crucible/keyboard-shortcuts"
import {
  PersonIdentity,
  personDisplayName,
} from "@/components/crucible/person-identity"
import {
  AccountIcon,
  AdministratorViewDisabledIcon,
  AdministratorViewEnabledIcon,
  CollapseSidebarIcon,
  PreferencesIcon,
  ExpandSidebarIcon,
  SignOutIcon,
  ThemeIcon,
} from "@/components/crucible/icons"
import { PrincipalTypeIcon } from "@/components/crucible/resource-type-icon"
import { useAccountPreferencesEnabled } from "@/components/crucible/workspace-provider"
import { PendingUsersBadge } from "@/components/crucible/pending-users-badge"
import type { DialogHandle } from "@/components/ui/dialog"
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
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { Switch } from "@/components/ui/switch"
import type { Workspace } from "@/data/crucible/workspace-source"
import type { WorkspacePrivilegeMode } from "@/data/crucible/privilege-mode"
import {
  canOpenPlatformAdministration,
  canOpenServiceAccountAdministration,
} from "@/data/crucible/administration"
import { useThemePreference } from "@/hooks/theme-preference"

export function AccountControls({
  account,
  sessionAuth,
}: {
  account: Workspace["account"]
  sessionAuth: boolean
}) {
  const preferencesEnabled = useAccountPreferencesEnabled()
  return (
    <div className="ml-auto flex items-center gap-2">
      <AdministratorViewStatus />
      <div className="border-l pl-3">
        {sessionAuth ? (
          <form action="/hub/auth/logout" id="hub-sign-out" method="post" />
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button size="lg" variant="ghost" />}>
            <span aria-hidden="true" className="contents">
              <PersonIdentity
                detailsClassName="hidden md:grid"
                person={account}
                presentation="avatar"
                size="sm"
              />
            </span>
            <span className="sr-only">
              {personDisplayName(account)} account menu
            </span>
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

export function SidebarBrand() {
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

export function SidebarUtilities({ shortcuts }: { shortcuts: DialogHandle }) {
  const { isMobile, state, toggleSidebar } = useSidebar()
  const { setTheme, theme } = useThemePreference()
  const expanded = state === "expanded"

  return (
    <SidebarFooter>
      <SidebarMenu>
        <SidebarMenuItem>
          <KeyboardShortcutsTrigger handle={shortcuts} />
        </SidebarMenuItem>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<SidebarMenuButton aria-label="Theme" tooltip="Theme" />}
            >
              <ThemeIcon aria-hidden="true" />
              <span>Theme</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-auto min-w-40"
              side={isMobile ? "top" : "right"}
            >
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
        {isMobile ? null : (
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
        )}
      </SidebarMenu>
    </SidebarFooter>
  )
}

export function SidebarAdministratorViewControl() {
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
        aria-busy={pending || undefined}
        aria-pressed={active}
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
        aria-busy={pending || undefined}
        checked={active}
        onCheckedChange={setActive}
        size="sm"
        variant="warning"
      />
    </label>
  )
}

/**
 * Administration links follow the requested mode, so they slide in or out with
 * the switch; they stay inert until the switch completes.
 */
export function SidebarAdministrationLinks({
  account,
  pathname,
  privilegeMode,
}: {
  account: Workspace["account"]
  pathname: string
  privilegeMode: WorkspacePrivilegeMode
}) {
  const control = useOptionalAdministratorViewControl()
  const mode: WorkspacePrivilegeMode = control
    ? control.active
      ? "elevated"
      : "normal"
    : privilegeMode
  const pending = control?.pending
  return (
    <Reveal
      open={
        canOpenPlatformAdministration(account, mode) ||
        canOpenServiceAccountAdministration(account, mode)
      }
      render={<li className="list-none" />}
    >
      <SidebarMenu inert={pending || undefined}>
        {canOpenPlatformAdministration(account, mode) ? (
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={pathname.startsWith("/admin/users")}
              tooltip="Users"
              render={
                <Link
                  aria-current={
                    pathname.startsWith("/admin/users") ? "page" : undefined
                  }
                  preload={false}
                  to="/admin/users"
                />
              }
            >
              <PrincipalTypeIcon type="user" />
              <span>Users</span>
            </SidebarMenuButton>
            <PendingUsersBadge
              enabled={privilegeMode === "elevated" && !pending}
            />
          </SidebarMenuItem>
        ) : null}
        {canOpenServiceAccountAdministration(account, mode) ? (
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={pathname.startsWith("/admin/service-accounts")}
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
    </Reveal>
  )
}
