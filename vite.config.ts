import { defineConfig } from "vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { nitro } from "nitro/vite"

const config = defineConfig({
  base: "/hub/",
  resolve: { tsconfigPaths: true },
  server: {
    allowedHosts: ["leviathan.rooster-chimaera.ts.net"],
    host: "127.0.0.1",
    port: 3000,
    strictPort: true,
  },
  plugins: [
    tailwindcss(),
    tanstackStart({ start: { entry: "start.ts" } }),
    nitro({ baseURL: "/hub/" }),
    viteReact(),
  ],
})

export default config
