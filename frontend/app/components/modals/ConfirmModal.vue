<template>
  <BaseModal
    :model-value="modelValue"
    :title="title"
    :close-disabled="loading"
    width="min(31rem, 100%)"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="confirm-modal-body">
      <p v-if="message" class="confirm-modal-message">{{ message }}</p>
      <div class="confirm-modal-actions">
        <button type="button" class="ghost-btn ghost-btn--rounded" :disabled="loading" @click="close">
          {{ cancelText }}
        </button>
        <button
          type="button"
          :class="variant === 'danger' ? 'danger-btn danger-btn--rounded' : 'primary-btn primary-btn--rounded'"
          :disabled="loading"
          @click="$emit('confirm')"
        >
          {{ confirmText }}
        </button>
      </div>
    </div>
  </BaseModal>
</template>
<script setup lang="ts">
import { syncAppLoadingCursor } from '../../composables/useAppLoadingCursor'
const props = withDefaults(defineProps<{
  modelValue: boolean
  title: string
  message?: string
  confirmText?: string
  cancelText?: string
  variant?: 'primary' | 'danger'
  loading?: boolean
}>(), {
  message: '',
  confirmText: '実行',
  cancelText: 'キャンセル',
  variant: 'primary',
  loading: false,
})
const emit = defineEmits<{
  'update:modelValue': [boolean]
  confirm: []
}>()
function close () {
  if (props.loading) return
  emit('update:modelValue', false)
}
syncAppLoadingCursor(() => props.loading)
</script>
<style lang="scss" scoped>
.confirm-modal-body {
  padding: 1rem;
}
.confirm-modal-message {
  margin: 0;
  font-size: 0.9rem;
  color: mixin.$text-sub;
  line-height: 1.45;
}
.confirm-modal-actions {
  margin-top: 0.95rem;
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}
.ghost-btn,
.primary-btn,
.danger-btn {
  @include mixin.btn-base;
}
.ghost-btn--rounded,
.primary-btn--rounded,
.danger-btn--rounded {
  border-radius: 10px;
  padding: 0.5rem 0.75rem;
  font-size: 0.86rem;
}
.ghost-btn {
  @include mixin.btn-ghost;
}
.primary-btn {
  @include mixin.btn-primary;
}
.danger-btn {
  background: #ff0000;
  color: #fff;
}
</style>
