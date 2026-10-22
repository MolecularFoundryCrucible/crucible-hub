/**
 * The Hub motion system (decision 0036). Durations, easing and layers are
 * tokens in src/styles.css; these constants apply the motion roles.
 */

/** Fade newly revealed content in with the standard motion role. */
export const enterMotionClassName =
  "animate-in fade-in-0 duration-standard ease-enter"

/** Menus, popovers, comboboxes, hover cards and tooltips. */
export const anchoredOverlayMotionClassName =
  "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-open:duration-fast data-open:ease-enter data-closed:animate-out data-closed:fade-out-0 data-closed:duration-fast data-closed:ease-exit"

/** Dialogs and alert dialogs. */
export const modalMotionClassName =
  "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-open:duration-standard data-open:ease-enter data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-closed:duration-fast data-closed:ease-exit"

/** Backdrops behind dialogs and sheets. */
export const backdropMotionClassName =
  "data-open:animate-in data-open:fade-in-0 data-open:duration-standard data-open:ease-enter data-closed:animate-out data-closed:fade-out-0 data-closed:duration-fast data-closed:ease-exit"

export type MotionToken =
  | "--motion-deliberate"
  | "--motion-fast"
  | "--motion-indicator-delay"
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

/** A motion token in milliseconds, or 0 under reduced motion. */
export function motionDuration(token: MotionToken): number {
  if (typeof window === "undefined" || prefersReducedMotion()) return 0
  return parseCssTime(
    window.getComputedStyle(document.documentElement).getPropertyValue(token)
  )
}
