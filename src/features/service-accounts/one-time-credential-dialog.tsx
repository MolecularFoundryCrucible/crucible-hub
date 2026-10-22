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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { formatUsername } from "@/lib/username"

export function OneTimeCredentialDialog({
  credential,
  keyLabel = "Service-account API key",
  onClose,
  title,
}: {
  credential?: {
    api_key: string
    unique_id: string
    username: string | null
  }
  keyLabel?: string
  onClose: () => void
  title: string
}) {
  const [copyState, setCopyState] = useState<"idle" | "success" | "error">(
    "idle"
  )
  // Keep the credential on screen while the dialog closes, then forget it.
  const [shown, setShown] = useState(credential)
  if (credential && credential !== shown) setShown(credential)

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

  const copyLabel = copyState === "success" ? "API key copied" : "Copy API key"

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) close()
      }}
      onOpenChangeComplete={(isOpen) => {
        if (!isOpen) setShown(undefined)
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
        {shown ? (
          <div className="flex min-w-0 flex-col gap-4">
            <dl className="grid gap-3">
              <div>
                <dt className="text-label text-muted-foreground">Account</dt>
                <dd className="mt-1 text-body">
                  {formatUsername(shown.username, "raw")}
                </dd>
              </div>
              <div>
                <dt className="text-label text-muted-foreground">MFID</dt>
                <dd className="mt-1 overflow-x-auto">
                  <MfidText value={shown.unique_id} />
                </dd>
              </div>
            </dl>
            <div className="flex min-w-0 items-center gap-2">
              <Input
                aria-label={keyLabel}
                className="min-w-0 font-mono text-body"
                readOnly
                value={shown.api_key}
              />
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      aria-label={copyLabel}
                      onClick={() => void copyCredential()}
                      size="icon"
                      type="button"
                      variant="ghost"
                    />
                  }
                >
                  {copyState === "success" ? (
                    <CopySuccessIcon aria-hidden="true" />
                  ) : (
                    <CopyIcon aria-hidden="true" />
                  )}
                </TooltipTrigger>
                <TooltipContent>{copyLabel}</TooltipContent>
              </Tooltip>
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
