<template>
  <div class="label-row">
    <button
      type="button"
      class="label-row__drag-handle"
      :class="{ 'settings-drag-handle--readonly': !canManage }"
      :aria-hidden="!canManage"
      :tabindex="canManage ? 0 : -1"
      :aria-label="canManage ? dragAriaLabel : undefined"
      @click.prevent
    >
      <Equal :size="24" :stroke-width="2.25" aria-hidden="true" />
    </button>
    <span
      v-if="color"
      class="label-row__dot"
      :style="{ backgroundColor: color }"
      aria-hidden="true"
    />
    <span class="label-row__name">{{ name }}</span>
    <div
      v-if="canManage"
      class="label-row__actions"
    >
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { Equal } from 'lucide-vue-next'

withDefaults(defineProps<{
  name: string
  color?: string | null
  canManage?: boolean
  dragAriaLabel?: string
}>(), {
  color: null,
  canManage: true,
  dragAriaLabel: 'ドラッグして並び順を変更',
})
</script>

<style lang="scss" scoped src="~/assets/styles/components/settings/SettingsDraggableNamedRow.scss"></style>
