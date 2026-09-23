export function isEditableKeyboardTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target.matches("input, select, textarea, [role='textbox']"))
  )
}

export function isDialogKeyboardTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest('[role="dialog"]'))
}
