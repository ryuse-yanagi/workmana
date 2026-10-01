<template>
  <div class="color-preset-picker">
    <span
      v-if="showLabel"
      class="color-preset-picker__label"
    >カラー</span>
    <div
      class="color-preset-picker__list"
      :style="{ gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))` }"
    >
      <button
        v-for="colorItem in colorPresets"
        :key="colorItem"
        type="button"
        class="color-preset-picker__btn"
        :class="{ 'color-preset-picker__btn--active': colorItem === modelValue }"
        :style="{
          backgroundColor: colorItem,
          borderColor: colorSwatchBorderColor(colorItem),
        }"
        :aria-label="`色 ${colorItem}`"
        :aria-pressed="colorItem === modelValue"
        @click="selectColor(colorItem)"
      >
        <Check
          v-if="colorItem === modelValue"
          class="color-preset-picker__check"
          :size="20"
          :stroke-width="3.5"
          :color="colorSwatchCheckColor(colorItem)"
          aria-hidden="true"
        />
      </button>
    </div>
  </div>
</template>
<script setup lang="ts">
import { Check } from 'lucide-vue-next'
import {
  COLOR_PRESET_GRID_COLUMNS,
  COLOR_PRESETS,
  colorSwatchBorderColor,
  colorSwatchCheckColor,
} from '../../constants/colorPresets'
const props = withDefaults(defineProps<{
  modelValue: string
  disabled?: boolean
  presets?: readonly string[]
  gridColumns?: number
  showLabel?: boolean
}>(), {
  disabled: false,
  showLabel: true,
})
const colorPresets = computed(() => props.presets ?? COLOR_PRESETS)
const gridColumns = computed(() => props.gridColumns ?? COLOR_PRESET_GRID_COLUMNS)
const emit = defineEmits<{
  'update:modelValue': [string]
}>()
function selectColor (colorItem: string) {
  if (props.disabled) return
  emit('update:modelValue', colorItem)
}
</script>
<style lang="scss" scoped src="~/assets/styles/components/ui/ColorPresetPicker.scss"></style>
