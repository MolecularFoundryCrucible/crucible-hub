import type { ReactNode } from "react"

import {
  RemoveMemberIcon,
  RemoveUnavailableIcon,
} from "@/components/crucible/icons"
import { PendingIcon } from "@/components/crucible/pending-icon"
import { RemovalCheckbox } from "@/components/crucible/removal-checkbox"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export function AccessGrantRow({
  badge,
  error,
  identity,
  lockedReason,
  managing,
  mutationPending = false,
  onRevoke,
  pending = false,
  pendingAriaLabel,
  revocable,
  revokeAriaLabel,
  revokeTooltipLabel,
  roleBadge,
  roleEditor,
  selectable,
  selectionLabel,
  selected,
  onSelectionChange,
}: {
  badge?: ReactNode
  error?: ReactNode
  identity: ReactNode
  lockedReason: string
  managing: boolean
  mutationPending?: boolean
  onRevoke: () => void
  pending?: boolean
  pendingAriaLabel?: string
  revocable: boolean
  revokeAriaLabel: string
  revokeTooltipLabel: string
  roleBadge: ReactNode
  roleEditor?: ReactNode
  selectable: boolean
  selectionLabel: string
  selected: boolean
  onSelectionChange: (checked: boolean) => void
}) {
  return (
    <li className="flex min-w-0 flex-col gap-1">
      <div className="flex min-w-0 items-center justify-between gap-2 sm:gap-3">
        {managing ? (
          <RemovalCheckbox
            checked={selected}
            disabled={mutationPending}
            label={selectionLabel}
            onCheckedChange={onSelectionChange}
            selectable={selectable}
          />
        ) : null}
        {identity}
        <div className="flex min-h-8 shrink-0 items-center justify-end gap-2">
          {pending && pendingAriaLabel ? (
            <PendingIcon label={pendingAriaLabel} />
          ) : null}
          {badge}
          <span className="flex shrink-0 justify-end sm:w-access-role-control">
            {roleEditor ?? roleBadge}
          </span>
          {revocable ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    aria-label={revokeAriaLabel}
                    disabled={mutationPending}
                    onClick={onRevoke}
                    size="icon-sm"
                    type="button"
                    variant="destructive"
                  />
                }
              >
                <RemoveMemberIcon aria-hidden="true" />
              </TooltipTrigger>
              <TooltipContent>{revokeTooltipLabel}</TooltipContent>
            </Tooltip>
          ) : managing ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <span
                    aria-label={lockedReason}
                    className="flex size-7 items-center justify-center text-muted-foreground"
                    role="img"
                  />
                }
              >
                <RemoveUnavailableIcon aria-hidden="true" className="size-4" />
              </TooltipTrigger>
              <TooltipContent>{lockedReason}</TooltipContent>
            </Tooltip>
          ) : null}
        </div>
      </div>
      {error ? (
        <p className="text-body text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </li>
  )
}
