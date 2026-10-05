import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute(
  "/_app/instruments/$instrumentMfid/datasets"
)({
  validateSearch: (search: Record<string, unknown>) => search,
  beforeLoad: ({ params, search }) => {
    throw redirect({
      params: { instrumentMfid: params.instrumentMfid },
      replace: true,
      search,
      to: "/instruments/$instrumentMfid",
    })
  },
})
