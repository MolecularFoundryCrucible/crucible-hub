/**
 * Window classes, from narrowest to widest. The thresholds mirror the
 * `--breakpoint-md`, `--breakpoint-lg` and `--breakpoint-wide` tokens in
 * src/styles.css; window-class.test.ts keeps them in step.
 */
export const windowClasses = ["compact", "medium", "expanded", "wide"] as const

export type WindowClass = (typeof windowClasses)[number]

export const windowClassBreakpoints = {
  medium: "48rem",
  expanded: "64rem",
  wide: "90rem",
} as const

export const windowClassCookie = "crucible_hub_window"

export function isWindowClass(value: unknown): value is WindowClass {
  return windowClasses.some((windowClass) => windowClass === value)
}

/** Whether `current` is at least as wide as `minimum`. */
export function windowClassAtLeast(current: WindowClass, minimum: WindowClass) {
  return windowClasses.indexOf(current) >= windowClasses.indexOf(minimum)
}

export function windowClassForMatches(matches: {
  expanded: boolean
  medium: boolean
  wide: boolean
}): WindowClass {
  if (matches.wide) return "wide"
  if (matches.expanded) return "expanded"
  if (matches.medium) return "medium"
  return "compact"
}
