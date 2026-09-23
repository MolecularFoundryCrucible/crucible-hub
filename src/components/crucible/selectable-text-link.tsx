import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import type { MouseEvent } from "react"

import { cn } from "@/lib/utils"

export function SelectableTextLink({
  className,
  render,
  ...props
}: useRender.ComponentProps<"a">) {
  return useRender({
    defaultTagName: "a",
    props: mergeProps<"a">(
      {
        className: cn(
          "min-w-0 rounded-sm text-left outline-none select-text hover:underline focus-visible:ring-2 focus-visible:ring-ring",
          className
        ),
        draggable: false,
        onClick: (event) => {
          preventNavigationForTextSelection(event)
        },
      },
      props
    ),
    render,
    state: { slot: "selectable-text-link" },
  })
}

export function preventNavigationForTextSelection(
  event: MouseEvent<HTMLAnchorElement>
) {
  if (
    event.detail === 0 ||
    event.button !== 0 ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey
  )
    return false
  const selection = window.getSelection()
  if (!selection || selection.isCollapsed) return false
  const selectedWithinTarget = Boolean(
    (selection.anchorNode &&
      event.currentTarget.contains(selection.anchorNode)) ||
    (selection.focusNode && event.currentTarget.contains(selection.focusNode))
  )
  if (selectedWithinTarget) event.preventDefault()
  return selectedWithinTarget
}
