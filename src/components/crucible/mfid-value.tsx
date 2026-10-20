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

export function CopyMfidButton({ value }: { value: string }) {
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
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              aria-label={copyLabel}
              className="shrink-0"
              onClick={() => void copyMfid()}
              size="icon-xs"
              variant="outline"
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
      {copyState === "error" ? (
        <span className="sr-only" role="alert">
          Could not copy MFID. Try again.
        </span>
      ) : null}
    </>
  )
}

export function MfidValue({
  className,
  copyable = true,
  presentation = "default",
  value,
}: {
  className?: string
  copyable?: boolean
  presentation?: "default" | "supporting"
  value: string
}) {
  return (
    <span
      className={cn(
        "flex min-w-0 items-center gap-2",
        presentation === "supporting" &&
          "text-supporting text-muted-foreground",
        className
      )}
    >
      <IdentityFieldIcon className="mfid-value-icon" type="mfid" />
      <MfidText
        className="min-w-0 break-all sm:break-normal sm:whitespace-nowrap"
        presentation={presentation}
        value={value}
      />
      {copyable ? <CopyMfidButton value={value} /> : null}
    </span>
  )
}
