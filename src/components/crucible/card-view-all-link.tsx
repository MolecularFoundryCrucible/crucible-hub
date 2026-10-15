import type { ReactElement } from "react"

import { ForwardNavigationIcon } from "@/components/crucible/icons"
import { Button } from "@/components/ui/button"

export function CardViewAllLink({ render }: { render: ReactElement }) {
  return (
    <Button nativeButton={false} render={render} size="sm" variant="ghost">
      View all
      <ForwardNavigationIcon aria-hidden="true" data-icon="inline-end" />
    </Button>
  )
}
