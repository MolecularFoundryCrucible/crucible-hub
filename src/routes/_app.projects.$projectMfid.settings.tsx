import { Outlet, createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/_app/projects/$projectMfid/settings")({
  loader: async ({ parentMatchPromise }) =>
    (await parentMatchPromise).loaderData,
  component: Outlet,
})
