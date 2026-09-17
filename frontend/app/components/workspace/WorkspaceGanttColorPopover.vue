<template>
  <Teleport to="body">
    <Transition name="popover-fade" @after-leave="onAfterLeave">
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
          :show-clear="canClear"
          @close="emit('close')"
          @clear="emit('clear')"
        >
          <ColorPresetPicker
            :model-value="modelValue"
            :disabled="saving"
            @update:model-value="emit('select', $event)"
          />
        </PopoverShell>
      </div>
    </Transition>
  </Teleport>
</template>
<script setup lang="ts">
import ColorPresetPicker from '../ui/ColorPresetPicker.vue'
import PopoverShell from '../ui/PopoverShell.vue'
import { useExclusivePopover } from '../../composables/useExclusivePopover'
import {
  POPOVER_PANEL_BASE_WIDTH,
  POPOVER_VIEWPORT_INSET,
  clampPopoverBox,
  popoverMaxHeightStyle,
  popoverPositionVisibilityStyle,
  popoverScrollbarLayoutStyle,
  popoverStablePanelWidthStyle,
  resolveAnchoredPopoverLayoutWidth,
  resolvePopoverScrollbarGutter,
  schedulePopoverOpenLayout,
} from '../../utils/popoverScrollbar'
const props = withDefaults(defineProps<{
  open: boolean
  modelValue: string
  anchor: { top: number; left: number; right?: number } | null
  saving?: boolean
  canClear?: boolean
}>(), {
  saving: false,
  canClear: false,
})
const emit = defineEmits<{
  close: []
  clear: []
  select: [string]
  'after-leave': []
}>()
useExclusivePopover(
  () => props.open,
  () => emit('close'),
)
const shellRef = ref<InstanceType<typeof PopoverShell> | null>(null)
const layoutSettled = ref(false)
const layout = ref<{
  top: number
  left: number
  maxHeight: number
  scrollbarGutter: number
  panelWidth: number
} | null>(null)

const positionStyle = computed(() => {
  if (!layout.value) {
    return popoverPositionVisibilityStyle(false)
  }
  const { top, left, maxHeight, scrollbarGutter, panelWidth } = layout.value
  return {
    position: 'fixed',
    top: `${top}px`,
    left: `${Math.round(left)}px`,
    zIndex: '1',
    ...popoverPositionVisibilityStyle(layoutSettled.value),
    ...popoverStablePanelWidthStyle(panelWidth),
    ...popoverMaxHeightStyle(maxHeight, scrollbarGutter),
    ...popoverScrollbarLayoutStyle(scrollbarGutter, true),
  }
})

function positionPopover () {
  if (!props.anchor || !import.meta.client) {
    layout.value = null
    return
  }
  const pad = POPOVER_VIEWPORT_INSET
  const gap = 6
  const anchorRight = props.anchor.right ?? props.anchor.left
  const anchorLeft = props.anchor.left
  let left = anchorRight + gap
  let top = Math.max(pad, Math.round(props.anchor.top))
  top = Math.max(pad, Math.min(top, window.innerHeight - pad - 40))
  const maxHeight = Math.max(120, Math.floor(window.innerHeight - top - pad))
  const shell = shellRef.value?.rootRef ?? null
  const baseWidth = POPOVER_PANEL_BASE_WIDTH.ganttColor
  const extra = shell
    ? resolvePopoverScrollbarGutter(shell, maxHeight, baseWidth)
    : 0
  const panelWidth = resolveAnchoredPopoverLayoutWidth(baseWidth, extra)
  if (left + panelWidth > window.innerWidth - pad) {
    left = anchorLeft - gap - panelWidth
  }
  const panelHeight = shell?.getBoundingClientRect().height || Math.min(maxHeight, 280)
  const clamped = clampPopoverBox(top, left, panelWidth, panelHeight, pad)
  layout.value = {
    top: clamped.top,
    left: clamped.left,
    maxHeight,
    scrollbarGutter: extra,
    panelWidth,
  }
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
function onAfterLeave () {
  layoutSettled.value = false
  layout.value = null
  emit('after-leave')
}
watch(() => props.open, (open) => {
  if (open) {
    layoutSettled.value = false
    layout.value = null
    bindOutsideListeners()
    nextTick(() => {
      schedulePopoverOpenLayout(
        () => positionPopover(),
        () => {
          layoutSettled.value = true
        },
      )
    })
    return
  }
  unbindOutsideListeners()
})
watch(() => props.anchor, () => {
  if (!props.open || !layoutSettled.value) {
    return
  }
  positionPopover()
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
