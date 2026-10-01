export function resolvePopoverExposedRoot (
  target: unknown,
): HTMLElement | null {
  if (!target) return null
  if (target instanceof HTMLElement) return target
  if (typeof target !== 'object') return null
  const root = (target as { rootRef?: unknown }).rootRef
  if (root instanceof HTMLElement) return root
  if (root && typeof root === 'object' && 'value' in root) {
    const el = (root as { value: unknown }).value
    return el instanceof HTMLElement ? el : null
  }
  return null
}

export function resolvePopoverExposedInput (
  target: unknown,
): HTMLInputElement | HTMLTextAreaElement | null {
  if (!target || typeof target !== 'object') return null
  const input = (target as { inputRef?: unknown }).inputRef
  if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) {
    return input
  }
  if (input && typeof input === 'object' && 'value' in input) {
    const el = (input as { value: unknown }).value
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      return el
    }
  }
  return null
}
