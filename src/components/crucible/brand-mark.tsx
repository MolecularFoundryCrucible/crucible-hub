import crucibleIconDarkUrl from "@/assets/crucible-icon-dark.svg"
import crucibleIconLightUrl from "@/assets/crucible-icon-light.svg"
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
        className="size-full object-contain dark:hidden"
        src={crucibleIconLightUrl}
      />
      <img
        alt=""
        className="hidden size-full object-contain dark:block"
        src={crucibleIconDarkUrl}
      />
    </span>
  )
}
