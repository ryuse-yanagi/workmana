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
        {{ submitLabel }}
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
  cancelLabel?: string
}>(), {
  placeholder: '',
  pending: false,
  multiline: false,
  rows: 3,
  maxlength: TASK_TITLE_MAX_LENGTH,
  submitLabel: '追加',
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
<style lang="scss" scoped src="~/assets/styles/components/ui/InlineComposer.scss"></style>
