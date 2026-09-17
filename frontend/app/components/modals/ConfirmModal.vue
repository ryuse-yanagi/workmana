<template>
  <BaseModal
    :model-value="modelValue"
    :title="title"
    :close-disabled="loading"
    :width="width"
    @update:model-value="emit('update:modelValue', $event)"
    @ctrl-enter="onCtrlEnter"
  >
    <div class="confirm-modal-body">
      <p v-if="message" class="confirm-modal-message">{{ message }}</p>
      <div class="confirm-modal-actions">
        <button type="button" class="ghost-btn ghost-btn--rounded" :disabled="loading" @click="close">
          {{ cancelText }}
        </button>
        <button
          v-if="discardText"
          type="button"
          class="danger-btn danger-btn--rounded"
          :disabled="loading"
          @click="$emit('discard')"
        >
          {{ discardText }}
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
  /** 指定時は「破棄」系の第3ボタンを表示する */
  discardText?: string
  variant?: 'primary' | 'danger'
  loading?: boolean
  width?: string
}>(), {
  message: '',
  confirmText: '実行',
  cancelText: 'キャンセル',
  discardText: undefined,
  variant: 'primary',
  loading: false,
  width: 'min(496px, 100%)',
})
const emit = defineEmits<{
  'update:modelValue': [boolean]
  confirm: []
  discard: []
}>()
function close () {
  if (props.loading) return
  emit('update:modelValue', false)
}
function onCtrlEnter () {
  if (props.loading) return
  emit('confirm')
}
syncAppLoadingCursor(() => props.loading)
</script>
<style lang="scss" scoped src="~/assets/styles/components/modals/ConfirmModal.scss"></style>
