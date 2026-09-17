<template>
  <div
    ref="rootRef"
    class="board-filter-dropdown"
    role="dialog"
    :aria-label="ariaLabel"
    :style="style"
    @click.stop
  >
    <header class="board-filter-header">
      <button
        v-if="showClear"
        type="button"
        class="board-filter-clear"
        @click="$emit('clear')"
      >
        クリア
      </button>
      <p class="board-filter-title">{{ title }}</p>
      <button
        type="button"
        class="board-filter-close"
        aria-label="閉じる"
        @click="$emit('close')"
      >
        <X
          :size="16"
          :stroke-width="2.25"
          aria-hidden="true"
        />
      </button>
    </header>
    <div class="board-filter-body">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { X } from 'lucide-vue-next'
import type { CSSProperties } from 'vue'

withDefaults(defineProps<{
  title?: string
  ariaLabel?: string
  style?: string | CSSProperties | Record<string, string>
  showClear?: boolean
}>(), {
  title: 'フィルター',
  ariaLabel: 'フィルター',
  showClear: false,
})

defineEmits<{
  close: []
  clear: []
}>()

const rootRef = ref<HTMLElement | null>(null)
defineExpose({ rootRef })
</script>
