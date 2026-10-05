import type { Dispatch, SetStateAction } from "react"

import { checkWorkspaceUsername } from "@/data/crucible/account.functions"
import type { FixtureScenario } from "@/data/crucible/fixture-scenarios"
import { unwrapHubResult } from "@/data/crucible/result"
import { USERNAME_MAX_LENGTH, usernameSchema } from "@/data/crucible/slugs"
import { SlugAvailabilityField } from "@/features/forms/slug-availability"
import type { ProfileField } from "./account-profile-fields"

export function UsernameAvailability({
  currentUsername,
  field,
  onLiveTakenChange,
  rejectedUsername,
  scenario,
}: {
  currentUsername: string | null | undefined
  field: Parameters<typeof ProfileField>[0]["field"]
  onLiveTakenChange: Dispatch<SetStateAction<string | undefined>>
  rejectedUsername?: string
  scenario?: FixtureScenario
}) {
  return (
    <SlugAvailabilityField
      autoComplete="nickname"
      checkAvailability={async (candidate, signal) => {
        const result = await checkWorkspaceUsername({
          data: { scenario, username: candidate },
          signal,
        })
        return unwrapHubResult(result)
      }}
      currentValue={currentUsername}
      entityLabel="Username"
      field={field}
      label="Username"
      maxLength={USERNAME_MAX_LENGTH}
      onLiveTakenChange={onLiveTakenChange}
      rejectedValue={rejectedUsername}
      required
      schema={usernameSchema}
    />
  )
}
