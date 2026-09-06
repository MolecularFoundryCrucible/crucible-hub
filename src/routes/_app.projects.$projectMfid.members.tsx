import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/_app/projects/$projectMfid/members")({
  beforeLoad: ({ params }) => {
    throw redirect({
      params: { projectMfid: params.projectMfid },
      replace: true,
      to: "/projects/$projectMfid/overview",
    })
  },
})
