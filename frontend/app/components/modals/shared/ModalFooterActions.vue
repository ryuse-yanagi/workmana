<template>
  <div class="modal-footer-actions">
    <button
      type="button"
      class="modal-footer-actions__btn modal-footer-actions__btn--ghost"
      :disabled="cancelDisabled"
      @click="emit('cancel')"
    >
      {{ cancelText }}
    </button>
    <button
      v-if="discardText"
      type="button"
      class="modal-footer-actions__btn modal-footer-actions__btn--danger"
      :disabled="allDisabled"
      @click="emit('discard')"
    >
      {{ discardText }}
    </button>
    <button
      type="button"
      class="modal-footer-actions__btn"
      :class="confirmVariant === 'danger'
        ? 'modal-footer-actions__btn--danger'
        : 'modal-footer-actions__btn--primary'"
      :disabled="confirmIsDisabled"
      @click="emit('confirm')"
    >
      {{ confirmText }}
    </button>
  </div>
</template>
<script setup lang="ts">
const props = withDefaults(defineProps<{
  cancelText?: string
  confirmText?: string
  /** 指定時は中央に危険操作ボタンを追加（確認モーダルの破棄など） */
  discardText?: string
  confirmVariant?: 'primary' | 'danger'
  /** 全ボタンを無効化 */
  disabled?: boolean
  /** 決定ボタンのみ追加で無効化（disabled と OR） */
  confirmDisabled?: boolean
}>(), {
  cancelText: 'キャンセル',
  confirmText: '保存',
  discardText: undefined,
  confirmVariant: 'primary',
  disabled: false,
  confirmDisabled: false,
})

const emit = defineEmits<{
  cancel: []
  confirm: []
  discard: []
}>()

const allDisabled = computed(() => props.disabled)
const cancelDisabled = computed(() => props.disabled)
const confirmIsDisabled = computed(() => props.disabled || props.confirmDisabled)
</script>
<style lang="scss" scoped src="~/assets/styles/components/modals/shared/ModalFooterActions.scss"></style>
