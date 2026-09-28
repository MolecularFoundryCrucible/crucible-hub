import { useEffect, useState } from "react"
import type { Dispatch, SetStateAction } from "react"

import {
  UsernameAvailableIcon,
  UsernameCheckUnavailableIcon,
  UsernameCheckingIcon,
  UsernameTakenIcon,
} from "@/components/crucible/icons"
import { InputGroupText } from "@/components/ui/input-group"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { checkWorkspaceUsername } from "@/data/crucible/account.functions"
import type { FixtureScenario } from "@/data/crucible/fixture-scenarios"
import { unwrapHubResult } from "@/data/crucible/result"
import { ProfileField, accountProfileSchema } from "./account-profile-fields"

type CheckResult = {
  result: "taken" | "no-exact-match" | "error"
  username: string
}

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
  const [checked, setChecked] = useState<CheckResult>()
  const candidate = field.state.value.trim()
  const rejected = candidate === rejectedUsername
  const shouldCheck =
    !rejected &&
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
          const taken = unwrapHubResult(result)
          setChecked({
            result: taken ? "taken" : "no-exact-match",
            username: candidate,
          })
          onLiveTakenChange(taken ? candidate : undefined)
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
  }, [candidate, onLiveTakenChange, scenario, shouldCheck])

  const status = rejected
    ? "taken"
    : !shouldCheck
      ? null
      : checked?.username === candidate
        ? checked.result
        : "checking"
  const Icon =
    status === "taken"
      ? UsernameTakenIcon
      : status === "no-exact-match"
        ? UsernameAvailableIcon
        : status === "error"
          ? UsernameCheckUnavailableIcon
          : UsernameCheckingIcon
  const label =
    status === "taken"
      ? "Username already taken"
      : status === "no-exact-match"
        ? "No exact match. Final availability check on save."
        : status === "error"
          ? "Could not check now. Save will verify."
          : "Checking username"

  const adornment = status ? (
    <Tooltip>
      <TooltipTrigger
        render={
          <InputGroupText
            className={
              status === "taken"
                ? "text-destructive"
                : status === "no-exact-match"
                  ? "text-success"
                  : undefined
            }
            role="status"
            tabIndex={0}
          />
        }
      >
        <Icon
          aria-hidden="true"
          className={
            status === "checking" ? "motion-safe:animate-spin" : undefined
          }
        />
        <span className="sr-only">{label}</span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  ) : null

  return (
    <ProfileField
      endAdornment={
        adornment ?? (
          <InputGroupText aria-hidden="true" className="invisible">
            <UsernameCheckingIcon />
          </InputGroupText>
        )
      }
      field={field}
      invalid={status === "taken"}
      label="Username"
      maxLength={24}
      required
    />
  )
}
