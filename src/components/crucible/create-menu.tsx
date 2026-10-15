import { Link } from "@tanstack/react-router"

import { CreateResourceIcon } from "@/components/crucible/icons"
import {
  PrincipalTypeIcon,
  ResourceTypeIcon,
} from "@/components/crucible/resource-type-icon"
import { Button } from "@/components/ui/button"
import { canOpenServiceAccountAdministration } from "@/data/crucible/administration"
import { useWorkspacePrivilegeMode } from "@/components/crucible/workspace-provider"
import type { WorkspaceAccount } from "@/data/crucible/workspace-source"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function CreateMenu({ account }: { account: WorkspaceAccount }) {
  const privilegeMode = useWorkspacePrivilegeMode()
  const { capabilities } = account

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button aria-label="Create" />}>
        <CreateResourceIcon aria-hidden="true" data-icon="inline-start" />
        <span className="hidden sm:inline">Create</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Create new</DropdownMenuLabel>
          {capabilities.can_create_project ? (
            <DropdownMenuItem render={<Link to="/projects/new" />}>
              <ResourceTypeIcon type="project" />
              Project
            </DropdownMenuItem>
          ) : null}
          {capabilities.can_create_sample ? (
            <DropdownMenuItem
              render={
                <Link search={{ projectMfid: undefined }} to="/samples/new" />
              }
            >
              <ResourceTypeIcon type="sample" />
              Sample
            </DropdownMenuItem>
          ) : null}
          {capabilities.can_create_dataset ? (
            <DropdownMenuItem
              render={
                <Link
                  search={{
                    instrumentMfid: undefined,
                    projectMfid: undefined,
                  }}
                  to="/datasets/new"
                />
              }
            >
              <ResourceTypeIcon type="dataset" />
              Dataset
            </DropdownMenuItem>
          ) : null}
          {capabilities.can_register_instrument ? (
            <DropdownMenuItem render={<Link to="/instruments/new" />}>
              <ResourceTypeIcon type="instrument" />
              Instrument
            </DropdownMenuItem>
          ) : null}
          {canOpenServiceAccountAdministration(account, privilegeMode) ? (
            <DropdownMenuItem
              render={
                <Link
                  preload={false}
                  search={{
                    activity: undefined,
                    create: true,
                    cursor: undefined,
                    direction: undefined,
                    q: undefined,
                    sort: undefined,
                  }}
                  to="/admin/service-accounts"
                />
              }
            >
              <PrincipalTypeIcon type="service_account" />
              Service account
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
