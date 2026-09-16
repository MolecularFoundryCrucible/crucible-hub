import { useState } from "react"

import { CopyIcon, CopySuccessIcon } from "@/components/crucible/icons"
import { MfidText } from "@/components/crucible/mfid-text"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import type { WorkspaceServiceAccountCredential } from "@/data/crucible/workspace-source"

export function OneTimeCredentialDialog({
  credential,
  onClose,
  title,
}: {
  credential?: WorkspaceServiceAccountCredential
  onClose: () => void
  title: string
}) {
  const [copyState, setCopyState] = useState<"idle" | "success" | "error">(
    "idle"
  )

  function close() {
    setCopyState("idle")
    onClose()
  }

  async function copyCredential() {
    if (!credential) return
    try {
      await navigator.clipboard.writeText(credential.api_key)
      setCopyState("success")
    } catch {
      setCopyState("error")
    }
  }

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) close()
      }}
      open={Boolean(credential)}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Copy this API key now. It will not be shown again.
          </DialogDescription>
        </DialogHeader>
        {credential ? (
          <div className="flex min-w-0 flex-col gap-4">
            <dl className="grid gap-3">
              <div>
                <dt className="text-label text-muted-foreground">Account</dt>
                <dd className="mt-1 text-body">@{credential.username}</dd>
              </div>
              <div>
                <dt className="text-label text-muted-foreground">MFID</dt>
                <dd className="mt-1 overflow-x-auto">
                  <MfidText value={credential.unique_id} />
                </dd>
              </div>
            </dl>
            <div className="flex min-w-0 items-center gap-2">
              <Input
                aria-label="Service-account API key"
                className="min-w-0 font-mono text-body"
                readOnly
                value={credential.api_key}
              />
              <Button
                aria-label={
                  copyState === "success" ? "API key copied" : "Copy API key"
                }
                onClick={() => void copyCredential()}
                size="icon"
                type="button"
                variant="outline"
              >
                {copyState === "success" ? (
                  <CopySuccessIcon aria-hidden="true" />
                ) : (
                  <CopyIcon aria-hidden="true" />
                )}
              </Button>
            </div>
            {copyState === "error" ? (
              <p className="text-body text-destructive" role="alert">
                The API key could not be copied. Select and copy it manually.
              </p>
            ) : null}
          </div>
        ) : null}
        <DialogFooter>
          <Button onClick={close} type="button">
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
