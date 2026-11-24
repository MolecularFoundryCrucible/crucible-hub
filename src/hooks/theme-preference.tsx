import { useEffect } from "react"

import { useTheme } from "@/components/theme-provider"
import type { ThemePreference } from "@/data/crucible/preferences"

import { useAccountPreferences } from "./use-account-preferences"

export function useThemePreference() {
  const { setTheme, theme } = useTheme()
  const { update } = useAccountPreferences()
  return {
    theme,
    setTheme: (next: ThemePreference) => {
      setTheme(next)
      update({ theme: next })
    },
  }
}

export function AccountThemeSync() {
  const { preferences } = useAccountPreferences()
  const { setTheme, theme } = useTheme()
  const saved = preferences.theme

  useEffect(() => {
    if (saved && saved !== theme) setTheme(saved)
  }, [saved, setTheme, theme])

  return null
}
