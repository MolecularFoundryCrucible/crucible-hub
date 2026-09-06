import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import tailwindcss from "@tailwindcss/vite"
import viteReact from "@vitejs/plugin-react"
import { nitro } from "nitro/vite"
import { defineConfig } from "vite"

export default defineConfig({
  base: "/hub/",
  resolve: { tsconfigPaths: true },
  plugins: [
    tailwindcss(),
    tanstackStart({
      client: { entry: "../tests/build/import-server-only.client.ts" },
      importProtection: {
        behavior: "error",
        include: ["src/**", "tests/build/**"],
      },
    }),
    nitro({ baseURL: "/hub/" }),
    viteReact(),
  ],
})
