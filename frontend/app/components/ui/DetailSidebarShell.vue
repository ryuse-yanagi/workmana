<template>
  <aside :class="baseClass">
    <div :class="`${baseClass}__scroller`">
      <div :class="`${baseClass}__body`">
        <div :class="[`${baseClass}__title-field`, titleFieldClass]">
          <slot name="title" />
        </div>
        <div :class="[`${baseClass}__description-field`, descriptionFieldClass]">
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
  /** Extra classes for the title field wrapper (e.g. editing modifier). */
  titleFieldClass?: string | Record<string, boolean> | Array<string | Record<string, boolean>>
  /** Extra classes for the description field wrapper (e.g. editing modifier). */
  descriptionFieldClass?: string | Record<string, boolean> | Array<string | Record<string, boolean>>
}>(), {
  baseClass: 'detail-sidebar',
  titleFieldClass: undefined,
  descriptionFieldClass: undefined,
})
</script>
