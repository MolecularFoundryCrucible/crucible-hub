import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  useRouter,
} from "@tanstack/react-router"
import { isCancelledError } from "@tanstack/react-query"
import { useEffect } from "react"

import crucibleLogoHubUrl from "@/assets/crucible-logo-hub.svg"
import { RouteProgress } from "@/components/route-progress"
import { useRouteErrorReport } from "@/components/crucible/route-error-report"
import { ThemeProvider } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/toast"
import type { RouterContext } from "@/router-context"
import type { ErrorComponentProps } from "@tanstack/react-router"

import appCss from "../styles.css?url"

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "Crucible Hub",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      {
        rel: "icon",
        href: crucibleLogoHubUrl,
        type: "image/svg+xml",
      },
    ],
  }),
  notFoundComponent: () => (
    <main className="mx-auto flex min-h-screen max-w-reading flex-col justify-center px-page-gutter-wide">
      <p className="text-overline text-muted-foreground">404</p>
      <h1 className="mt-2 text-title-page">Page not found</h1>
      <p className="mt-3 text-body-prominent text-muted-foreground">
        The requested page could not be found.
      </p>
    </main>
  ),
  errorComponent: RootError,
  component: Outlet,
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <ThemeProvider>
          <TooltipProvider>
            <RouteProgress />
            {children}
            <Toaster limit={3} timeout={5000} />
          </TooltipProvider>
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  )
}

function RootError({ error, info, reset }: ErrorComponentProps) {
  if (isCancelledError(error)) {
    return <CancelledRoute reset={reset} />
  }

  return <ReportedRootError error={error} info={info} reset={reset} />
}

function ReportedRootError({ error, info }: ErrorComponentProps) {
  const router = useRouter()
  const report = useRouteErrorReport({ error, info, scope: "root-route" })
  return (
    <main className="mx-auto flex min-h-svh max-w-reading flex-col items-start justify-center gap-4 p-page-gutter-wide">
      <p className="text-overline text-muted-foreground uppercase">
        Unable to load this page
      </p>
      <h1 className="text-title-page">
        Crucible Hub could not load this page.
      </h1>
      <p className="text-body-prominent text-muted-foreground">
        {report.message} Reference: {report.reference}
      </p>
      <Button
        onClick={() => {
          if (report.reloadRequired) {
            window.location.reload()
            return
          }
          void router.invalidate()
        }}
      >
        {report.reloadRequired ? "Reload page" : "Try again"}
      </Button>
    </main>
  )
}

function CancelledRoute({ reset }: { reset: () => void }) {
  useEffect(() => reset(), [reset])
  return null
}
