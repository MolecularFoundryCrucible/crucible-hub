import { isValidTimeZone, timeZoneCookie } from "./time-zone"

export const themeCookie = "crucible_hub_theme"
export const sidebarCookie = "crucible_hub_sidebar"

export type ThemeChoice = "dark" | "light" | "system"

export type ViewerPresentation = {
  sidebarOpen: boolean
  theme: ThemeChoice
  timeZone: string | undefined
}

export function parseViewerPresentation(
  cookies: Readonly<Record<string, string | undefined>>
): ViewerPresentation {
  const theme = cookies[themeCookie]
  const timeZone = cookies[timeZoneCookie]
  return {
    sidebarOpen: cookies[sidebarCookie] !== "collapsed",
    theme: theme === "dark" || theme === "light" ? theme : "system",
    timeZone: isValidTimeZone(timeZone) ? timeZone : undefined,
  }
}

export function writePresentationCookie(name: string, value: string) {
  const secure = window.location.protocol === "https:" ? "; Secure" : ""
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/hub; Max-Age=31536000; SameSite=Lax${secure}`
}

export function readDocumentCookies() {
  return Object.fromEntries(
    document.cookie
      .split("; ")
      .filter(Boolean)
      .map((entry) => {
        const index = entry.indexOf("=")
        return [
          entry.slice(0, index),
          decodeURIComponent(entry.slice(index + 1)),
        ]
      })
  )
}
