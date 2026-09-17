<template>
  <section class="board-filter-section">
    <button
      type="button"
      class="board-filter-section-toggle"
      :aria-expanded="open"
      @click="open = !open"
    >
      <span class="board-filter-section-title">{{ title }}</span>
      <ChevronDown
        class="board-filter-section-chevron"
        :class="{ 'board-filter-section-chevron--collapsed': !open }"
        :size="16"
        :stroke-width="2.25"
        aria-hidden="true"
      />
    </button>
    <div
      v-show="open"
      class="board-filter-section-body"
    >
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
import { ChevronDown } from 'lucide-vue-next'

defineProps<{
  title: string
}>()

const open = defineModel<boolean>('open', { required: true })
</script>
