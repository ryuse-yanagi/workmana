<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div
        v-if="modelValue"
        ref="overlayRef"
        class="base-modal-overlay"
        :class="overlayClass"
        :style="overlayStyle"
        role="presentation"
        @mousedown="onOverlayMouseDown"
      >
        <section
          ref="cardRef"
          class="base-modal-card"
          :class="{
            'base-modal-card--min-height': minHeight,
            'base-modal-card--fixed-max-height': fixedMaxHeight,
          }"
          :style="cardStyle"
          role="dialog"
          aria-modal="true"
          :aria-label="ariaLabel ?? title"
        >
          <header class="base-modal-header">
            <slot name="header">
              <h3 class="base-modal-title">{{ title }}</h3>
            </slot>
            <button
              v-if="showClose"
              type="button"
              class="base-modal-close"
              :disabled="closeDisabled"
              aria-label="閉じる"
              @click="requestClose"
            >
              <X
                :size="20"
                :stroke-width="2.25"
                aria-hidden="true"
              />
            </button>
          </header>
          <slot />
        </section>
      </div>
    </Transition>
  </Teleport>
</template>
<script setup lang="ts">
import { X } from 'lucide-vue-next'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { createOverlayBackdropClose, dismissExclusivePopoverBeforeModalClose, getTopmostModalOverlay, isCtrlEnterKeydown } from '../../utils/uiInteraction'
import { useModalLayer } from '../../composables/useModalLayer'
import { useModalScrollbarGutter } from '../../composables/useModalScrollbarGutter'

const props = withDefaults(defineProps<{
  modelValue: boolean
  title?: string
  ariaLabel?: string
  closeDisabled?: boolean
  showClose?: boolean
  closeOnBackdrop?: boolean
  /** 開いた直後に最初のテキスト入力欄へフォーカスする（作成モーダル向け） */
  focusPrimaryInputOnOpen?: boolean
  /** Ctrl/Cmd+Enter で決定ショートカットを有効にする */
  confirmOnCtrlEnter?: boolean
  width?: string
  borderRadius?: string
  zIndex?: number
  /** 確認モーダルなど、カード全体の最小高さ（$modal-card-min-height）を確保する */
  minHeight?: boolean
  /** 上下56px余白を残した最大高さ（$modal-card-max-height）にカードを固定する */
  fixedMaxHeight?: boolean
  overlayClass?: string | Record<string, boolean> | Array<string | Record<string, boolean>>
}>(), {
  title: '',
  closeDisabled: false,
  showClose: true,
  closeOnBackdrop: true,
  focusPrimaryInputOnOpen: false,
  confirmOnCtrlEnter: true,
  width: 'min(560px, 100%)',
  borderRadius: '10px',
  zIndex: 200,
  minHeight: false,
  fixedMaxHeight: false,
})
const emit = defineEmits<{
  'update:modelValue': [boolean]
  close: []
  'ctrl-enter': []
  'overlay-mousedown': [MouseEvent]
  'overlay-click': [MouseEvent]
}>()
const cardRef = ref<HTMLElement | null>(null)
const overlayRef = ref<HTMLElement | null>(null)
const { scrollbarStyle } = useModalScrollbarGutter({
  cardRef,
  open: () => props.modelValue,
  width: () => props.width,
})
const cardStyle = computed(() => ({
  ...scrollbarStyle.value,
  borderRadius: props.borderRadius,
}))
const overlayStyle = computed(() => ({
  zIndex: props.zIndex,
}))
useModalLayer(() => props.modelValue)
function requestClose () {
  if (props.closeDisabled) {
    return
  }
  if (dismissExclusivePopoverBeforeModalClose()) {
    return
  }
  emit('update:modelValue', false)
  emit('close')
}
const {
  onOverlayMouseDown: onBackdropMouseDown,
  resetOverlayBackdropClose,
} = createOverlayBackdropClose({
  onClose: requestClose,
  canClose: () => props.closeOnBackdrop && !props.closeDisabled,
})
function onOverlayMouseDown (event: MouseEvent) {
  emit('overlay-mousedown', event)
  onBackdropMouseDown(event)
}
function onDocumentKeydown (event: KeyboardEvent) {
  if (!props.modelValue) {
    return
  }
  if (getTopmostModalOverlay() !== overlayRef.value) {
    return
  }
  if (event.key === 'Escape') {
    if (props.closeDisabled) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    requestClose()
    return
  }
  if (!props.confirmOnCtrlEnter || !isCtrlEnterKeydown(event)) {
    return
  }
  if (props.closeDisabled) {
    return
  }
  event.preventDefault()
  event.stopPropagation()
  emit('ctrl-enter')
}
const PRIMARY_INPUT_SELECTOR = [
  'input[type="text"]:not([disabled])',
  'input[type="email"]:not([disabled])',
  'input:not([type]):not([disabled])',
  'textarea:not([disabled])',
].join(', ')
function focusPrimaryInput () {
  nextTick(() => {
    const input = cardRef.value?.querySelector<HTMLElement>(PRIMARY_INPUT_SELECTOR)
    input?.focus()
  })
}
watch(() => props.modelValue, (open) => {
  if (!import.meta.client) {
    return
  }
  if (open) {
    document.addEventListener('keydown', onDocumentKeydown, true)
    if (props.focusPrimaryInputOnOpen) {
      focusPrimaryInput()
    }
  } else {
    document.removeEventListener('keydown', onDocumentKeydown, true)
  }
}, { immediate: true })
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onDocumentKeydown, true)
  resetOverlayBackdropClose()
})
defineExpose({ cardRef })
</script>
<style lang="scss" scoped src="~/assets/styles/components/modals/BaseModal.scss"></style>
