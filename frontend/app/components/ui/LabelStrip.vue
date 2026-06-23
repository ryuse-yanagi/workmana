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

.label-strip__text {
  display: block;
  width: 100%;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: center;
}

.label-strip--bar {
  display: block;
  flex-shrink: 0;
  width: 40px;
  height: 8px;
  padding: 0;
  border-radius: 3px;
  line-height: 0;
  overflow: hidden;
  color: transparent;
  font-size: 0;
}

.label-strip--named.label-strip--sm {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-sizing: border-box;
  width: 56px;
  height: 16px;
  min-width: 56px;
  max-width: 56px;
  min-height: 16px;
  max-height: 16px;
  padding: 0 4px;
  border-radius: 4px;
  font-size: 12px;
  line-height: 1;
  overflow: hidden;
}

.label-strip--named.label-strip--md {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-sizing: border-box;
  width: 56px;
  height: 16px;
  min-width: 56px;
  max-width: 56px;
  min-height: 16px;
  max-height: 16px;
  padding: 0 4px;
  border-radius: 4px;
  font-size: 12px;
  line-height: 1;
  overflow: hidden;
}
</style>
