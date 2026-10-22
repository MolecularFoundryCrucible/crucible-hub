/** The nearest ancestor that scrolls vertically, or the window. */
export function scrollContainer(element: Element): Element | Window {
  for (
    let parent = element.parentElement;
    parent;
    parent = parent.parentElement
  ) {
    const { overflowY } = getComputedStyle(parent)
    if (overflowY === "auto" || overflowY === "scroll") return parent
  }
  return window
}
