import { useEffect, useState } from "react"

import { PendingIcon } from "@/components/crucible/pending-icon"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { hubErrorMessage } from "@/data/crucible/result"

export const platformRoles = ["none", "contributor", "admin"] as const

export type PlatformRole = (typeof platformRoles)[number]

export function isPlatformRole(role: string): role is PlatformRole {
  return platformRoles.some((candidate) => candidate === role)
}

export function platformRoleLabel(role: PlatformRole) {
  if (role === "none") return "No platform role"
  return role === "admin" ? "Admin" : "Contributor"
}

export function PlatformRoleDialog({
  currentRole,
  id,
  onChanged,
  onChange,
  onOpenChange,
  open,
  roleDescriptions,
}: {
  currentRole: string | null | undefined
  id: string
  onChanged?: () => void
  onChange: (role: PlatformRole) => Promise<unknown>
  onOpenChange: (open: boolean) => void
  open: boolean
  roleDescriptions: Record<PlatformRole, string>
}) {
  const [selectedRole, setSelectedRole] = useState<PlatformRole>()
  const [error, setError] = useState<string>()
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (open) {
      setSelectedRole(
        currentRole && isPlatformRole(currentRole) ? currentRole : undefined
      )
    }
  }, [open, currentRole])

  async function confirm() {
    if (!selectedRole || selectedRole === currentRole || pending) return
    setPending(true)
    setError(undefined)
    try {
      await onChange(selectedRole)
      onChanged?.()
      onOpenChange(false)
      setSelectedRole(undefined)
    } catch (cause) {
      setError(
        hubErrorMessage(cause, "The platform role could not be changed.")
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog
      onOpenChange={(nextOpen) => {
        if (pending) return
        onOpenChange(nextOpen)
      }}
      onOpenChangeComplete={(isOpen) => {
        if (isOpen) return
        setSelectedRole(undefined)
        setError(undefined)
      }}
      open={open}
    >
      <DialogContent showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>Change platform role</DialogTitle>
          <DialogDescription>
            Access changes may take about a minute to reach every API process.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={id}>Platform role</FieldLabel>
            <NativeSelect
              className="w-full"
              disabled={pending}
              id={id}
              onChange={(event) => {
                if (isPlatformRole(event.target.value)) {
                  setSelectedRole(event.target.value)
                }
              }}
              value={selectedRole ?? ""}
            >
              <NativeSelectOption disabled value="">
                Select role
              </NativeSelectOption>
              {platformRoles.map((role) => (
                <NativeSelectOption key={role} value={role}>
                  {platformRoleLabel(role)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          {selectedRole ? (
            <p className="text-body text-muted-foreground">
              {roleDescriptions[selectedRole]}
            </p>
          ) : null}
        </FieldGroup>
        {error ? (
          <p className="text-body text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button
            disabled={pending}
            onClick={() => onOpenChange(false)}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            disabled={!selectedRole || selectedRole === currentRole || pending}
            onClick={() => void confirm()}
            type="button"
          >
            {pending ? <PendingIcon data-icon="inline-start" /> : null}
            {pending ? "Changing role" : "Change role"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
