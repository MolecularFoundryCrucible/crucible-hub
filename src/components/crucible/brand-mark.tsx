import crucibleLogoHubUrl from "@/assets/crucible-logo-hub.svg"
import { cn } from "@/lib/utils"

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-8 shrink-0 items-center justify-center",
        className
      )}
    >
      <img
        alt=""
        className="size-full object-contain"
        src={crucibleLogoHubUrl}
      />
    </span>
  )
}
