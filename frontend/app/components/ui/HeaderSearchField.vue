<template>
  <div class="header-search-field">
    <Search
      class="header-search-icon"
      :size="16"
      :stroke-width="2.25"
      aria-hidden="true"
    />
    <input
      class="header-search"
      type="search"
      :value="modelValue"
      :placeholder="placeholder"
      :aria-label="ariaLabel"
      :disabled="disabled"
      @input="onInput"
    >
  </div>
</template>

<script setup lang="ts">
import { Search } from 'lucide-vue-next'

withDefaults(defineProps<{
  modelValue: string
  placeholder?: string
  disabled?: boolean
  ariaLabel?: string
}>(), {
  placeholder: '',
  disabled: false,
  ariaLabel: undefined,
})

const emit = defineEmits<{
  'update:modelValue': [string]
}>()

function onInput (event: Event) {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', target.value)
}
</script>
