import { Link, useMatch, useRouter } from "@tanstack/react-router"
import { isCancelledError } from "@tanstack/react-query"
import { useEffect } from "react"
import type { ErrorComponentProps } from "@tanstack/react-router"

import { PanelState } from "@/components/crucible/collection-state"
import { ContentBoundary } from "@/components/crucible/content-layout"
import { useRouteErrorReport } from "@/components/crucible/route-error-report"
import { Button } from "@/components/ui/button"

export function RouteError(props: ErrorComponentProps) {
  const inShell = useMatch({ from: "/_app", shouldThrow: false })
  if (!inShell) return <RootError {...props} />
  if (isCancelledError(props.error)) return <CancelledRoute />
  return <PageLoadError {...props} />
}

function PageLoadError({ error, info }: ErrorComponentProps) {
  const router = useRouter()
  const report = useRouteErrorReport({ error, info, scope: "page" })
  return (
    <ContentBoundary width="reading">
      <PanelState
        description={`${report.message} Reference: ${report.reference}`}
        retry={() => {
          if (report.reloadRequired) {
            window.location.reload()
            return
          }
          void router.invalidate()
        }}
        retryLabel={report.reloadRequired ? "Reload page" : "Try again"}
        role="alert"
        title="This page could not be loaded"
      />
    </ContentBoundary>
  )
}

export function RootError({ error, info, reset }: ErrorComponentProps) {
  if (isCancelledError(error)) {
    return <CancelledRoute />
  }

  return <ReportedRootError error={error} info={info} reset={reset} />
}

function ReportedRootError({ error, info }: ErrorComponentProps) {
  const router = useRouter()
  const report = useRouteErrorReport({ error, info, scope: "root-route" })
  return (
    <main className="mx-auto flex min-h-svh max-w-reading flex-col items-start justify-center gap-4 px-page-margin py-page-block">
      <p className="text-overline text-muted-foreground uppercase">
        Unable to load this page
      </p>
      <h1 className="text-title-page">
        Crucible Hub could not load this page.
      </h1>
      <p className="text-body-prominent text-muted-foreground">
        {report.message} Reference: {report.reference}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button nativeButton={false} render={<Link to="/" />}>
          Go home
        </Button>
        <Button
          onClick={() => {
            if (report.reloadRequired) {
              window.location.reload()
              return
            }
            void router.invalidate()
          }}
          variant="outline"
        >
          {report.reloadRequired ? "Reload page" : "Try again"}
        </Button>
      </div>
    </main>
  )
}

function CancelledRoute() {
  const router = useRouter()
  useEffect(() => {
    void router.invalidate({ sync: true })
  }, [router])
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="flex min-h-svh items-center justify-center px-page-margin py-page-block"
    >
      <span className="sr-only">Refreshing view...</span>
    </div>
  )
}
