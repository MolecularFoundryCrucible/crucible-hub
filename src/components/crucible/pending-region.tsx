import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"

import { cn } from "@/lib/utils"

/**
 * A region whose content is being reloaded: it stays readable and dims after
 * the indicator delay (decision 0036).
 */
export function PendingRegion({
  className,
  pending,
  render,
  ...props
}: useRender.ComponentProps<"div"> & { pending: boolean }) {
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        "aria-busy": pending || undefined,
        className: cn("pending-region", className),
      },
      props
    ),
    render,
    state: { pending },
    stateAttributesMapping: {
      pending: (value) => (value ? { "data-pending": "" } : null),
    },
  })
}
