export function intentPreloadProps(preload: () => void) {
  return { onFocus: preload, onMouseEnter: preload, onTouchStart: preload }
}
