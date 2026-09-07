import { Link } from "@tanstack/react-router"

import { CreateResourceIcon } from "@/components/crucible/icons"
import { ResourceTypeIcon } from "@/components/crucible/resource-type-icon"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function CreateMenu({
  isServiceAccount,
}: {
  isServiceAccount: boolean
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button aria-label="Create" />}>
        <CreateResourceIcon data-icon="inline-start" />
        <span className="hidden sm:inline">Create</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Create new</DropdownMenuLabel>
          <DropdownMenuItem render={<Link to="/projects/new" />}>
            <ResourceTypeIcon type="project" />
            Project
          </DropdownMenuItem>
          <DropdownMenuItem
            render={
              <Link search={{ projectMfid: undefined }} to="/samples/new" />
            }
          >
            <ResourceTypeIcon type="sample" />
            Sample
          </DropdownMenuItem>
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
          {!isServiceAccount ? (
            <DropdownMenuItem render={<Link to="/instruments/new" />}>
              <ResourceTypeIcon type="instrument" />
              Instrument
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
