<template>
  <div class="color-preset-picker">
    <span class="color-preset-picker__label">カラー</span>
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
          borderColor: labelSwatchBorderColor(colorItem),
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
          :color="labelSwatchCheckColor(colorItem)"
          aria-hidden="true"
        />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Check } from 'lucide-vue-next'
import {
  LABEL_COLOR_GRID_COLUMNS,
  LABEL_COLOR_PRESETS,
  labelSwatchBorderColor,
  labelSwatchCheckColor,
} from '../../constants/labelColorPresets'

const props = withDefaults(defineProps<{
  modelValue: string
  disabled?: boolean
  presets?: readonly string[]
  gridColumns?: number
}>(), {
  disabled: false,
})

const colorPresets = computed(() => props.presets ?? LABEL_COLOR_PRESETS)
const gridColumns = computed(() => props.gridColumns ?? LABEL_COLOR_GRID_COLUMNS)

const emit = defineEmits<{
  'update:modelValue': [string]
}>()

function selectColor (colorItem: string) {
  if (props.disabled) return
  emit('update:modelValue', colorItem)
}
</script>

<style lang="scss" scoped>
.color-preset-picker {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  color: #1e293b;
  font-weight: 700;
}

.color-preset-picker__list {
  display: grid;
  gap: 0.35rem;
}

.color-preset-picker__btn {
  @include mixin.picker-checkbox-row;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  aspect-ratio: 1.55;
  min-height: 1.65rem;
  border-radius: 6px;
  border: 1px solid transparent;
  padding: 0;
}

.color-preset-picker__btn--active {
  box-shadow: none;
}

.color-preset-picker__check {
  flex-shrink: 0;
}
</style>
