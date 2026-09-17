<template>
  <div
    class="title-input-wrap"
    :class="`title-input-wrap--${size}`"
  >
    <textarea
      ref="textareaRef"
      :value="modelValue"
      :maxlength="maxlength"
      class="title-input"
      :aria-label="ariaLabel"
      :disabled="disabled"
      rows="1"
      @input="onInput"
      @compositionstart="emit('compositionstart', $event)"
      @compositionend="emit('compositionend', $event)"
      @blur="emit('blur', $event)"
      @keydown.enter.prevent="emit('keydown-enter', $event)"
      @keydown.escape.prevent.stop="emit('keydown-escape', $event)"
    />
    <span
      v-if="showPlaceholder"
      class="title-input-placeholder"
      aria-hidden="true"
    >{{ placeholder }}</span>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  modelValue: string
  maxlength: number
  ariaLabel: string
  placeholder?: string
  showPlaceholder?: boolean
  disabled?: boolean
  /** form = TaskFormPane (25px); detail = TaskDetailModal (24px) */
  size?: 'form' | 'detail'
}>(), {
  placeholder: 'タスク名を入力...',
  showPlaceholder: false,
  disabled: false,
  size: 'form',
})

const emit = defineEmits<{
  'update:modelValue': [string]
  input: [Event]
  compositionstart: [CompositionEvent]
  compositionend: [CompositionEvent]
  blur: [FocusEvent]
  'keydown-enter': [KeyboardEvent]
  'keydown-escape': [KeyboardEvent]
}>()

const textareaRef = ref<HTMLTextAreaElement | null>(null)

function onInput (event: Event) {
  const target = event.target
  if (!(target instanceof HTMLTextAreaElement)) return
  emit('update:modelValue', target.value)
  emit('input', event)
}

defineExpose({
  textareaRef,
  el: textareaRef,
})
</script>

<style lang="scss" scoped src="~/assets/styles/components/task/TaskTitleField.scss"></style>
