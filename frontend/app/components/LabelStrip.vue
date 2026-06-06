<template>
  <span
    class="label-strip"
    :class="[`label-strip--${size}`]"
    :style="stripStyle"
  >
    {{ label.name }}
  </span>
</template>

<script setup lang="ts">
export type LabelStripLabel = {
  id?: number
  name: string
  color: string
}

const props = withDefaults(defineProps<{
  label: LabelStripLabel
  size?: 'sm' | 'md'
  textColor?: string | null
}>(), {
  size: 'sm',
  textColor: null,
})

function labelBarTextColor (hex: string): string {
  const normalized = hex.replace('#', '')
  if (normalized.length !== 6) {
    return '#0f172a'
  }
  const r = Number.parseInt(normalized.slice(0, 2), 16)
  const g = Number.parseInt(normalized.slice(2, 4), 16)
  const b = Number.parseInt(normalized.slice(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.62 ? '#0f172a' : '#fff'
}

const stripStyle = computed(() => ({
  backgroundColor: props.label.color,
  color: props.textColor ?? labelBarTextColor(props.label.color),
}))
</script>

<style lang="scss" scoped>
.label-strip {
  display: inline-block;
  border-radius: 4px;
  font-weight: 700;
  line-height: 1.2;
  white-space: nowrap;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}

.label-strip--sm {
  padding: 0.12rem 0.4rem;
  font-size: 0.68rem;
}

.label-strip--md {
  padding: 0.18rem 0.55rem;
  font-size: 0.78rem;
}
</style>
