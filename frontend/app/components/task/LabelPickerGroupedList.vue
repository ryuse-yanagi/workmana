<template>
  <template v-for="category in categories" :key="category.id">
    <p
      v-if="category.name"
      class="label-section-heading"
    >{{ category.name }}</p>
    <ul class="label-picker-list">
      <li v-for="label in category.labels" :key="label.id">
        <button
          type="button"
          class="label-picker-row"
          :disabled="disabled"
          @click.stop="$emit('toggle', label)"
        >
          <span
            class="label-picker-checkbox"
            :class="{ 'label-picker-checkbox--checked': isSelected(label.id) }"
            aria-hidden="true"
          >
            <span v-if="isSelected(label.id)">✓</span>
          </span>
          <span
            class="label-picker-bar"
            :style="{
              backgroundColor: label.color,
              color: labelBarTextColor(label.color),
            }"
          >
            {{ label.name }}
          </span>
        </button>
      </li>
    </ul>
  </template>
  <p
    v-if="!hasSourceLabels"
    class="empty-text label-picker-empty"
  >
    ラベルは設定画面で追加できます。
  </p>
  <p
    v-else-if="!categories.length"
    class="empty-text label-picker-empty"
  >
    ラベルがありません。
  </p>
</template>
<script setup lang="ts">
import {
  labelBarTextColor,
  type TaskFormLabel,
} from '../../composables/task/useTaskFormHelpers'
import type { LabelCategoryGroup } from '../../composables/label/useLabelCategories'

const props = withDefaults(defineProps<{
  categories: LabelCategoryGroup[]
  selectedIds: number[]
  hasSourceLabels: boolean
  disabled?: boolean
}>(), {
  disabled: false,
})

defineEmits<{
  toggle: [label: TaskFormLabel]
}>()

function isSelected (labelId: number): boolean {
  return props.selectedIds.includes(labelId)
}
</script>
<style lang="scss" scoped src="~/assets/styles/components/task/LabelPickerGroupedList.scss"></style>
