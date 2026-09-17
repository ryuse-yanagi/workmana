<template>
  <div
    v-if="wrap"
    class="card-menu-wrap"
    :class="[{ 'card-menu-wrap--open': open }, wrapClass]"
    @click.stop
    @pointerdown.stop
    @mousedown.stop
  >
    <button
      ref="triggerRef"
      type="button"
      :class="triggerClass"
      data-popover-trigger
      :aria-expanded="open"
      :aria-label="ariaLabel"
      :aria-haspopup="ariaHaspopup"
      :disabled="disabled"
      :title="title"
      @click="onClick"
      @pointerdown="onPointerDown"
      @pointerup="onPointerUp"
    >
      <Ellipsis :size="iconSize" :stroke-width="2.25" aria-hidden="true" />
    </button>
  </div>
  <button
    v-else
    ref="triggerRef"
    type="button"
    :class="triggerClass"
    data-popover-trigger
    :aria-expanded="open"
    :aria-label="ariaLabel"
    :aria-haspopup="ariaHaspopup"
    :disabled="disabled"
    :title="title"
    @click="onClick"
    @pointerdown="onPointerDown"
    @pointerup="onPointerUp"
  >
    <Ellipsis :size="iconSize" :stroke-width="2.25" aria-hidden="true" />
  </button>
</template>

<script setup lang="ts">
import { Ellipsis } from 'lucide-vue-next'

const props = withDefaults(defineProps<{
  open?: boolean
  ariaLabel: string
  ariaHaspopup?: string | boolean
  disabled?: boolean
  title?: string
  /** When true, wraps the button in `.card-menu-wrap` with stopPropagation guards. */
  wrap?: boolean
  wrapClass?: string
  triggerClass?: string
  iconSize?: number
  /** Stop click propagation on the trigger (useful when wrap is false). */
  stopClick?: boolean
  stopPointer?: boolean
}>(), {
  open: false,
  ariaHaspopup: undefined,
  disabled: false,
  title: undefined,
  wrap: true,
  wrapClass: undefined,
  triggerClass: 'card-menu-trigger',
  iconSize: 20,
  stopClick: false,
  stopPointer: false,
})

const emit = defineEmits<{
  click: [MouseEvent]
}>()

const triggerRef = ref<HTMLButtonElement | null>(null)

function onClick (event: MouseEvent) {
  if (props.stopClick) {
    event.stopPropagation()
  }
  emit('click', event)
}

function onPointerDown (event: PointerEvent) {
  if (props.stopPointer) {
    event.stopPropagation()
  }
}

function onPointerUp (event: PointerEvent) {
  if (props.stopPointer) {
    event.stopPropagation()
  }
}

defineExpose({
  el: triggerRef,
  triggerRef,
})
</script>
