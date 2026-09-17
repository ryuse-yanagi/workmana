<template>
  <p
    v-if="error"
    :class="`${prefix}__err`"
  >{{ error }}</p>
  <div
    v-if="loading && !hasData"
    :class="`${prefix}__loading`"
    aria-busy="true"
    aria-label="読み込み中"
  >
    <div class="spinner" />
  </div>
  <div
    v-else-if="hasData"
    :class="[
      `${prefix}__content`,
      { [`${prefix}__content--fade-in`]: contentShouldFadeIn },
    ]"
  >
    <section
      v-if="isEmpty"
      :class="`${prefix}__empty`"
    >
      <p>{{ emptyMessage }}</p>
    </section>
    <ul
      v-else
      :class="`${prefix}__list`"
    >
      <slot />
    </ul>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  /** BEM block prefix, e.g. archived-list-popover / archived-list-modal */
  prefix: string
  error?: string | null
  loading?: boolean
  /** true when list data has been loaded (including empty) */
  hasData?: boolean
  isEmpty?: boolean
  contentShouldFadeIn?: boolean
  emptyMessage: string
}>(), {
  error: null,
  loading: false,
  hasData: false,
  isEmpty: false,
  contentShouldFadeIn: false,
})
</script>
