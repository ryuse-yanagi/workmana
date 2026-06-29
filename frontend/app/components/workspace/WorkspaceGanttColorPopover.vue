<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="gantt-color-popover-layer"
    >
      <PopoverShell
        ref="shellRef"
        title="バーの色"
        shell-class="popover popover--gantt-color"
        :style="positionStyle"
        :close-disabled="saving"
        @close="emit('close')"
      >
        <ColorPresetPicker
          :model-value="modelValue"
          :disabled="saving"
          @update:model-value="emit('select', $event)"
        />
      </PopoverShell>
    </div>
  </Teleport>
</template>
<script setup lang="ts">
import ColorPresetPicker from '../ui/ColorPresetPicker.vue'
import PopoverShell from '../ui/PopoverShell.vue'
const props = defineProps<{
  open: boolean
  modelValue: string
  anchor: { top: number; left: number } | null
  saving?: boolean
}>()
const emit = defineEmits<{
  close: []
  select: [string]
}>()
const shellRef = ref<InstanceType<typeof PopoverShell> | null>(null)
const positionStyle = computed(() => {
  if (!props.anchor) {
    return {
      visibility: 'hidden',
    } as Record<string, string>
  }
  const pad = 8
  const width = 240
  let left = props.anchor.left
  let top = props.anchor.top + 8
  if (import.meta.client) {
    left = Math.max(pad, Math.min(left, window.innerWidth - width - pad))
    top = Math.max(pad, Math.min(top, window.innerHeight - 280))
  }
  return {
    position: 'fixed',
    top: `${top}px`,
    left: `${left}px`,
    width: `${width}px`,
    zIndex: '120',
    visibility: 'visible',
  }
})
function resolvePopoverElement (): HTMLElement | null {
  return shellRef.value?.rootRef ?? null
}
function shouldIgnoreOutsideClose (target: Node): boolean {
  if (!(target instanceof Element)) {
    return false
  }
  return Boolean(target.closest('.workspace-gantt-table__day-cell--clickable'))
}
function handleOutsidePointerDown (event: MouseEvent) {
  if (!props.open || props.saving || event.button !== 0) {
    return
  }
  const target = event.target
  if (!(target instanceof Node)) {
    return
  }
  const popoverEl = resolvePopoverElement()
  if (popoverEl?.contains(target)) {
    return
  }
  if (shouldIgnoreOutsideClose(target)) {
    return
  }
  emit('close')
}
function handleEscape (event: KeyboardEvent) {
  if (!props.open || props.saving || event.key !== 'Escape') {
    return
  }
  event.preventDefault()
  event.stopPropagation()
  emit('close')
}
function bindOutsideListeners () {
  document.addEventListener('mousedown', handleOutsidePointerDown, true)
  document.addEventListener('keydown', handleEscape, true)
}
function unbindOutsideListeners () {
  document.removeEventListener('mousedown', handleOutsidePointerDown, true)
  document.removeEventListener('keydown', handleEscape, true)
}
watch(() => props.open, (open) => {
  if (open) {
    bindOutsideListeners()
    return
  }
  unbindOutsideListeners()
})
onBeforeUnmount(() => {
  unbindOutsideListeners()
})
defineExpose({
  shellRef,
})
</script>
<style lang="scss" scoped>
.gantt-color-popover-layer {
  position: fixed;
  inset: 0;
  z-index: 119;
  pointer-events: none;
}
.gantt-color-popover-layer :deep(.popover-shell) {
  pointer-events: auto;
}
</style>
<style lang="scss">
.popover.popover--gantt-color {
  padding: 0.75rem 0.85rem 0.9rem;
}
</style>
