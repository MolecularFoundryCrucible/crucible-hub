import { isValidTimeZone, timeZoneCookie } from "./time-zone"
import { isWindowClass, windowClassCookie } from "./window-class"
import type { WindowClass } from "./window-class"

export const themeCookie = "crucible_hub_theme"
export const sidebarCookie = "crucible_hub_sidebar"
export const inspectorCookie = "crucible_hub_inspector"

export type ThemeChoice = "dark" | "light" | "system"

export type ViewerPresentation = {
  inspectorOpen: boolean
  sidebarOpen: boolean
  theme: ThemeChoice
  timeZone: string | undefined
  windowClass: WindowClass
}

export function parseViewerPresentation(
  cookies: Readonly<Record<string, string | undefined>>
): ViewerPresentation {
  const theme = cookies[themeCookie]
  const timeZone = cookies[timeZoneCookie]
  const windowClass = cookies[windowClassCookie]
  return {
    inspectorOpen: cookies[inspectorCookie] !== "collapsed",
    sidebarOpen: cookies[sidebarCookie] !== "collapsed",
    theme: theme === "dark" || theme === "light" ? theme : "system",
    timeZone: isValidTimeZone(timeZone) ? timeZone : undefined,
    windowClass: isWindowClass(windowClass) ? windowClass : "expanded",
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
