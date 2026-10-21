import { Suspense } from "react"
import { lazyRouteComponent } from "@tanstack/react-router"

import { MfidValue } from "@/components/crucible/mfid-value"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

const QRCodeSVG = lazyRouteComponent(() => import("qrcode.react"), "QRCodeSVG")

export function MfidQrCode({
  actions,
  dialogActions,
  value,
}: {
  actions?: React.ReactNode
  dialogActions?: React.ReactNode
  value: string
}) {
  const label = "Enlarge MFID QR code"

  const qrCode = (
    <Dialog>
      <Tooltip>
        <TooltipTrigger
          render={
            <DialogTrigger
              render={
                <Button
                  aria-label={label}
                  className="mfid-qr-trigger"
                  size="qr"
                  variant="outline"
                />
              }
            />
          }
        >
          <Suspense fallback={null}>
            <QRCodeSVG
              aria-hidden="true"
              className="size-full"
              level="M"
              marginSize={4}
              value={value}
            />
          </Suspense>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>MFID QR code</DialogTitle>
        </DialogHeader>
        <div className="flex justify-center">
          <Suspense fallback={null}>
            <QRCodeSVG
              className="h-auto w-full max-w-64"
              level="M"
              marginSize={4}
              title={`QR code for ${value}`}
              value={value}
            />
          </Suspense>
        </div>
        <MfidValue className="justify-center" value={value} />
        {dialogActions ? (
          <div className="flex justify-center">{dialogActions}</div>
        ) : null}
      </DialogContent>
    </Dialog>
  )

  if (!actions) return qrCode
  return (
    <div className="flex flex-col items-center gap-2">
      {qrCode}
      <div className="flex items-center gap-2">{actions}</div>
    </div>
  )
}
