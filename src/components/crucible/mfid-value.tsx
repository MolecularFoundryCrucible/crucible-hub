import { CopyIcon, CopySuccessIcon } from "@/components/crucible/icons"
import { IdentityFieldIcon } from "@/components/crucible/identity-field-icon"
import { MfidText } from "@/components/crucible/mfid-text"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useCopyFeedback } from "@/hooks/use-copy-feedback"
import { cn } from "@/lib/utils"

export function CopyMfidButton({
  size = "icon-xs",
  value,
}: {
  size?: "icon-xs" | "icon-sm"
  value: string
}) {
  const { copy, state: copyState } = useCopyFeedback()

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
              onClick={() => void copy(value)}
              size={size}
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
      <span className="sr-only" role="status">
        {copyState === "success" ? "MFID copied" : null}
      </span>
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
      <IdentityFieldIcon
        className={cn(
          "mfid-value-icon",
          presentation === "supporting" && "size-icon-supporting"
        )}
        type="mfid"
      />
      <MfidText
        className="min-w-0 break-all sm:break-normal sm:whitespace-nowrap"
        presentation={presentation}
        value={value}
      />
      {copyable ? <CopyMfidButton value={value} /> : null}
    </span>
  )
}
