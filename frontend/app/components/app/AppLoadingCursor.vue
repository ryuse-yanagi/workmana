<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="app-loading-cursor"
      :style="cursorStyle"
      aria-hidden="true"
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
  </Teleport>
</template>

<script setup lang="ts">
import {
  getAppLoadingCursorPointer,
  isAppLoadingCursorActive,
} from '../../composables/useAppLoadingCursor'

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

<style lang="scss">
body.app-loading-cursor-active,
body.app-loading-cursor-active * {
  cursor: none !important;
}

.app-loading-cursor {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 2147483647;
  width: 20px;
  height: 20px;
  margin: -1px 0 0 -1px;
  pointer-events: none;
  color: mixin.$main-aqua;
}

.app-loading-cursor__ring {
  display: block;
  animation: app-loading-cursor-spin 0.75s linear infinite;
}

@keyframes app-loading-cursor-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
