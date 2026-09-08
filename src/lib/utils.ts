import { clsx } from "clsx"
import type { ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: [
        "title-page",
        "title-entity",
        "title-section",
        "brand",
        "body-prominent",
        "body",
        "identifier",
        "label",
        "supporting",
        "label-compact",
        "overline",
        "metric",
      ],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
