import type * as ResourceGraphCanvasModule from "./resource-graph-canvas"

let loadedModule: typeof ResourceGraphCanvasModule | undefined
let warmed = false

export function loadResourceGraphCanvas() {
  return import("./resource-graph-canvas").then((module) => {
    loadedModule = module
    return module
  })
}

export function loadedResourceGraphCanvas() {
  return loadedModule
}

function warmResourceGraph() {
  if (warmed) return
  warmed = true
  loadResourceGraphCanvas()
    .then((module) => module.warmResourceGraphLayoutEngine())
    .catch(() => {
      warmed = false
    })
}

export const resourceGraphWarmupProps = {
  onFocus: warmResourceGraph,
  onMouseEnter: warmResourceGraph,
  onTouchStart: warmResourceGraph,
}
