import { createFileRoute } from "@tanstack/react-router"

import { PersonIdentity } from "@/components/crucible/person-identity"
import { ResourceTypeIcon } from "@/components/crucible/resource-type-icon"
import { ThemeSelect } from "@/components/theme-select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"

export const Route = createFileRoute("/fixtures/design-system")({
  head: () => ({
    meta: [
      { title: "Design system fixtures | Crucible Hub" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: DesignSystemFixtures,
})

const themeRoles = [
  {
    name: "Primary",
    className: "bg-primary text-primary-foreground",
  },
  {
    name: "Secondary",
    className: "bg-secondary text-secondary-foreground",
  },
  { name: "Muted", className: "bg-muted text-muted-foreground" },
  { name: "Accent", className: "bg-accent text-accent-foreground" },
  {
    name: "Destructive",
    className: "bg-destructive text-destructive-foreground",
  },
  { name: "Success", className: "bg-success text-success-foreground" },
  { name: "Warning", className: "bg-warning text-warning-foreground" },
  { name: "Information", className: "bg-info text-info-foreground" },
] as const

const resourceTypes = [
  "project",
  "sample",
  "dataset",
  "instrument",
  "person",
] as const

const fixturePerson = {
  first_name: "Avery",
  last_name: "Raman",
  unique_id: "01PERSONIDENTITY000000000001",
  username: "araman",
}

function DesignSystemFixtures() {
  return (
    <main
      className="mx-auto flex min-h-svh max-w-content flex-col gap-page-section p-page-gutter md:p-page-gutter-medium xl:p-page-gutter-wide"
      data-testid="design-system-fixture"
    >
      <header className="flex flex-col gap-4 border-b pb-6 md:flex-row md:items-end md:justify-between">
        <div className="max-w-reading">
          <p className="text-overline text-muted-foreground uppercase">
            Crucible Hub
          </p>
          <h1 className="mt-2 text-title-page">Design system fixtures</h1>
          <p className="mt-3 text-body-prominent text-muted-foreground">
            A deterministic review surface for the shared visual language and
            interface states used across the desktop workspace.
          </p>
        </div>
        <ThemeSelect />
      </header>

      <section aria-labelledby="theme-title">
        <SectionHeading
          description="Foreground and background roles remain paired in every theme."
          id="theme-title"
          title="Theme roles"
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {themeRoles.map((role) => (
            <div
              className={`flex min-h-24 items-end rounded-xl p-4 ${role.className}`}
              key={role.name}
            >
              <span className="text-label">{role.name}</span>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="type-title">
        <SectionHeading
          description="Semantic roles define hierarchy without page-local font values."
          id="type-title"
          title="Typography"
        />
        <Card>
          <CardContent className="grid gap-5">
            <TypeSpecimen className="text-title-page" label="Page title" />
            <TypeSpecimen className="text-title-entity" label="Entity title" />
            <TypeSpecimen
              className="text-title-section"
              label="Section title"
            />
            <TypeSpecimen
              className="text-body-prominent"
              label="Prominent body"
            />
            <TypeSpecimen className="text-body" label="Body" />
            <TypeSpecimen
              className="font-mono text-identifier"
              label="Identifier"
            />
            <TypeSpecimen className="text-label" label="Label" />
            <TypeSpecimen className="text-supporting" label="Supporting" />
            <TypeSpecimen
              className="text-overline uppercase"
              label="Overline"
            />
            <TypeSpecimen className="text-metric tabular-nums" label="12,480" />
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="component-title">
        <SectionHeading
          description="Shared primitives and domain identities use the same density and focus language."
          id="component-title"
          title="Components"
        />
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Actions and status</CardTitle>
              <CardDescription>
                Default variants, disabled behavior, and compact status labels
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-3">
              <Button>Primary action</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="destructive">Remove access</Button>
              <Button disabled>Unavailable</Button>
            </CardContent>
            <CardFooter className="flex-wrap gap-2">
              <Badge variant="success">Active</Badge>
              <Badge variant="secondary">Member</Badge>
              <Badge variant="success">Complete</Badge>
              <Badge variant="warning">Pending</Badge>
              <Badge variant="outline">Limited details</Badge>
              <Badge variant="destructive">Failed</Badge>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Resource identity</CardTitle>
              <CardDescription>
                Stable icon assignments pair type with text
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {resourceTypes.map((type, index) => (
                <div className="flex items-center gap-3" key={type}>
                  <ResourceTypeIcon type={type} />
                  <div className="min-w-0 flex-1">
                    <p className="text-label capitalize">{type}</p>
                    <p className="font-mono text-identifier text-muted-foreground">
                      01J6Y8N4Q2R7M9K3T5V0W1X2Z{index}
                    </p>
                  </div>
                  <Badge variant="outline">{type}</Badge>
                </div>
              ))}
              <Separator />
              <div className="grid gap-3">
                <PersonIdentity person={fixturePerson} presentation="avatar" />
                <PersonIdentity person={fixturePerson} presentation="stacked" />
                <PersonIdentity
                  nameStyle="abbreviated"
                  person={fixturePerson}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section aria-labelledby="state-title">
        <SectionHeading
          description="Common states preserve context and describe what remains available."
          id="state-title"
          title="Interface states"
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <LoadingFixture />
          <EmptyFixture />
          <RestrictedFixture />
          <PartialFixture />
          <ErrorFixture />
          <DenseFixture />
        </div>
      </section>
    </main>
  )
}

function SectionHeading({
  description,
  id,
  title,
}: {
  description: string
  id: string
  title: string
}) {
  return (
    <div className="mb-4">
      <h2 className="text-title-section" id={id}>
        {title}
      </h2>
      <p className="mt-1 text-body text-muted-foreground">{description}</p>
    </div>
  )
}

function TypeSpecimen({
  className,
  label,
}: {
  className: string
  label: string
}) {
  return (
    <div className="grid gap-1 border-b pb-4 last:border-0 last:pb-0 sm:grid-cols-4 sm:items-baseline">
      <span className="text-label-compact text-muted-foreground">{label}</span>
      <span className={`sm:col-span-3 ${className}`}>
        Scientific data with clear hierarchy
      </span>
    </div>
  )
}

function LoadingFixture() {
  return (
    <Card aria-label="Loading state">
      <CardHeader>
        <CardTitle>Loading</CardTitle>
        <CardDescription>Stable geometry while data arrives</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </CardContent>
    </Card>
  )
}

function EmptyFixture() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Empty</CardTitle>
        <CardDescription>A useful starting point without data</CardDescription>
      </CardHeader>
      <CardContent>
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ResourceTypeIcon type="dataset" />
            </EmptyMedia>
            <EmptyTitle>No datasets yet</EmptyTitle>
            <EmptyDescription>
              Datasets connected to this workspace will appear here.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline">Browse samples</Button>
          </EmptyContent>
        </Empty>
      </CardContent>
    </Card>
  )
}

function RestrictedFixture() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Permission limited</CardTitle>
        <CardDescription>Public-safe details remain useful</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="flex items-start gap-3">
          <ResourceTypeIcon type="project" />
          <div className="min-w-0 flex-1">
            <p className="text-label">Catalysis reference study</p>
            <p className="mt-1 text-body text-muted-foreground">
              Membership and access details are not available.
            </p>
          </div>
          <Badge variant="outline">Limited details</Badge>
        </div>
      </CardContent>
    </Card>
  )
}

function PartialFixture() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Partial result</CardTitle>
        <CardDescription>Primary data remains readable</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div>
          <p className="text-label">NiFe K-edge operando series</p>
          <p className="text-body text-muted-foreground">
            X-ray absorption spectroscopy
          </p>
        </div>
        <Separator />
        <p className="text-body text-muted-foreground" role="status">
          File metadata could not be refreshed. Existing dataset details remain
          available.
        </p>
      </CardContent>
      <CardFooter>
        <Button variant="outline">Retry files</Button>
      </CardFooter>
    </Card>
  )
}

function ErrorFixture() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Terminal error</CardTitle>
        <CardDescription>
          Specific recovery without lost context
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Projects could not be loaded</EmptyTitle>
            <EmptyDescription>
              Your existing Crucible data has not been changed.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button>Try again</Button>
          </EmptyContent>
        </Empty>
      </CardContent>
    </Card>
  )
}

function DenseFixture() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Long and dense content</CardTitle>
        <CardDescription>Complete identifiers remain available</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <p className="text-label break-words">
          Spatially resolved operando hard X-ray absorption spectroscopy during
          accelerated electrochemical cycling
        </p>
        <p className="font-mono text-identifier break-all text-muted-foreground">
          01J6Y8N4Q2R7M9K3T5V0W1X2Z3-CANONICAL-RESOURCE-IDENTIFIER
        </p>
        <dl className="grid grid-cols-2 gap-3 text-body">
          <div>
            <dt className="text-muted-foreground">Measurement</dt>
            <dd className="mt-1 text-label">X-ray absorption spectroscopy</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Modified</dt>
            <dd className="mt-1 text-label">Sep 1, 2026</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  )
}
