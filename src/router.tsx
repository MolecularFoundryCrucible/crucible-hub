import { createRouter as createTanStackRouter } from "@tanstack/react-router"
import { createQueryClient } from "@/data/query-client"
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query"
import { routeTree } from "./routeTree.gen"

export function getRouter() {
  const queryClient = createQueryClient()
  const router = createTanStackRouter({
    routeTree,
    context: { queryClient },
    basepath: "/hub",
    scrollRestoration: true,
    getScrollRestorationKey: (location) =>
      location.state.resourcePreview?.returnKey ??
      location.state.__TSR_key ??
      location.href,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
  })

  setupRouterSsrQueryIntegration({ router, queryClient })

  return router
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
