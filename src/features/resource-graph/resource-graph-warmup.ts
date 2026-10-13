import { lazyRouteComponent } from "@tanstack/react-router"

import { intentPreloadProps } from "@/lib/intent-preload"

const loadResourceGraphCanvas = () => import("./resource-graph-canvas")

export const ResourceGraphCanvas = lazyRouteComponent(
  loadResourceGraphCanvas,
  "ResourceGraphCanvas"
)

let warmed = false

function warmResourceGraph() {
  if (warmed) return
  warmed = true
  void ResourceGraphCanvas.preload?.()
  loadResourceGraphCanvas()
    .then((module) => module.warmResourceGraphLayoutEngine())
    .catch(() => {
      warmed = false
    })
}

export const resourceGraphWarmupProps = intentPreloadProps(warmResourceGraph)
