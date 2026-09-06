import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { createServer } from "node:net"
import { once } from "node:events"

async function availablePort() {
  const server = createServer()
  server.listen(0, "127.0.0.1")
  await once(server, "listening")
  const address = server.address()
  assert(address && typeof address === "object")
  const port = address.port
  server.close()
  await once(server, "close")
  return port
}

async function waitForHealth(url, child) {
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    assert.equal(
      child.exitCode,
      null,
      "Production server exited during startup"
    )
    try {
      const response = await fetch(url)
      if (response.ok) return response
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error("Production health endpoint did not become ready")
}

async function responseText(url, init) {
  const response = await fetch(url, init)
  const body = await response.text()
  return { response, body }
}

const port = await availablePort()
const origin = `http://127.0.0.1:${port}`
const output = []
const child = spawn(process.execPath, [".output/server/index.mjs"], {
  env: {
    ...process.env,
    HOST: "127.0.0.1",
    HUB_ENABLE_FIXTURES: "true",
    NODE_ENV: "production",
    PORT: String(port),
  },
  stdio: ["ignore", "pipe", "pipe"],
})

for (const stream of [child.stdout, child.stderr]) {
  stream.setEncoding("utf8")
  stream.on("data", (chunk) => output.push(chunk))
}

try {
  const health = await waitForHealth(`${origin}/hub/health`, child)
  assert.equal(health.headers.get("cache-control"), "no-store")
  assert.deepEqual(await health.json(), { status: "ok" })

  const root = await responseText(`${origin}/hub/`, {
    headers: {
      "x-forwarded-host": "untrusted.example",
      "x-forwarded-proto": "https",
    },
  })
  assert.equal(root.response.status, 200)
  assert.match(root.body, /<title>Crucible Hub<\/title>/)
  assert.match(root.body, /(?:src|href)="\/hub\/assets\//)
  assert.doesNotMatch(root.body, /untrusted\.example/)

  const assetPath = root.body.match(/(?:src|href)="(\/hub\/assets\/[^"]+)/)?.[1]
  assert(assetPath, "Production document did not reference a prefixed asset")
  assert.equal((await fetch(`${origin}${assetPath}`)).status, 200)

  for (const path of [
    "/hub/data",
    "/hub/projects/01J6Y8N4Q2R7M9K3T5V0W1X2Z3",
    "/hub/datasets/01J6Y8N4Q2R7M9K3T5V0W1X2Z7",
  ]) {
    assert.equal((await fetch(`${origin}${path}`)).status, 200, path)
  }

  for (const [path, location] of [
    ["/", "/hub/"],
    ["/health", "/hub/health"],
  ]) {
    const response = await fetch(`${origin}${path}`, { redirect: "manual" })
    assert.equal(response.status, 302)
    assert.equal(response.headers.get("location"), location)
  }

  child.kill("SIGTERM")
  const [code, signal] = await Promise.race([
    once(child, "exit"),
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error("Production server did not stop")),
        7_000
      )
    ),
  ])
  assert.equal(code, 0)
  assert.equal(signal, null)
} catch (error) {
  child.kill("SIGKILL")
  if (output.length > 0) process.stderr.write(output.join(""))
  throw error
}
