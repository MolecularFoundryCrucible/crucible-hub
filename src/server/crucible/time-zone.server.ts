import "@tanstack/react-start/server-only"

import { getCookie } from "@tanstack/react-start/server"

import {
  isValidTimeZone,
  serverFallbackTimeZone,
  timeZoneCookie,
} from "@/lib/time-zone"

export function viewerTimeZone() {
  try {
    const value = getCookie(timeZoneCookie)
    return value && isValidTimeZone(value) ? value : serverFallbackTimeZone
  } catch {
    return serverFallbackTimeZone
  }
}
