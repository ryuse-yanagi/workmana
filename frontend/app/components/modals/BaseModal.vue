<template>
  <Teleport to="body">
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
            ✕
          </button>
        </header>
        <slot />
      </section>
    </div>
  </Teleport>
</template>
<script setup lang="ts">
import { createOverlayBackdropClose, getTopmostModalOverlay } from '../../utils/uiInteraction'
const props = withDefaults(defineProps<{
  modelValue: boolean
  title?: string
  ariaLabel?: string
  closeDisabled?: boolean
  showClose?: boolean
  closeOnBackdrop?: boolean
  /** 開いた直後に最初のテキスト入力欄へフォーカスする（作成モーダル向け） */
  focusPrimaryInputOnOpen?: boolean
  width?: string
  borderRadius?: string
  zIndex?: number
  overlayClass?: string | Record<string, boolean> | Array<string | Record<string, boolean>>
}>(), {
  title: '',
  closeDisabled: false,
  showClose: true,
  closeOnBackdrop: true,
  focusPrimaryInputOnOpen: false,
  width: 'min(576px, 100%)',
  borderRadius: '10px',
  zIndex: 70,
})
const emit = defineEmits<{
  'update:modelValue': [boolean]
  close: []
  'overlay-mousedown': [MouseEvent]
  'overlay-click': [MouseEvent]
}>()
const cardRef = ref<HTMLElement | null>(null)
const overlayRef = ref<HTMLElement | null>(null)
const cardStyle = computed(() => ({
  width: props.width,
  borderRadius: props.borderRadius,
}))
const overlayStyle = computed(() => ({
  zIndex: props.zIndex,
}))
function requestClose () {
  if (props.closeDisabled) {
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
function onDocumentEscape (event: KeyboardEvent) {
  if (event.key !== 'Escape' || !props.modelValue) {
    return
  }
  if (getTopmostModalOverlay() !== overlayRef.value) {
    return
  }
  if (props.closeDisabled) {
    return
  }
  event.preventDefault()
  event.stopPropagation()
  requestClose()
}
const PRIMARY_INPUT_SELECTOR = [
  'input[type="text"]:not([disabled])',
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
    document.addEventListener('keydown', onDocumentEscape, true)
    if (props.focusPrimaryInputOnOpen) {
      focusPrimaryInput()
    }
  } else {
    document.removeEventListener('keydown', onDocumentEscape, true)
  }
}, { immediate: true })
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onDocumentEscape, true)
  resetOverlayBackdropClose()
})
defineExpose({ cardRef })
</script>
<style lang="scss" scoped src="~/assets/styles/components/modals/BaseModal.scss"></style>
