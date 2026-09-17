<template>
  <span
    class="document-skeleton-bar"
    :class="variantClass"
    aria-hidden="true"
  />
</template>

<script setup lang="ts">
export type SkeletonBarVariant =
  | 'subheader-name'
  | 'action-btn'
  | 'icon-btn'
  | 'sidebar-title'
  | 'desc-line'
  | 'desc-line-short'
  | 'field-heading'
  | 'workspace-name'
  | 'category'
  | 'doc-icon'
  | 'doc-name'
  | 'doc-meta'
  | 'viewer-title'
  | 'body-line'
  | 'body-line-mid'
  | 'body-line-short'

const props = defineProps<{
  variant: SkeletonBarVariant
}>()

const variantClass = computed(() => `document-skeleton-bar--${props.variant}`)
</script>

<style lang="scss" scoped src="~/assets/styles/components/ui/SkeletonBar.scss"></style>
