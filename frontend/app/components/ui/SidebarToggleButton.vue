<template>
  <button
    ref="rootRef"
    type="button"
    class="subheader-menu-btn"
    :aria-expanded="open"
    :aria-label="open ? 'サイドバーを閉じる' : 'サイドバーを開く'"
    :title="title"
    :disabled="disabled"
    @click="onClick"
  >
    <PanelRightClose
      v-if="open"
      :size="18"
      :stroke-width="2.25"
      aria-hidden="true"
    />
    <PanelRightOpen
      v-else
      :size="18"
      :stroke-width="2.25"
      aria-hidden="true"
    />
  </button>
</template>

<script setup lang="ts">
import { PanelRightClose, PanelRightOpen } from 'lucide-vue-next'

withDefaults(defineProps<{
  open: boolean
  disabled?: boolean
  title?: string
}>(), {
  disabled: false,
  title: 'サイドバー（S）',
})

const emit = defineEmits<{
  toggle: []
  click: [MouseEvent]
}>()

const rootRef = ref<HTMLButtonElement | null>(null)

function onClick (event: MouseEvent) {
  emit('toggle')
  emit('click', event)
}

defineExpose({ el: rootRef })
</script>
