import { useEffect, useState } from "react"

import { BackToTopIcon } from "@/components/crucible/icons"
import { Button } from "@/components/ui/button"
import { prefersReducedMotion } from "@/lib/motion"

const pageTopSelector = "[data-page-top]"

export function BackToTop() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const target = document.querySelector<HTMLElement>(pageTopSelector)
    if (!target || typeof IntersectionObserver === "undefined") return

    const observer = new IntersectionObserver(
      ([entry]) => setVisible(!entry.isIntersecting),
      { rootMargin: "-56px 0px 0px 0px" }
    )
    observer.observe(target)
    return () => observer.disconnect()
  }, [])

  if (!visible) return null

  return (
    <Button
      aria-label="Back to top"
      className="fixed right-page-gutter bottom-page-gutter z-(--layer-floating-utility)"
      onClick={() => {
        const target = document.querySelector<HTMLElement>(pageTopSelector)
        if (!target) return
        target.focus({ preventScroll: true })
        target.scrollIntoView({
          behavior: prefersReducedMotion() ? "auto" : "smooth",
          block: "start",
        })
      }}
      size="floating"
      type="button"
      variant="outline"
    >
      <BackToTopIcon aria-hidden="true" data-icon="inline-start" />
      <span className="hidden sm:inline">Back to top</span>
    </Button>
  )
}
