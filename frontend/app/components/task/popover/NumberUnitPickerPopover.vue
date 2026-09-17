<template>
  <PopoverShell
    ref="shellRef"
    :shell-class="shellClass"
    :style="style"
    :title="title"
    :aria-label="ariaLabel"
    :close-disabled="disabled"
    :show-clear="canClear"
    :clear-disabled="disabled"
    @close="$emit('close')"
    @clear="$emit('clear')"
  >
    <div class="effort-input-row">
      <input
        ref="inputRef"
        :value="draft"
        type="number"
        :min="min"
        :max="max"
        :step="step"
        class="effort-input"
        :placeholder="placeholder"
        :aria-label="inputAriaLabel"
        :disabled="disabled"
        @input="$emit('update:draft', ($event.target as HTMLInputElement).value)"
        @keydown.enter.prevent="$emit('finalize')"
        @keydown.escape.prevent="$emit('finalize')"
        @click.stop
      />
      <span class="effort-unit-label">{{ unitLabel }}</span>
    </div>
    <p v-if="error" class="err">{{ error }}</p>
  </PopoverShell>
</template>

<script setup lang="ts">
import PopoverShell from '../../ui/PopoverShell.vue'
import { schedulePopoverInputFocus } from '../../../utils/schedulePopoverInputFocus'

withDefaults(defineProps<{
  style?: Record<string, string>
  disabled?: boolean
  canClear?: boolean
  error?: string | null
  draft: string
  unitLabel: string
  title: string
  ariaLabel: string
  min?: number
  max?: number
  step?: number | string
  placeholder: string
  inputAriaLabel: string
  shellClass?: string
}>(), {
  disabled: false,
  canClear: false,
  error: null,
  min: 0,
  step: 1,
  shellClass: 'popover',
})

defineEmits<{
  close: []
  clear: []
  'update:draft': [value: string]
  finalize: []
}>()

const shellRef = ref<InstanceType<typeof PopoverShell> | null>(null)
const inputRef = ref<HTMLInputElement | null>(null)

onMounted(() => {
  schedulePopoverInputFocus(() => inputRef.value, { select: 'all' })
})

defineExpose({
  get rootRef () {
    return shellRef.value?.rootRef ?? null
  },
  get inputRef () {
    return inputRef.value
  },
})
</script>

<style lang="scss" scoped src="~/assets/styles/components/task/popover/taskFieldPopovers.scss"></style>
