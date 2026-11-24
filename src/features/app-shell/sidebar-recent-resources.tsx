import { Link } from "@tanstack/react-router"
import { useEnteringKeys } from "@/hooks/use-entering-keys"
import { enterMotionClassName } from "@/lib/motion"
import { RecentResourcesIcon } from "@/components/crucible/icons"
import { ResourceTypeIcon } from "@/components/crucible/resource-type-icon"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { useRecentlyViewed } from "@/features/recently-viewed/recently-viewed"
import type { RecentlyViewedResource } from "@/features/recently-viewed/recently-viewed"
import { resourceDisplayName } from "@/lib/resource-name"

const sidebarRecentLimit = 4

export function SidebarRecentResources() {
  const items = useRecentlyViewed().slice(0, sidebarRecentLimit)
  const entering = useEnteringKeys(
    items.map((item) => `${item.kind}:${item.uniqueId}`)
  )
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
            <SidebarMenuItem
              className={
                entering.has(`${item.kind}:${item.uniqueId}`)
                  ? enterMotionClassName
                  : undefined
              }
              key={`${item.kind}:${item.uniqueId}`}
            >
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
