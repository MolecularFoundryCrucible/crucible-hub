import { useRef } from "react"
import { flushSync } from "react-dom"

import { ListExpansionIcon } from "@/components/crucible/icons"
import { Button } from "@/components/ui/button"
import { enterMotionClassName } from "@/lib/motion"

export const COLLAPSED_LIST_LIMIT = 10

export function revealedRowClassName(index: number) {
  return index >= COLLAPSED_LIST_LIMIT ? enterMotionClassName : undefined
}

function expansionRegion(controls: string) {
  const element = document.getElementById(controls)
  return element?.closest("[data-slot=table-container]") ?? element
}

function animateGrowth(region: Element, from: number, to: number) {
  if (
    !(region instanceof HTMLElement) ||
    to <= from ||
    typeof region.animate !== "function" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  )
    return
  const root = getComputedStyle(document.documentElement)
  const duration = parseFloat(root.getPropertyValue("--motion-standard"))
  if (!duration) return
  const overflow = region.style.overflow
  region.style.overflow = "clip"
  const animation = region.animate(
    [{ height: `${from}px` }, { height: `${to}px` }],
    {
      duration,
      easing: root.getPropertyValue("--motion-ease-standard").trim(),
    }
  )
  const restore = () => {
    region.style.overflow = overflow
  }
  animation.onfinish = restore
  animation.oncancel = restore
}

export function ListExpansionToggle({
  controls,
  expanded,
  noun,
  onExpandedChange,
  total,
}: {
  controls: string
  expanded: boolean
  noun: string
  onExpandedChange: (expanded: boolean) => void
  total: number
}) {
  const button = useRef<HTMLButtonElement>(null)

  function toggle() {
    const region = expansionRegion(controls)
    const from = region?.getBoundingClientRect().height ?? 0
    const top = button.current?.getBoundingClientRect().top
    flushSync(() => onExpandedChange(!expanded))
    if (expanded) {
      const after = button.current?.getBoundingClientRect().top
      if (top !== undefined && after !== undefined && after !== top)
        window.scrollBy({ behavior: "instant", top: after - top })
      return
    }
    if (region)
      animateGrowth(region, from, region.getBoundingClientRect().height)
  }

  return (
    <Button
      aria-controls={controls}
      aria-expanded={expanded}
      onClick={toggle}
      ref={button}
      size="sm"
      type="button"
      variant="ghost"
    >
      <ListExpansionIcon
        aria-hidden="true"
        className="transition-transform group-aria-expanded/button:rotate-180"
        data-icon="inline-start"
      />
      {expanded ? `Show fewer ${noun}` : `Show all ${total} ${noun}`}
    </Button>
  )
}
