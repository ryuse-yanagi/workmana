<template>
  <span
    class="label-strip"
    :class="[
      `label-strip--${size}`,
      displayMode !== 'inline' ? `label-strip--${displayMode}` : null,
    ]"
    :style="stripStyle"
    :aria-label="displayMode === 'bar' ? label.name : undefined"
    :title="displayMode !== 'inline' ? label.name : undefined"
  >
    <span v-if="displayMode !== 'bar'" class="label-strip__text">{{ label.name }}</span>
  </span>
</template>
<script setup lang="ts">
export type LabelStripLabel = {
  id?: number
  name: string
  color: string
}
export type LabelStripDisplayMode = 'inline' | 'bar' | 'named'
const props = withDefaults(defineProps<{
  label: LabelStripLabel
  size?: 'sm' | 'md'
  textColor?: string | null
  displayMode?: LabelStripDisplayMode
}>(), {
  size: 'sm',
  textColor: null,
  displayMode: 'inline',
})
function labelBarTextColor (hex: string): string {
  const normalized = hex.replace('#', '')
  // mixin.$text / $white
  if (normalized.length !== 6) {
    return '#000'
  }
  const r = Number.parseInt(normalized.slice(0, 2), 16)
  const g = Number.parseInt(normalized.slice(2, 4), 16)
  const b = Number.parseInt(normalized.slice(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.62 ? '#000' : '#fff'
}
const stripStyle = computed(() => ({
  backgroundColor: props.label.color,
  color: props.textColor ?? labelBarTextColor(props.label.color),
}))
</script>
<style lang="scss" scoped src="~/assets/styles/components/ui/LabelStrip.scss"></style>
