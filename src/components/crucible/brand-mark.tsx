import crucibleIconDarkUrl from "@/assets/crucible-icon-dark.svg"
import crucibleIconLightUrl from "@/assets/crucible-icon-light.svg"
import crucibleLogoHubUrl from "@/assets/crucible-logo-hub.svg"
import { cn } from "@/lib/utils"

export interface BrandMarkProps {
  className?: string
  variant?: "logo" | "icon"
}

export function BrandMark({ className, variant = "logo" }: BrandMarkProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center",
        variant === "icon" ? "size-4" : "size-8",
        className
      )}
    >
      {variant === "icon" ? (
        <>
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
        </>
      ) : (
        <img
          alt=""
          className="size-full object-contain"
          src={crucibleLogoHubUrl}
        />
      )}
    </span>
  )
}
