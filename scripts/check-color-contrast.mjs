import { readFileSync } from "node:fs"
import { converter, parse, wcagContrast } from "culori"

const source = readFileSync("src/styles.css", "utf8")
const toRgb = converter("rgb")

function block(marker) {
  const start = source.indexOf(marker)
  if (start === -1) throw new Error(`Missing color theme ${marker.trim()}`)
  const open = source.indexOf("{", start)
  let depth = 1
  let cursor = open + 1
  while (depth > 0 && cursor < source.length) {
    if (source[cursor] === "{") depth += 1
    if (source[cursor] === "}") depth -= 1
    cursor += 1
  }
  return source.slice(open + 1, cursor - 1)
}

function declarations(marker) {
  const values = new Map()
  for (const match of block(marker).matchAll(/--([\w-]+):\s*([^;]+);/g)) {
    values.set(match[1], match[2].trim())
  }
  return values
}

const shared = declarations("\n:root {")
const themes = {
  light: shared,
  dark: new Map([...shared, ...declarations("\n.dark {")]),
}

function resolve(values, name, seen = new Set()) {
  if (seen.has(name)) throw new Error(`Circular color token --${name}`)
  const value = values.get(name)
  if (!value) throw new Error(`Missing color token --${name}`)
  const reference = value.match(/^var\(--([\w-]+)\)$/)
  if (!reference) return value
  return resolve(values, reference[1], new Set([...seen, name]))
}

function token(values, name) {
  const value = resolve(values, name)
  const color = parse(value)
  if (!color) throw new Error(`Cannot parse --${name}: ${value}`)
  return color
}

function composite(foreground, background, opacity = 1) {
  const front = toRgb(foreground)
  const back = toRgb(background)
  const alpha = (front.alpha ?? 1) * opacity
  return {
    mode: "rgb",
    r: front.r * alpha + back.r * (1 - alpha),
    g: front.g * alpha + back.g * (1 - alpha),
    b: front.b * alpha + back.b * (1 - alpha),
  }
}

function contrast(values, foregroundName, backgroundName, opacity = 1) {
  const background = token(values, backgroundName)
  return wcagContrast(
    composite(token(values, foregroundName), background, opacity),
    background
  )
}

const failures = []

function expectContrast(
  theme,
  values,
  foreground,
  background,
  minimum,
  opacity
) {
  const ratio = contrast(values, foreground, background, opacity)
  if (ratio < minimum) {
    failures.push(
      `${theme}: --${foreground} on --${background} is ${ratio.toFixed(2)}:1, expected at least ${minimum}:1`
    )
  }
}

for (const [theme, values] of Object.entries(themes)) {
  for (const surface of ["background", "card", "popover"]) {
    expectContrast(theme, values, "foreground", surface, 4.5)
    expectContrast(theme, values, "muted-foreground", surface, 4.5)
  }

  for (const surface of ["background", "card"]) {
    expectContrast(theme, values, "input", surface, 3)
    expectContrast(theme, values, "border-strong", surface, 3)
    expectContrast(theme, values, "ring", surface, 3, 0.5)
    expectContrast(theme, values, "selection", surface, 3)
    expectContrast(theme, values, "graph-edge", surface, 3)
  }

  expectContrast(theme, values, "primary-foreground", "primary", 4.5)
  expectContrast(theme, values, "primary-foreground", "primary-hover", 4.5)
  expectContrast(theme, values, "secondary-foreground", "secondary", 4.5)
  expectContrast(theme, values, "foreground", "action-pressed", 4.5)
  expectContrast(theme, values, "foreground", "action-hover", 4.5)
  expectContrast(theme, values, "muted-foreground", "muted", 4.5)
  expectContrast(theme, values, "foreground", "action-selected", 4.5)
  expectContrast(theme, values, "action-pressed", "action-hover", 1.1)
  expectContrast(theme, values, "action-selected", "muted", 1.1)
  expectContrast(theme, values, "action-selected", "action-hover", 1.1)

  for (const status of ["destructive", "success", "warning", "info"]) {
    expectContrast(theme, values, status, "card", 3)
    expectContrast(theme, values, `${status}-foreground`, status, 4.5)
  }

  for (const resource of [
    "project",
    "person",
    "service-account",
    "data",
    "dataset",
    "file",
    "instrument",
    "sample",
  ]) {
    expectContrast(theme, values, `resource-${resource}`, "background", 3)
    expectContrast(theme, values, `resource-${resource}`, "card", 3)
  }

  expectContrast(theme, values, "foreground", "accent", 4.5)
  expectContrast(theme, values, "border-strong", "accent", 1.5)
}

const darkValues = declarations("\n.dark {")
for (const [name, value] of shared) {
  if (/^(palette|brand)-/.test(name)) continue
  if (!/^(#|oklch\(|var\(--(palette|brand)-)/.test(value)) continue
  if (!darkValues.has(name)) {
    failures.push(`dark: --${name} has a light color value but no dark value`)
  }
}

const tailwindProvided = /^--(?:spacing|shadow-[\w-]+)$/
const baseUiProvided = /^--(?:collapsible-panel-(?:height|width)|toast-index)$/
const declaredProperties = new Set(
  [...source.matchAll(/(--[\w-]+)\s*:/g)].map((match) => match[1])
)
for (const [, name] of source.matchAll(/var\(\s*(--[\w-]+)/g)) {
  if (
    !declaredProperties.has(name) &&
    !tailwindProvided.test(name) &&
    !baseUiProvided.test(name)
  ) {
    failures.push(`src/styles.css references undefined ${name}`)
  }
}

if (failures.length > 0) {
  throw new Error(`Color contrast violations:\n${failures.join("\n")}`)
}
