import { useEffect } from "react"
import type { RefObject } from "react"
import type { ReactFlowInstance } from "@xyflow/react"

import type {
  ResourceFlowEdge,
  ResourceFlowNode,
} from "./resource-graph-flow-model"
import { graphViewportOptions } from "./resource-graph-layout"
import type { LayoutPosition } from "./resource-graph-layout"

/**
 * Touch gestures on the graph surface: two-finger pan and pinch, and
 * double-tap-and-drag to zoom, with a hint when one finger tries to pan.
 */
export function useGraphTouchGestures({
  displayedPositions,
  flow,
  lastTouchTime,
  onTouchHintChange,
  surface,
  zoomRange,
}: {
  displayedPositions: RefObject<ReadonlyMap<string, LayoutPosition>>
  flow: ReactFlowInstance<ResourceFlowNode, ResourceFlowEdge>
  lastTouchTime: RefObject<number>
  onTouchHintChange: (visible: boolean) => void
  surface: RefObject<HTMLDivElement | null>
  zoomRange: { max: number; min: number }
}) {
  useEffect(() => {
    const element = surface.current
    if (!element) return
    let hintTimer: ReturnType<typeof setTimeout> | undefined
    let singleTouch: {
      moved: boolean
      startTime: number
      startX: number
      startY: number
    } | null = null
    let lastTap: {
      clientX: number
      clientY: number
      time: number
    } | null = null
    let doubleTapZoom: {
      centerX: number
      centerY: number
      moved: boolean
      nodeMfid: string | null
      startViewportX: number
      startViewportY: number
      startY: number
      startZoom: number
    } | null = null

    const clearHintTimer = () => {
      if (hintTimer !== undefined) {
        clearTimeout(hintTimer)
        hintTimer = undefined
      }
    }

    const showTouchHint = () => {
      clearHintTimer()
      onTouchHintChange(true)
      hintTimer = setTimeout(() => {
        onTouchHintChange(false)
        hintTimer = undefined
      }, 1800)
    }

    const isInteractiveControl = (target: EventTarget | null) =>
      target instanceof HTMLElement &&
      Boolean(
        target.closest(
          ".resource-graph-controls, .resource-graph-expansion-action"
        )
      )

    const handleTouchStart = (event: TouchEvent) => {
      lastTouchTime.current = performance.now()
      if (isInteractiveControl(event.target)) return
      const isFullscreen = document.fullscreenElement === element
      if (event.touches.length >= 2) {
        singleTouch = null
        doubleTapZoom = null
        element.dataset.touchGestureActive = ""
        clearHintTimer()
        onTouchHintChange(false)
        return
      }
      if (event.touches.length !== 1) return
      const touch = event.touches[0]
      const now = lastTouchTime.current
      if (
        lastTap &&
        now - lastTap.time <= 320 &&
        Math.hypot(
          touch.clientX - lastTap.clientX,
          touch.clientY - lastTap.clientY
        ) <= 28
      ) {
        const viewport = flow.getViewport()
        const rect = element.getBoundingClientRect()
        const tappedNode =
          event.target instanceof HTMLElement
            ? event.target.closest<HTMLElement>(".react-flow__node-resource")
            : null
        doubleTapZoom = {
          centerX: touch.clientX - rect.left,
          centerY: touch.clientY - rect.top,
          moved: false,
          nodeMfid: tappedNode?.dataset.id ?? null,
          startViewportX: viewport.x,
          startViewportY: viewport.y,
          startY: touch.clientY,
          startZoom: viewport.zoom,
        }
        singleTouch = null
        lastTap = null
        element.dataset.touchGestureActive = ""
        clearHintTimer()
        onTouchHintChange(false)
        event.stopPropagation()
        return
      }
      doubleTapZoom = null
      singleTouch = {
        moved: false,
        startTime: now,
        startX: touch.clientX,
        startY: touch.clientY,
      }
      if (!isFullscreen) {
        delete element.dataset.touchGestureActive
        event.stopPropagation()
      }
    }

    const handleTouchMove = (event: TouchEvent) => {
      if (isInteractiveControl(event.target)) return
      const isFullscreen = document.fullscreenElement === element
      if (event.touches.length >= 2) {
        doubleTapZoom = null
        singleTouch = null
        element.dataset.touchGestureActive = ""
        clearHintTimer()
        onTouchHintChange(false)
        return
      }
      if (event.touches.length !== 1) return
      const touch = event.touches[0]
      if (doubleTapZoom) {
        const deltaY = touch.clientY - doubleTapZoom.startY
        if (Math.abs(deltaY) > 4 || doubleTapZoom.moved) {
          doubleTapZoom.moved = true
          event.preventDefault()
          event.stopPropagation()
          const nextZoom = Math.min(
            zoomRange.max,
            Math.max(
              zoomRange.min,
              doubleTapZoom.startZoom * Math.pow(2, deltaY / 140)
            )
          )
          const graphX =
            (doubleTapZoom.centerX - doubleTapZoom.startViewportX) /
            doubleTapZoom.startZoom
          const graphY =
            (doubleTapZoom.centerY - doubleTapZoom.startViewportY) /
            doubleTapZoom.startZoom
          void flow.setViewport(
            {
              x: doubleTapZoom.centerX - graphX * nextZoom,
              y: doubleTapZoom.centerY - graphY * nextZoom,
              zoom: nextZoom,
            },
            { duration: 0 }
          )
        }
        return
      }
      if (singleTouch) {
        const distance = Math.hypot(
          touch.clientX - singleTouch.startX,
          touch.clientY - singleTouch.startY
        )
        if (distance > 12 && !singleTouch.moved) {
          singleTouch.moved = true
          if (!isFullscreen) {
            showTouchHint()
          }
        }
      }
      if (!isFullscreen) {
        event.stopPropagation()
      }
    }

    const handleTouchEnd = (event: TouchEvent) => {
      lastTouchTime.current = performance.now()
      if (event.touches.length > 0) {
        if (
          document.fullscreenElement !== element &&
          event.touches.length === 1 &&
          !doubleTapZoom
        ) {
          delete element.dataset.touchGestureActive
        }
        return
      }
      delete element.dataset.touchGestureActive
      const now = lastTouchTime.current
      if (doubleTapZoom) {
        if (!doubleTapZoom.moved && doubleTapZoom.nodeMfid) {
          const position = displayedPositions.current.get(
            doubleTapZoom.nodeMfid
          )
          if (position) {
            void flow.setCenter(
              position.x + position.width / 2,
              position.y + position.height / 2,
              {
                ...graphViewportOptions(element),
                zoom: flow.getZoom(),
              }
            )
          }
        }
        doubleTapZoom = null
        return
      }
      if (
        singleTouch &&
        !singleTouch.moved &&
        now - singleTouch.startTime <= 300
      ) {
        lastTap = {
          clientX: singleTouch.startX,
          clientY: singleTouch.startY,
          time: now,
        }
      } else {
        lastTap = null
      }
      singleTouch = null
    }

    element.addEventListener("touchstart", handleTouchStart, {
      capture: true,
      passive: true,
    })
    element.addEventListener("touchmove", handleTouchMove, {
      capture: true,
      passive: false,
    })
    element.addEventListener("touchend", handleTouchEnd, {
      capture: true,
      passive: true,
    })
    element.addEventListener("touchcancel", handleTouchEnd, {
      capture: true,
      passive: true,
    })
    return () => {
      clearHintTimer()
      delete element.dataset.touchGestureActive
      element.removeEventListener("touchstart", handleTouchStart, true)
      element.removeEventListener("touchmove", handleTouchMove, true)
      element.removeEventListener("touchend", handleTouchEnd, true)
      element.removeEventListener("touchcancel", handleTouchEnd, true)
    }
  }, [
    displayedPositions,
    flow,
    lastTouchTime,
    onTouchHintChange,
    surface,
    zoomRange.max,
    zoomRange.min,
  ])
}
