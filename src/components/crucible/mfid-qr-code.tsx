import { QRCodeSVG } from "qrcode.react"

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

export function MfidQrCode({ value }: { value: string }) {
  const label = "Enlarge MFID QR code"

  return (
    <Dialog>
      <Tooltip>
        <TooltipTrigger
          render={
            <DialogTrigger
              render={<Button aria-label={label} size="qr" variant="outline" />}
            />
          }
        >
          <QRCodeSVG
            aria-hidden="true"
            className="size-full"
            level="M"
            marginSize={4}
            value={value}
          />
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>MFID QR code</DialogTitle>
        </DialogHeader>
        <div className="flex justify-center">
          <QRCodeSVG
            className="h-auto w-full max-w-64"
            level="M"
            marginSize={4}
            title={`QR code for ${value}`}
            value={value}
          />
        </div>
        <MfidValue className="justify-center" value={value} />
      </DialogContent>
    </Dialog>
  )
}
