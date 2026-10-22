/**
 * The Hub motion system (decision 0036). Durations, easing and layers are
 * tokens in src/styles.css; these constants apply the motion roles.
 */

/** Fade newly revealed content in with the standard motion role. */
export const enterMotionClassName =
  "animate-in fade-in-0 duration-standard ease-enter"

/** Menus, popovers, comboboxes, hover cards and tooltips. */
export const anchoredOverlayMotionClassName = "motion-anchored-overlay"

/** Dialogs and alert dialogs. */
export const modalMotionClassName = "motion-modal"

/** Backdrops behind dialogs and alert dialogs. */
export const backdropMotionClassName = "motion-backdrop"

export type MotionToken =
  | "--motion-deliberate"
  | "--motion-fast"
  | "--motion-indicator-delay"
  | "--motion-progress-delay"
  | "--motion-standard"

/** Milliseconds from a CSS time such as "180ms" or a minified ".18s". */
export function parseCssTime(value: string): number {
  const match = /^\s*(\d*\.?\d+)(ms|s)\s*$/.exec(value)
  if (!match) return 0
  const amount = Number(match[1])
  return match[2] === "s" ? Math.round(amount * 1000) : amount
}

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  )
}

/**
 * A motion token in milliseconds. Movement durations are 0 under reduced
 * motion; indicator delays are kept so fast responses still never flash.
 */
export function motionDuration(token: MotionToken): number {
  if (typeof window === "undefined") return 0
  if (!token.endsWith("-delay") && prefersReducedMotion()) return 0
  return parseCssTime(
    window.getComputedStyle(document.documentElement).getPropertyValue(token)
  )
}

/** The easing function a CSS `cubic-bezier(...)` value describes; linear otherwise. */
export function cubicBezier(value: string): (progress: number) => number {
  const match = /cubic-bezier\(([^)]+)\)/.exec(value)
  const points = match?.[1].split(",").map(Number)
  if (points?.length !== 4 || points.some(Number.isNaN))
    return (progress) => progress
  const [x1, y1, x2, y2] = points
  const curve = (a: number, b: number, t: number) =>
    3 * a * t * (1 - t) ** 2 + 3 * b * t ** 2 * (1 - t) + t ** 3
  return (progress) => {
    if (progress <= 0) return 0
    if (progress >= 1) return 1
    let low = 0
    let high = 1
    let t = progress
    for (let step = 0; step < 24; step++) {
      t = (low + high) / 2
      if (curve(x1, x2, t) < progress) low = t
      else high = t
    }
    return curve(y1, y2, t)
  }
}

/** A motion easing token as a function, for motion timed in script. */
export function motionEasing(
  token: "--motion-ease-enter" | "--motion-ease-exit" | "--motion-ease-standard"
): (progress: number) => number {
  if (typeof window === "undefined") return (progress) => progress
  return cubicBezier(
    window.getComputedStyle(document.documentElement).getPropertyValue(token)
  )
}
