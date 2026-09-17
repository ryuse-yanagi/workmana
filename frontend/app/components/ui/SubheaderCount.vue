<template>
  <p
    class="subheader-count"
    aria-live="polite"
  >
    <span class="subheader-count__num">{{ displayCount }}</span>
    <span class="subheader-count__unit">{{ unit }}</span>
  </p>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  count: number | string | ''
  unit?: string
  /** When false, the numeric slot is shown empty (loading / not ready). */
  ready?: boolean
}>(), {
  unit: '件',
  ready: true,
})

const displayCount = computed(() => (
  props.ready ? props.count : ''
))
</script>
