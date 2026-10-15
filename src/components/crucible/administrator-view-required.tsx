import { Navigate } from "@tanstack/react-router"

import { useAdministratorViewControl } from "@/components/crucible/administrator-view-control"
import { AdministratorViewEnabledIcon } from "@/components/crucible/icons"
import { PageHeader } from "@/components/crucible/page-header"
import { PageLayout } from "@/components/crucible/page-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { canUseAdministratorView } from "@/data/crucible/administration"
import type { WorkspaceAccount } from "@/data/crucible/workspace-source"

export function AdministrationUnavailable({
  account,
  description,
  title,
}: {
  account: WorkspaceAccount
  description: string
  title: string
}) {
  if (!canUseAdministratorView(account)) return <Navigate replace to="/" />
  return <AdministratorViewRequired description={description} title={title} />
}

function AdministratorViewRequired({
  description,
  title,
}: {
  description: string
  title: string
}) {
  const { pending, setActive } = useAdministratorViewControl()

  return (
    <PageLayout>
      <PageHeader title={title} />
      <Card>
        <CardContent>
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Administrator view is off</EmptyTitle>
              <EmptyDescription>{description}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button
                disabled={pending}
                onClick={() => setActive(true)}
                variant="warning"
              >
                <AdministratorViewEnabledIcon
                  aria-hidden="true"
                  data-icon="inline-start"
                />
                Turn on administrator view
              </Button>
            </EmptyContent>
          </Empty>
        </CardContent>
      </Card>
    </PageLayout>
  )
}
