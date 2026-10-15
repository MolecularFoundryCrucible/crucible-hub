import { useRender } from "@base-ui/react/use-render"
import type { ReactElement } from "react"

import { ForwardNavigationIcon } from "@/components/crucible/icons"
import { buttonVariants } from "@/components/ui/button"

export function CardViewAllLink({ render }: { render: ReactElement }) {
  return useRender({
    defaultTagName: "a",
    props: {
      children: (
        <>
          View all
          <ForwardNavigationIcon aria-hidden="true" data-icon="inline-end" />
        </>
      ),
      className: buttonVariants({ size: "sm", variant: "ghost" }),
    },
    render,
    state: { slot: "button" },
  })
}
