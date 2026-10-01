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
          @close="emit('close')"
        >
          <div class="popover-scroll">
            <ColorPresetPicker
              :model-value="modelValue"
              :show-label="false"
              @update:model-value="emit('select', $event)"
            />
          </div>
        </PopoverShell>
      </div>
    </Transition>
  </Teleport>
</template>
<script setup lang="ts">
import ColorPresetPicker from '../ui/ColorPresetPicker.vue'
import PopoverShell from '../ui/PopoverShell.vue'
import { useExclusivePopover } from '../../composables/ui/useExclusivePopover'
import {
  POPOVER_PANEL_BASE_WIDTH,
  type AnchoredPopoverLayout,
  buildAnchoredPopoverStyle,
  computeAnchoredPopoverBesideLayout,
  popoverPositionVisibilityStyle,
  schedulePopoverOpenLayout,
} from '../../utils/ui/popoverScrollbar'
const props = defineProps<{
  open: boolean
  modelValue: string
  anchor: { top: number; left: number; right?: number } | null
}>()
const emit = defineEmits<{
  close: []
  select: [string]
  'after-leave': []
}>()
useExclusivePopover(
  () => props.open,
  () => emit('close'),
)
const shellRef = ref<InstanceType<typeof PopoverShell> | null>(null)
const layoutSettled = ref(false)
const layout = ref<AnchoredPopoverLayout | null>(null)

const positionStyle = computed(() => {
  if (!layout.value) {
    return popoverPositionVisibilityStyle(false)
  }
  return buildAnchoredPopoverStyle(layout.value, {
    zIndex: 1,
    visible: layoutSettled.value,
  })
})

function positionPopover () {
  if (!props.anchor || !import.meta.client) {
    layout.value = null
    return
  }
  const shell = shellRef.value?.rootRef ?? null
  if (!shell) {
    return
  }
  const left = props.anchor.left
  const right = props.anchor.right ?? left
  const top = props.anchor.top
  layout.value = computeAnchoredPopoverBesideLayout(
    new DOMRect(left, top, Math.max(0, right - left), 0),
    POPOVER_PANEL_BASE_WIDTH.ganttColor,
    shell,
  )
}

function handleEscape (event: KeyboardEvent) {
  if (!props.open || event.key !== 'Escape') {
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
  if (!props.open) {
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
