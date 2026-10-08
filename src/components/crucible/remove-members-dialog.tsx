import { useEffect } from "react"

import { SavingChangesIcon } from "@/components/crucible/icons"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { ReactNode } from "react"
import { useStagedCommit } from "@/components/crucible/use-staged-commit"

export type RemovableMember = {
  id: string
  label: string
}

export function RemoveMembersDialog({
  confirmLabel,
  description,
  disabled = false,
  errorLabel,
  members,
  onOpenChange,
  onRemove,
  open,
  title,
}: {
  confirmLabel: (count: number) => string
  description: ReactNode
  disabled?: boolean
  errorLabel: (count: number) => string
  members: readonly RemovableMember[]
  onOpenChange: (open: boolean) => void
  onRemove: (id: string) => Promise<unknown>
  open: boolean
  title: string
}) {
  const { activeId, commit, commitError, committing, reset } = useStagedCommit({
    errorLabel,
    items: members,
    onAction: onRemove,
    onDone: () => onOpenChange(false),
  })

  useEffect(() => {
    if (!open) reset()
  }, [open, reset])

  return (
    <Dialog
      onOpenChange={(nextOpen) => {
        if (!committing) onOpenChange(nextOpen)
      }}
      open={open}
    >
      <DialogContent showCloseButton={!committing}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {members.length > 0 ? (
          <ul aria-label="Members to remove" className="flex flex-col gap-2">
            {members.map((member) => (
              <li
                className="flex min-w-0 items-center gap-2 text-body text-muted-foreground"
                key={member.id}
              >
                <span className="min-w-0 flex-1 truncate">{member.label}</span>
                {activeId === member.id ? (
                  <SavingChangesIcon
                    aria-label={`Removing ${member.label}`}
                    className="motion-safe:animate-spin"
                  />
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
        {commitError ? (
          <p className="text-body text-destructive" role="alert">
            {commitError}
          </p>
        ) : null}
        <DialogFooter>
          <Button
            disabled={committing}
            onClick={() => onOpenChange(false)}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            disabled={members.length === 0 || disabled || committing}
            onClick={() => void commit()}
            type="button"
            variant="destructive"
          >
            {committing ? (
              <SavingChangesIcon
                aria-hidden="true"
                className="motion-safe:animate-spin"
                data-icon="inline-start"
              />
            ) : null}
            {confirmLabel(members.length)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
