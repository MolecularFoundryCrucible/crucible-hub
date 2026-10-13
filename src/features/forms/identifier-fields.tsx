import type { ComponentProps } from "react"

import { checkWorkspaceUsername } from "@/data/crucible/account.functions"
import type { FixtureScenario } from "@/data/crucible/fixture-scenarios"
import { unwrapHubResult } from "@/data/crucible/result"
import {
  INSTRUMENT_ID_MAX_LENGTH,
  checkWorkspaceInstrumentId,
} from "@/data/crucible/instruments.functions"
import { checkWorkspaceProjectId } from "@/data/crucible/projects.functions"
import {
  EMAIL_MAX_LENGTH,
  PROJECT_ID_MAX_LENGTH,
  USERNAME_MAX_LENGTH,
  emailSchema,
  instrumentIdSchema,
  projectIdSchema,
  usernameSchema,
} from "@/data/crucible/slugs"
import { checkWorkspaceEmail } from "@/data/crucible/users.functions"

import { SlugAvailabilityField } from "./slug-availability"

type IdentifierFieldProps = Omit<
  ComponentProps<typeof SlugAvailabilityField>,
  | "checkAvailability"
  | "entityLabel"
  | "label"
  | "maxLength"
  | "schema"
  | "type"
> & {
  label?: string
  scenario?: FixtureScenario
}

export function UsernameField({
  autoComplete = "nickname",
  label = "Username",
  scenario,
  ...props
}: IdentifierFieldProps) {
  return (
    <SlugAvailabilityField
      {...props}
      autoComplete={autoComplete}
      checkAvailability={async (candidate, signal) =>
        unwrapHubResult(
          await checkWorkspaceUsername({
            data: { scenario, username: candidate },
            signal,
          })
        )
      }
      entityLabel="Username"
      label={label}
      maxLength={USERNAME_MAX_LENGTH}
      schema={usernameSchema}
    />
  )
}

export function EmailField({
  autoComplete = "email",
  label = "Email address",
  scenario,
  ...props
}: IdentifierFieldProps) {
  return (
    <SlugAvailabilityField
      {...props}
      autoComplete={autoComplete}
      checkAvailability={async (candidate, signal) =>
        unwrapHubResult(
          await checkWorkspaceEmail({
            data: { email: candidate, scenario },
            signal,
          })
        )
      }
      entityLabel="Email"
      label={label}
      maxLength={EMAIL_MAX_LENGTH}
      schema={emailSchema}
      type="email"
    />
  )
}

export function ProjectIdField({
  label = "Project ID",
  scenario,
  ...props
}: IdentifierFieldProps) {
  return (
    <SlugAvailabilityField
      {...props}
      checkAvailability={async (candidate, signal) =>
        unwrapHubResult(
          await checkWorkspaceProjectId({
            data: { projectId: candidate, scenario },
            signal,
          })
        )
      }
      entityLabel="Project ID"
      label={label}
      maxLength={PROJECT_ID_MAX_LENGTH}
      schema={projectIdSchema}
    />
  )
}

export function InstrumentIdField({
  label = "Instrument ID",
  scenario,
  ...props
}: IdentifierFieldProps) {
  return (
    <SlugAvailabilityField
      {...props}
      checkAvailability={async (candidate, signal) =>
        unwrapHubResult(
          await checkWorkspaceInstrumentId({
            data: { instrumentId: candidate, scenario },
            signal,
          })
        )
      }
      entityLabel="Instrument ID"
      label={label}
      maxLength={INSTRUMENT_ID_MAX_LENGTH}
      schema={instrumentIdSchema}
    />
  )
}
