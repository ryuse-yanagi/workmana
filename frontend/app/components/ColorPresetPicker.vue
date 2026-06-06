<template>
  <div class="color-preset-picker">
    <span class="color-preset-picker__label">カラー</span>
    <div class="color-preset-picker__list">
      <button
        v-for="colorItem in colorPresets"
        :key="colorItem"
        type="button"
        class="color-preset-picker__btn"
        :class="{ 'color-preset-picker__btn--active': colorItem === modelValue }"
        :style="{ backgroundColor: colorItem }"
        :disabled="disabled"
        :aria-label="`色 ${colorItem}`"
        @click="emit('update:modelValue', colorItem)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
const colorPresets: string[] = [
  '#c084fc',
  '#6366f1',
  '#3b82f6',
  '#06b6d4',
  '#34d399',
  '#84cc16',
  '#eab308',
  '#f97316',
  '#ef4444',
  '#ec4899',
]

withDefaults(defineProps<{
  modelValue: string
  disabled?: boolean
}>(), {
  disabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [string]
}>()
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
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.color-preset-picker__btn {
  width: 1.25rem;
  height: 1.25rem;
  border-radius: 999px;
  border: 1px solid rgba(15, 23, 42, 0.15);
  cursor: pointer;
  padding: 0;
}

.color-preset-picker__btn--active {
  box-shadow: 0 0 0 2px #fff, 0 0 0 4px #334155;
}

.color-preset-picker__btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
</style>
