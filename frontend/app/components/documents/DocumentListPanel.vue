<template>
  <section class="document-list-panel">
    <div class="document-list-panel__panel">
      <div class="document-list-panel__toolbar">
        <h2 class="document-list-panel__heading">{{ heading }}</h2>
        <slot name="toolbar-actions" />
      </div>
      <ul
        v-if="hasItems"
        class="document-list-panel__list"
      >
        <slot />
      </ul>
      <slot
        v-else-if="loading"
        name="loading"
      />
      <div
        v-else
        class="document-list-panel__empty"
      >
        <span
          class="document-list-panel__empty-icon"
          aria-hidden="true"
        >
          <NotebookText
            :size="32"
            :stroke-width="1.75"
          />
        </span>
        <EmptyState
          :message="emptyMessage"
          class-name="document-list-panel__empty-text"
        />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { NotebookText } from 'lucide-vue-next'
import EmptyState from '../ui/EmptyState.vue'

withDefaults(defineProps<{
  heading?: string
  emptyMessage?: string
  hasItems?: boolean
  loading?: boolean
}>(), {
  heading: '資料',
  emptyMessage: '資料はありません',
  hasItems: false,
  loading: false,
})
</script>

<style lang="scss" scoped src="~/assets/styles/components/documents/DocumentListPanel.scss"></style>
