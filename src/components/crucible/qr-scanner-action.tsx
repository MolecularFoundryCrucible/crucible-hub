import { useCallback, useRef, useState } from "react"
import { useNavigate } from "@tanstack/react-router"

import { ScanQrCodeIcon } from "@/components/crucible/icons"
import { IdentifierInput } from "@/components/crucible/identifier-input"
import { QrCodeScanner } from "@/components/crucible/qr-code-scanner"
import { Button } from "@/components/ui/button"
import { InputGroupButton } from "@/components/ui/input-group"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { extractMfidFromQrCode } from "@/lib/crucible-qr-code"

/** Scans an MFID from the camera; shown inside the search field. */
export function QrScannerAction() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<"scanner" | "manual">("scanner")
  const [manualValue, setManualValue] = useState("")
  const [manualError, setManualError] = useState<string>()
  const trigger = useRef<HTMLButtonElement>(null)

  const openResource = useCallback(
    (resourceMfid: string) => {
      setOpen(false)
      void navigate({
        params: { resourceMfid },
        search: {},
        state: { forceResourceApiResolution: true },
        to: "/resources/$resourceMfid",
      })
    },
    [navigate]
  )

  function resetAfterClose(isOpen: boolean) {
    if (isOpen) return
    setMode("scanner")
    setManualValue("")
    setManualError(undefined)
  }

  function submitManualValue(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const mfid = extractMfidFromQrCode(manualValue, window.location.hostname)
    if (!mfid) {
      setManualError("Enter a complete MFID or a recognized Crucible link.")
      return
    }
    openResource(mfid)
  }

  return (
    <Dialog
      onOpenChange={setOpen}
      onOpenChangeComplete={resetAfterClose}
      open={open}
    >
      <Tooltip>
        <TooltipTrigger
          render={
            <DialogTrigger
              render={
                <InputGroupButton
                  aria-label="Scan QR code"
                  ref={trigger}
                  size="icon-sm"
                />
              }
            />
          }
        >
          <ScanQrCodeIcon aria-hidden="true" className="size-4" />
        </TooltipTrigger>
        <TooltipContent side="bottom">Scan QR code</TooltipContent>
      </Tooltip>
      <DialogContent className="sm:max-w-xl" finalFocus={trigger}>
        <DialogHeader>
          <DialogTitle>
            {mode === "scanner" ? "Scan an MFID" : "Open by MFID"}
          </DialogTitle>
          {mode === "manual" ? (
            <DialogDescription>
              Enter a complete MFID or paste a recognized Crucible resource
              link.
            </DialogDescription>
          ) : null}
        </DialogHeader>
        {mode === "scanner" ? (
          <QrCodeScanner
            onBack={() => setMode("manual")}
            onMfid={openResource}
          />
        ) : (
          <form className="grid gap-3" onSubmit={submitManualValue}>
            <label className="sr-only" htmlFor="scanner-manual-mfid">
              MFID or Crucible link
            </label>
            <IdentifierInput
              autoFocus
              id="scanner-manual-mfid"
              maxLength={500}
              onChange={(event) => {
                setManualValue(event.target.value)
                setManualError(undefined)
              }}
              placeholder="MFID or Crucible link"
              required
              value={manualValue}
            />
            {manualError ? (
              <p className="text-body text-destructive" role="alert">
                {manualError}
              </p>
            ) : null}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="submit">Open resource</Button>
              <Button
                onClick={() => setMode("scanner")}
                type="button"
                variant="outline"
              >
                <ScanQrCodeIcon aria-hidden="true" data-icon="inline-start" />
                Use camera
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
