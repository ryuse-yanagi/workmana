<template>
  <form class="inline-composer" @submit.prevent="submit">
    <component
      :is="multiline ? 'textarea' : 'input'"
      ref="inputRef"
      :value="modelValue"
      :type="multiline ? undefined : 'text'"
      :rows="multiline ? rows : undefined"
      :maxlength="maxlength"
      :placeholder="placeholder"
      :disabled="pending"
      :class="multiline ? 'inline-composer__textarea' : 'inline-composer__input'"
      @input="onInput"
      @keydown.enter.exact.prevent="submit"
      @keydown.escape.prevent="$emit('cancel')"
    />
    <div class="inline-composer__actions">
      <button type="submit" class="primary-btn primary-btn--pill primary-btn--compact" :disabled="pending || !modelValue.trim()">
        {{ pending ? pendingLabel : submitLabel }}
      </button>
      <button type="button" class="ghost-btn ghost-btn--pill ghost-btn--compact" :disabled="pending" @click="$emit('cancel')">
        {{ cancelLabel }}
      </button>
    </div>
  </form>
</template>
<script setup lang="ts">
import { TASK_TITLE_MAX_LENGTH } from '../../constants/fieldLengthLimits'
const props = withDefaults(defineProps<{
  modelValue: string
  placeholder?: string
  pending?: boolean
  multiline?: boolean
  rows?: number
  maxlength?: number
  submitLabel?: string
  pendingLabel?: string
  cancelLabel?: string
}>(), {
  placeholder: '',
  pending: false,
  multiline: false,
  rows: 3,
  maxlength: TASK_TITLE_MAX_LENGTH,
  submitLabel: '追加',
  pendingLabel: '追加中...',
  cancelLabel: 'キャンセル',
})
const emit = defineEmits<{
  'update:modelValue': [string]
  submit: []
  cancel: []
}>()
const inputRef = ref<HTMLInputElement | HTMLTextAreaElement | null>(null)
function onInput (event: Event) {
  const target = event.target as HTMLInputElement | HTMLTextAreaElement
  emit('update:modelValue', target.value)
  if (props.multiline && target instanceof HTMLTextAreaElement) {
    target.style.height = 'auto'
    target.style.height = `${Math.min(target.scrollHeight, 120)}px`
  }
}
function submit () {
  if (props.pending || !props.modelValue.trim()) {
    return
  }
  emit('submit')
}
defineExpose({ inputRef })
</script>
<style lang="scss" scoped>
.inline-composer {
  display: flex;
  flex-direction: column;
  gap: 6.3px;
}
.inline-composer__input,
.inline-composer__textarea {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid mixin.$border;
  border-radius: 8px;
  padding: 7.7px 9.8px;
  font: inherit;
  font-size: 12.6px;
  background: #fff;
}
.inline-composer__textarea {
  resize: vertical;
  min-height: 63px;
}
.inline-composer__input:focus,
.inline-composer__textarea:focus {
  @include mixin.input-focus-ring;
}
.inline-composer__actions {
  display: flex;
  gap: 5.6px;
}
.ghost-btn,
.primary-btn {
  @include mixin.btn-base;
}
.ghost-btn--pill,
.primary-btn--pill {
  @include mixin.btn-pill;
}
.ghost-btn--compact,
.primary-btn--compact {
  padding: 4.9px 11.9px;
  font-size: 11.48px;
}
.ghost-btn {
  @include mixin.btn-ghost;
}
.primary-btn {
  @include mixin.btn-primary;
}
</style>
