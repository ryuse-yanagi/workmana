<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="gantt-color-popover-layer"
    >
      <div
        class="gantt-color-popover-backdrop"
        aria-hidden="true"
        @pointerdown="onBackdropPointerDown"
      />
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
  anchor: { top: number; left: number; right?: number } | null
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
  const pad = 12
  const topPad = 200
  const gap = 6
  const width = 240
  const anchorRight = props.anchor.right ?? props.anchor.left
  const anchorLeft = props.anchor.left
  let left = anchorRight + gap
  let top = Math.max(topPad, Math.round(props.anchor.top))
  if (import.meta.client) {
    if (left + width > window.innerWidth - pad) {
      left = anchorLeft - gap - width
    }
    left = Math.max(pad, Math.min(left, window.innerWidth - width - pad))
    top = Math.max(topPad, Math.min(top, window.innerHeight - pad - 40))
  }
  const maxHeight = import.meta.client
    ? Math.max(120, Math.floor(window.innerHeight - top - pad))
    : 280
  return {
    position: 'fixed',
    top: `${top}px`,
    left: `${Math.round(left)}px`,
    width: `${width}px`,
    maxHeight: `${maxHeight}px`,
    zIndex: '1',
    visibility: 'visible',
  }
})
function onBackdropPointerDown (event: PointerEvent) {
  if (props.saving || event.button !== 0) {
    return
  }
  event.preventDefault()
  event.stopPropagation()
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
  document.addEventListener('keydown', handleEscape, true)
}
function unbindOutsideListeners () {
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
<style lang="scss" scoped src="~/assets/styles/components/workspace/WorkspaceGanttColorPopover.scss"></style>
<style lang="scss" src="~/assets/styles/components/workspace/WorkspaceGanttColorPopover.global.scss"></style>
