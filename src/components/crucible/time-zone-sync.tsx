import { useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"

import { isValidTimeZone, timeZoneCookie } from "@/lib/time-zone"

const dateFilterKeys = ['"createdFrom"', '"createdTo"', '"activeSince"']

function storedTimeZone() {
  const entry = document.cookie
    .split("; ")
    .find((value) => value.startsWith(`${timeZoneCookie}=`))
  return entry
    ? decodeURIComponent(entry.slice(timeZoneCookie.length + 1))
    : null
}

export function TimeZoneSync() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (!isValidTimeZone(timeZone) || storedTimeZone() === timeZone) return
    const secure = window.location.protocol === "https:" ? "; Secure" : ""
    document.cookie = `${timeZoneCookie}=${encodeURIComponent(timeZone)}; Path=/hub; Max-Age=31536000; SameSite=Lax${secure}`
    void queryClient.invalidateQueries({
      predicate: (query) => {
        const key = JSON.stringify(query.queryKey)
        return dateFilterKeys.some((field) => key.includes(field))
      },
    })
  }, [queryClient])

  return null
}
