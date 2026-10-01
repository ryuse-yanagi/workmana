<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="app-loading-overlay"
      aria-hidden="true"
    >
      <div class="app-loading-overlay__blocker" />
      <div
        class="app-loading-cursor"
        :style="cursorStyle"
      >
        <svg
          class="app-loading-cursor__ring"
          viewBox="0 0 24 24"
          width="20"
          height="20"
        >
          <circle
            cx="12"
            cy="12"
            r="9"
            fill="none"
            stroke="currentColor"
            stroke-width="2.25"
            stroke-linecap="round"
            stroke-dasharray="18 40"
          />
        </svg>
      </div>
    </div>
  </Teleport>
</template>
<script setup lang="ts">
import {
  getAppLoadingCursorPointer,
  isAppLoadingCursorActive,
} from '../../composables/ui/useAppLoadingCursor'
const BODY_CLASS = 'app-loading-cursor-active'
const visible = ref(false)
const pointerX = ref(0)
const pointerY = ref(0)
const cursorStyle = computed(() => ({
  transform: `translate(${pointerX.value}px, ${pointerY.value}px)`,
}))
function syncPointer (event?: PointerEvent) {
  if (event) {
    pointerX.value = event.clientX
    pointerY.value = event.clientY
    return
  }
  const { x, y } = getAppLoadingCursorPointer()
  pointerX.value = x
  pointerY.value = y
}
function onPointerMove (event: PointerEvent) {
  syncPointer(event)
}
function activate () {
  if (!import.meta.client) {
    return
  }
  syncPointer()
  visible.value = true
  document.body.classList.add(BODY_CLASS)
  document.addEventListener('pointermove', onPointerMove, { capture: true, passive: true })
}
function deactivate () {
  if (!import.meta.client) {
    return
  }
  visible.value = false
  document.body.classList.remove(BODY_CLASS)
  document.removeEventListener('pointermove', onPointerMove, { capture: true })
}
watch(
  isAppLoadingCursorActive,
  (active) => {
    if (active) {
      activate()
      return
    }
    deactivate()
  },
  { immediate: true },
)
onBeforeUnmount(() => {
  deactivate()
})
</script>
<style lang="scss" src="~/assets/styles/components/app/AppLoadingCursor.scss"></style>
