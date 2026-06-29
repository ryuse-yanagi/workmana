const loadingDepth = ref(0)
export const isAppLoadingCursorActive = computed(() => loadingDepth.value > 0)
let lastPointerX = 0
let lastPointerY = 0
let pointerTrackingInstalled = false
function ensurePointerTracking () {
  if (!import.meta.client || pointerTrackingInstalled) {
    return
  }
  pointerTrackingInstalled = true
  document.addEventListener('pointermove', (event) => {
    lastPointerX = event.clientX
    lastPointerY = event.clientY
  }, { passive: true })
}
export function getAppLoadingCursorPointer (): { x: number; y: number } {
  return { x: lastPointerX, y: lastPointerY }
}
export function beginAppLoadingCursor () {
  ensurePointerTracking()
  loadingDepth.value += 1
}
export function endAppLoadingCursor () {
  loadingDepth.value = Math.max(0, loadingDepth.value - 1)
}
export async function withAppLoadingCursor<T> (
  fn: () => Promise<T> | T,
): Promise<T> {
  beginAppLoadingCursor()
  try {
    return await fn()
  } finally {
    endAppLoadingCursor()
  }
}
export function syncAppLoadingCursor (source: MaybeRefOrGetter<boolean>) {
  let engaged = false
  watch(
    () => toValue(source),
    (active) => {
      if (active && !engaged) {
        beginAppLoadingCursor()
        engaged = true
        return
      }
      if (!active && engaged) {
        endAppLoadingCursor()
        engaged = false
      }
    },
    { immediate: true },
  )
  onScopeDispose(() => {
    if (engaged) {
      endAppLoadingCursor()
      engaged = false
    }
  })
}
