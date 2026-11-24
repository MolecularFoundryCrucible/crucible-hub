import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from "@tanstack/react-router"

import crucibleLogoHubUrl from "@/assets/crucible-logo-hub.svg?no-inline"
import { RouteProgress } from "@/components/route-progress"
import { RootError } from "@/components/crucible/route-error"
import { ThemeProvider } from "@/components/theme-provider"
import { ViewerPresentationProvider } from "@/hooks/use-viewer-presentation"
import { readViewerPresentation } from "@/lib/read-viewer-presentation"
import { Button } from "@/components/ui/button"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/toast"
import { RecentlyViewedProvider } from "@/features/recently-viewed/recently-viewed"
import type { RouterContext } from "@/router-context"

import appCss from "../styles.css?url"

export const Route = createRootRouteWithContext<RouterContext>()({
  beforeLoad: () => ({ presentation: readViewerPresentation() }),
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
    <main className="mx-auto flex min-h-screen max-w-reading flex-col justify-center px-page-margin">
      <p className="text-overline text-muted-foreground">404</p>
      <h1 className="mt-2 text-title-page">Page not found</h1>
      <p className="mt-3 text-body-prominent text-muted-foreground">
        The requested page could not be found.
      </p>
      <div className="mt-6">
        <Button nativeButton={false} render={<Link to="/" />}>
          Go home
        </Button>
      </div>
    </main>
  ),
  errorComponent: RootError,
  component: Outlet,
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  const { presentation } = Route.useRouteContext()
  const theme = presentation.theme === "system" ? undefined : presentation.theme
  return (
    <html className={theme} lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <ViewerPresentationProvider value={presentation}>
          <RecentlyViewedProvider>
            <ThemeProvider initialTheme={presentation.theme}>
              <TooltipProvider>
                <RouteProgress />
                {children}
                <Toaster limit={3} timeout={5000} />
              </TooltipProvider>
            </ThemeProvider>
          </RecentlyViewedProvider>
        </ViewerPresentationProvider>
        <Scripts />
      </body>
    </html>
  )
}
