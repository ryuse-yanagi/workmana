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
      <ModalFooterActions
        :cancel-text="cancelText"
        :confirm-text="confirmText"
        :discard-text="discardText"
        :confirm-variant="variant"
        :disabled="loading"
        @cancel="close"
        @confirm="emit('confirm')"
        @discard="emit('discard')"
      />
    </div>
  </BaseModal>
</template>
<script setup lang="ts">
import { syncAppLoadingCursor } from '../../../composables/ui/useAppLoadingCursor'
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
<style lang="scss" scoped src="~/assets/styles/components/modals/shared/ConfirmModal.scss"></style>
