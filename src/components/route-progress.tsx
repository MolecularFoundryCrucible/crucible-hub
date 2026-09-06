import { useRouterState } from "@tanstack/react-router"

export function RouteProgress() {
  const isLoading = useRouterState({
    select: (state) => state.status === "pending",
  })
  return (
    <div
      className="route-progress"
      data-active={isLoading || undefined}
      aria-hidden="true"
    />
  )
}
