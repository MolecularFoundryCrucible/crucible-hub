import { Link, createFileRoute } from "@tanstack/react-router"

import { buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { FixtureScenario } from "@/data/crucible/fixture-scenarios"

export const Route = createFileRoute("/fixtures/scenarios")({
  head: () => ({
    meta: [
      { title: "Route scenarios | Crucible Hub" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ScenarioFixtures,
})

const scenarios = [
  {
    id: "populated",
    title: "Populated workspace",
    description: "The normal representative workspace.",
    route: "/",
  },
  {
    id: "empty",
    title: "Empty workspace",
    description:
      "Valid account with no projects, instruments, samples, or datasets.",
    route: "/",
  },
  {
    id: "restricted",
    title: "Restricted workspace",
    description: "Only a minimal project representation is visible.",
    route: "/projects",
  },
  {
    id: "dense",
    title: "Dense data",
    description: "Long names, full pages, and active pagination controls.",
    route: "/data",
  },
  {
    id: "partial",
    title: "Partial availability",
    description:
      "Dataset requests fail while the rest of the dashboard remains usable.",
    route: "/",
  },
  {
    id: "degraded",
    title: "Degraded availability",
    description:
      "Instrument requests fail while primary workspace data remains usable.",
    route: "/",
  },
] as const satisfies ReadonlyArray<{
  id: FixtureScenario
  title: string
  description: string
  route: "/" | "/data" | "/projects"
}>

function ScenarioFixtures() {
  if (!import.meta.env.DEV) {
    return (
      <main className="mx-auto flex min-h-svh max-w-reading items-center px-page-margin py-page-block">
        <p className="text-body-prominent text-muted-foreground">
          Route scenarios are available only during development.
        </p>
      </main>
    )
  }

  return (
    <main className="mx-auto flex min-h-svh max-w-content flex-col gap-page-section px-page-margin py-page-block">
      <header className="max-w-reading">
        <p className="text-overline text-muted-foreground uppercase">
          Crucible Hub
        </p>
        <h1 className="mt-2 text-title-page">Route scenarios</h1>
        <p className="mt-3 text-body-prominent text-muted-foreground">
          Open deterministic data states in the real application routes and
          shell.
        </p>
      </header>
      <section className="grid gap-4 md:grid-cols-2" aria-label="Scenarios">
        {scenarios.map((scenario) => (
          <Card key={scenario.id}>
            <CardHeader>
              <CardTitle>{scenario.title}</CardTitle>
              <CardDescription>{scenario.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Link
                className={buttonVariants({ variant: "outline" })}
                search={{ scenario: scenario.id }}
                to={scenario.route}
              >
                Open scenario
              </Link>
            </CardContent>
          </Card>
        ))}
      </section>
    </main>
  )
}
