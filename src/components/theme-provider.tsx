import { ScriptOnce } from "@tanstack/react-router"
import { createContext, useContext, useEffect, useMemo, useState } from "react"

type Theme = "dark" | "light" | "system"

type ThemeContextValue = {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

const storageKey = "crucible-hub-theme"

function readStoredTheme(): Theme | undefined {
  try {
    const stored = window.localStorage.getItem(storageKey)
    return stored === "light" || stored === "dark" || stored === "system"
      ? stored
      : undefined
  } catch {
    return undefined
  }
}

function storeTheme(theme: Theme) {
  try {
    window.localStorage.setItem(storageKey, theme)
  } catch {
    return
  }
}

function themeScript() {
  const key = JSON.stringify(storageKey)
  return `(function(){try{var t=localStorage.getItem(${key});var v=t==='light'||t==='dark'||t==='system'?t:'system';var d=v==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):v;document.documentElement.classList.remove('light','dark');document.documentElement.classList.add(d);document.documentElement.style.colorScheme=d}catch(e){}})()`
}

function resolveTheme(theme: Theme) {
  if (theme !== "system") return theme
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light"
}

function applyTheme(theme: Theme) {
  const resolved = resolveTheme(theme)
  document.documentElement.classList.remove("light", "dark")
  document.documentElement.classList.add(resolved)
  document.documentElement.style.colorScheme = resolved
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system")

  useEffect(() => {
    const stored = readStoredTheme()
    if (stored) setThemeState(stored)
  }, [])

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const applyCurrentTheme = () => applyTheme(theme)

    applyCurrentTheme()
    media.addEventListener("change", applyCurrentTheme)
    return () => media.removeEventListener("change", applyCurrentTheme)
  }, [theme])

  const value = useMemo(
    () => ({
      theme,
      setTheme: (nextTheme: Theme) => {
        storeTheme(nextTheme)
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
