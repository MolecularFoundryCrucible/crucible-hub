import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

function readFile(path) {
  return readFileSync(path, "utf8").replace(/\r?\n$/, "")
}

// The same rule as the Hub server and the Crucible API: exactly one of
// NAME_FILE, /run/secrets/NAME, or NAME; blank counts as not given.
export function readSecretSetting(name, secretsDirectory = "/run/secrets") {
  const ways = new Map()
  const variable = process.env[name]
  if (variable?.trim()) ways.set(name, variable)
  const pointer = process.env[`${name}_FILE`]?.trim()
  if (pointer) {
    const value = readFile(pointer)
    if (!value.trim()) throw new Error(`${name}_FILE names an empty file.`)
    ways.set(`${name}_FILE`, value)
  }
  const mounted = join(secretsDirectory, name)
  if (existsSync(mounted)) {
    const value = readFile(mounted)
    if (value.trim()) ways.set(mounted, value)
  }
  if (ways.size > 1) {
    throw new Error(
      `${name} is given more than one way (${[...ways.keys()].join(", ")}); give it one way only.`
    )
  }
  return ways.values().next().value
}
