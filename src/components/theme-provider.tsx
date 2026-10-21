import { ScriptOnce } from "@tanstack/react-router"
import { createContext, useContext, useEffect, useMemo, useState } from "react"

import {
  readDocumentCookies,
  themeCookie,
  writePresentationCookie,
} from "@/lib/viewer-presentation"
import type { ThemeChoice } from "@/lib/viewer-presentation"

type ThemeContextValue = {
  theme: ThemeChoice
  setTheme: (theme: ThemeChoice) => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

const legacyStorageKey = "crucible-hub-theme"

function isThemeChoice(value: unknown): value is ThemeChoice {
  return value === "light" || value === "dark" || value === "system"
}

function readLegacyTheme(): ThemeChoice | undefined {
  try {
    const stored = window.localStorage.getItem(legacyStorageKey)
    return isThemeChoice(stored) ? stored : undefined
  } catch {
    return undefined
  }
}

function themeScript() {
  const cookie = JSON.stringify(themeCookie)
  const legacy = JSON.stringify(legacyStorageKey)
  return `(function(){try{var m=document.cookie.match(new RegExp('(?:^|; )'+${cookie}+'=([^;]*)'));var t=m?decodeURIComponent(m[1]):localStorage.getItem(${legacy});var d=t==='light'||t==='dark'?t:(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.classList.remove('light','dark');document.documentElement.classList.add(d)}catch(e){}})()`
}

function resolveTheme(theme: ThemeChoice) {
  if (theme !== "system") return theme
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light"
}

function applyTheme(theme: ThemeChoice) {
  const resolved = resolveTheme(theme)
  document.documentElement.classList.remove("light", "dark")
  document.documentElement.classList.add(resolved)
}

export function ThemeProvider({
  children,
  initialTheme,
}: {
  children: React.ReactNode
  initialTheme: ThemeChoice
}) {
  const [theme, setThemeState] = useState<ThemeChoice>(initialTheme)

  useEffect(() => {
    if (readDocumentCookies()[themeCookie]) return
    const legacy = readLegacyTheme()
    if (!legacy) return
    writePresentationCookie(themeCookie, legacy)
    setThemeState(legacy)
  }, [])

  useEffect(() => {
    applyTheme(theme)
    if (theme !== "system") return
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const applySystemTheme = () => applyTheme("system")
    media.addEventListener("change", applySystemTheme)
    return () => media.removeEventListener("change", applySystemTheme)
  }, [theme])

  const value = useMemo(
    () => ({
      theme,
      setTheme: (nextTheme: ThemeChoice) => {
        writePresentationCookie(themeCookie, nextTheme)
        applyTheme(nextTheme)
        setThemeState(nextTheme)
      },
    }),
    [theme]
  )

  return (
    <ThemeContext.Provider value={value}>
      <ScriptOnce>{themeScript()}</ScriptOnce>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error("useTheme must be used within ThemeProvider")
  return context
}
