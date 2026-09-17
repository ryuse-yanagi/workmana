<template>
  <div class="subheader">
    <template v-if="$slots.start">
      <div
        v-if="wrapStart"
        class="subheader-start"
      >
        <slot name="start" />
      </div>
      <slot
        v-else
        name="start"
      />
    </template>
    <div
      v-if="$slots.filters"
      class="subheader-filters"
    >
      <slot name="filters" />
    </div>
    <div
      v-if="$slots.actions"
      class="subheader-actions"
      v-bind="actionsAttrs"
    >
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  /** When true, sets data-subheader-actions-root on the actions container. */
  actionsRootAttr?: boolean
  /** Wrap #start in .subheader-start (disable for list pages where title is a direct grid child). */
  wrapStart?: boolean
}>(), {
  actionsRootAttr: false,
  wrapStart: true,
})

const actionsAttrs = computed(() => (
  props.actionsRootAttr
    ? { 'data-subheader-actions-root': '' as const }
    : {}
))
</script>
