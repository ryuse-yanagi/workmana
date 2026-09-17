<template>
  <button
    ref="rootRef"
    type="button"
    class="subheader-menu-btn"
    :class="{ 'subheader-menu-btn--filter-active': active }"
    :disabled="disabled"
    :aria-label="ariaLabel"
    :title="title"
    @click="onClick"
  >
    <ListFilter
      :size="18"
      :stroke-width="2.25"
      aria-hidden="true"
    />
  </button>
</template>

<script setup lang="ts">
import { ListFilter } from 'lucide-vue-next'

withDefaults(defineProps<{
  active?: boolean
  disabled?: boolean
  ariaLabel?: string
  title?: string
}>(), {
  active: false,
  disabled: false,
  ariaLabel: undefined,
  title: undefined,
})

const emit = defineEmits<{
  click: [MouseEvent]
}>()

const rootRef = ref<HTMLButtonElement | null>(null)

function onClick (event: MouseEvent) {
  event.stopPropagation()
  emit('click', event)
}

defineExpose({ el: rootRef })
</script>
