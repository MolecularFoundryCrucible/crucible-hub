import { useState } from "react"

import { CopyIcon, CopySuccessIcon } from "@/components/crucible/icons"
import { IdentityFieldIcon } from "@/components/crucible/identity-field-icon"
import { MfidText } from "@/components/crucible/mfid-text"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

export function MfidValue({
  className,
  value,
}: {
  className?: string
  value: string
}) {
  const [copyState, setCopyState] = useState<"idle" | "success" | "error">(
    "idle"
  )

  async function copyMfid() {
    try {
      await navigator.clipboard.writeText(value)
      setCopyState("success")
    } catch {
      setCopyState("error")
    }
  }

  const copyLabel =
    copyState === "success"
      ? "MFID copied"
      : copyState === "error"
        ? "Copy MFID failed"
        : "Copy MFID"

  return (
    <>
      <span
        className={cn("flex min-w-0 items-center gap-2 text-body", className)}
      >
        <IdentityFieldIcon className="mfid-value-icon" type="mfid" />
        <MfidText
          className="min-w-0 break-all sm:break-normal sm:whitespace-nowrap"
          value={value}
        />
        <Tooltip>
          <TooltipTrigger render={<span className="inline-flex shrink-0" />}>
            <Button
              aria-label={copyLabel}
              onClick={() => void copyMfid()}
              size="icon-xs"
              variant="outline"
            >
              {copyState === "success" ? (
                <CopySuccessIcon aria-hidden="true" />
              ) : (
                <CopyIcon aria-hidden="true" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{copyLabel}</TooltipContent>
        </Tooltip>
      </span>
      {copyState === "error" ? (
        <span className="sr-only" role="alert">
          Could not copy MFID. Try again.
        </span>
      ) : null}
    </>
  )
}
