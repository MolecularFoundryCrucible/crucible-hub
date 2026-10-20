import { cn } from "@/lib/utils"

export type PaletteRamp = "neutral" | "blue" | "orange"

export const paletteSteps: Record<PaletteRamp, number> = {
  neutral: 13,
  blue: 10,
  orange: 7,
}

function PaletteSwatch({
  className,
  ramp,
  step,
}: {
  className?: string
  ramp: PaletteRamp
  step: number
}) {
  return (
    <span
      aria-hidden="true"
      className={cn("block h-10 rounded-md border", className)}
      data-slot="palette-swatch"
      style={{ background: `var(--palette-${ramp}-${step})` }}
    />
  )
}

export { PaletteSwatch }
