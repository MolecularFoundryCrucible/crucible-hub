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
import { useCopyFeedback } from "@/hooks/use-copy-feedback"
import { useExitSafeValue } from "@/hooks/use-exit-safe"
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
  const { copy, reset, state: copyState } = useCopyFeedback()
  const { onOpenChangeComplete, value: shown } = useExitSafeValue(credential)

  function close() {
    reset()
    onClose()
  }

  const copyLabel = copyState === "success" ? "API key copied" : "Copy API key"

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) close()
      }}
      onOpenChangeComplete={onOpenChangeComplete}
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
                      onClick={() => void copy(shown.api_key)}
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
            <span className="sr-only" role="status">
              {copyState === "success" ? "API key copied" : null}
            </span>
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
