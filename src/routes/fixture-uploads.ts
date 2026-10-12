import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/fixture-uploads")({
  server: {
    handlers: {
      PUT: async () => {
        if (
          process.env.NODE_ENV === "production" ||
          process.env.HUB_DATA_SOURCE !== "fixture"
        ) {
          return new Response(null, { status: 404 })
        }
        return new Response(null, {
          headers: { "Cache-Control": "no-store" },
          status: 200,
        })
      },
    },
  },
})
