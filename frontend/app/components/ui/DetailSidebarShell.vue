<template>
  <aside :class="baseClass">
    <div :class="`${baseClass}__scroller`">
      <div :class="`${baseClass}__body`">
        <div :class="`${baseClass}__title-field`">
          <slot name="title" />
        </div>
        <div :class="`${baseClass}__description-field`">
          <slot name="description" />
        </div>
        <slot name="fields" />
        <slot name="documents" />
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  /** BEM root class for existing sidebar SCSS (`workspace-sidebar` / `document-sidebar`). */
  baseClass?: string
}>(), {
  baseClass: 'detail-sidebar',
})
</script>
