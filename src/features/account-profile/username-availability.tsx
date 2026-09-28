import { useEffect, useState } from "react"

import { checkWorkspaceUsername } from "@/data/crucible/account.functions"
import type { FixtureScenario } from "@/data/crucible/fixture-scenarios"
import { unwrapHubResult } from "@/data/crucible/result"
import { accountProfileSchema } from "./account-profile-fields"

type CheckResult = {
  result: "taken" | "no-exact-match" | "error"
  username: string
}

export function UsernameAvailability({
  currentUsername,
  scenario,
  username,
}: {
  currentUsername: string | null | undefined
  scenario?: FixtureScenario
  username: string
}) {
  const [checked, setChecked] = useState<CheckResult>()
  const candidate = username.trim()
  const shouldCheck =
    candidate !== currentUsername &&
    accountProfileSchema.shape.username.safeParse(candidate).success

  useEffect(() => {
    if (!shouldCheck) return
    const controller = new AbortController()
    let active = true
    const timeout = window.setTimeout(() => {
      void checkWorkspaceUsername({
        data: { username: candidate, scenario },
        signal: controller.signal,
      })
        .then((result) => {
          if (!active) return
          setChecked({
            result: unwrapHubResult(result) ? "taken" : "no-exact-match",
            username: candidate,
          })
        })
        .catch(() => {
          if (active) setChecked({ result: "error", username: candidate })
        })
    }, 400)
    return () => {
      active = false
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [candidate, scenario, shouldCheck])

  if (!shouldCheck) return null
  if (checked?.username !== candidate) {
    return <p className="text-supporting text-muted-foreground">Checking...</p>
  }
  if (checked.result === "taken") {
    return (
      <p className="text-supporting text-destructive" role="status">
        Username already taken.
      </p>
    )
  }
  if (checked.result === "error") {
    return (
      <p className="text-supporting text-muted-foreground" role="status">
        Check unavailable. Try saving.
      </p>
    )
  }
  return (
    <p className="text-supporting text-muted-foreground" role="status">
      No exact match. Final check on save.
    </p>
  )
}
