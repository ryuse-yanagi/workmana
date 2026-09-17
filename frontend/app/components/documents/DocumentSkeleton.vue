<template>
  <div
    v-if="variant === 'description'"
    class="document-skeleton-description"
    aria-hidden="true"
  >
    <SkeletonBar variant="desc-line" />
    <SkeletonBar variant="desc-line-short" />
  </div>
  <div
    v-else-if="variant === 'body'"
    class="document-viewer__body-skeleton"
    aria-hidden="true"
  >
    <SkeletonBar variant="body-line" />
    <SkeletonBar variant="body-line" />
    <SkeletonBar variant="body-line-mid" />
    <SkeletonBar variant="body-line" />
    <SkeletonBar variant="body-line-short" />
    <SkeletonBar variant="body-line-mid" />
    <SkeletonBar variant="body-line" />
    <SkeletonBar variant="body-line-short" />
  </div>
  <ul
    v-else-if="variant === 'document-list'"
    class="document-list-panel__list"
    aria-hidden="true"
  >
    <li
      v-for="index in count"
      :key="`doc-skeleton-${index}`"
      class="document-list-panel__item"
    >
      <DocumentCard skeleton />
    </li>
  </ul>
</template>

<script setup lang="ts">
import SkeletonBar from '../ui/SkeletonBar.vue'
import DocumentCard from './DocumentCard.vue'

withDefaults(defineProps<{
  variant: 'description' | 'body' | 'document-list'
  count?: number
}>(), {
  count: 3,
})
</script>

<style lang="scss" scoped>
.document-skeleton-description {
  display: flex;
  flex-direction: column;
  gap: 10px;
  box-sizing: border-box;
  width: 100%;
  min-height: 72px;
  padding: 12px 10px;
  border: 1px solid mixin.$border;
  border-radius: mixin.$input-border-radius;
  background: mixin.$bg-gray;
}
.document-viewer__body-skeleton {
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 100%;
  min-height: 220px;
  padding: 8px 2px 24px;
  box-sizing: border-box;
}
.document-list-panel__list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex-shrink: 0;
}
.document-list-panel__item {
  min-width: 0;
}
</style>
