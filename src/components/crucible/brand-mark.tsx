import crucibleMarkUrl from "@/assets/crucible-mark.svg"
import { cn } from "@/lib/utils"

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-md bg-brand-crucible-light-blue p-1",
        className
      )}
    >
      <img alt="" className="size-full" src={crucibleMarkUrl} />
    </span>
  )
}
