<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div
        v-if="modelValue"
        ref="overlayRef"
        class="modal-overlay"
        :class="{ 'modal-overlay--popover-open': popoverOpen }"
        role="presentation"
        @mousedown="onOverlayMouseDown"
      >
        <section
          ref="modalCardRef"
          class="modal-card"
          :style="modalScrollbarStyle"
          role="dialog"
          aria-modal="true"
          :aria-label="title"
        >
          <header class="modal-header">
            <h3>{{ title }}</h3>
            <button
              type="button"
              class="icon-close"
              :disabled="loading"
              aria-label="閉じる"
              @click="close"
            >
              <X
                :size="20"
                :stroke-width="2.25"
                aria-hidden="true"
              />
            </button>
          </header>
          <div class="modal-body">
            <slot />
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { X } from 'lucide-vue-next'
import { createOverlayBackdropClose, getTopmostModalOverlay, isCtrlEnterKeydown } from '../../utils/uiInteraction'
import { useModalLayer } from '../../composables/useModalLayer'
import { useModalScrollbarGutter } from '../../composables/useModalScrollbarGutter'

const props = withDefaults(defineProps<{
  modelValue: boolean
  title: string
  loading?: boolean
  /** TaskFormPane 等のポップオーバー表示中はオーバーレイの overflow を抑える */
  popoverOpen?: boolean
}>(), {
  loading: false,
  popoverOpen: false,
})

const emit = defineEmits<{
  'update:modelValue': [boolean]
  /** Escape / 背景クリック時。親でポップオーバー閉じを挟んでから閉じる想定 */
  'backdrop-close': []
  'ctrl-enter': []
}>()

const overlayRef = ref<HTMLElement | null>(null)
const modalCardRef = ref<HTMLElement | null>(null)
const { scrollbarStyle: modalScrollbarStyle } = useModalScrollbarGutter({
  cardRef: modalCardRef,
  open: () => props.modelValue,
  scrollerSelector: '.modal-body',
})

useModalLayer(() => props.modelValue)

function close () {
  if (props.loading) return
  emit('update:modelValue', false)
}

function onBackdropClose () {
  if (props.loading) return
  emit('backdrop-close')
}

function onDocumentKeydown (event: KeyboardEvent) {
  if (!props.modelValue) return
  if (getTopmostModalOverlay() !== overlayRef.value) return
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    onBackdropClose()
    return
  }
  if (isCtrlEnterKeydown(event)) {
    event.preventDefault()
    event.stopPropagation()
    emit('ctrl-enter')
  }
}

const {
  onOverlayMouseDown,
  resetOverlayBackdropClose,
} = createOverlayBackdropClose({
  onClose: onBackdropClose,
  canClose: () => !props.loading,
})

watch(
  () => props.modelValue,
  (open) => {
    if (!import.meta.client) return
    if (open) {
      document.addEventListener('keydown', onDocumentKeydown, true)
      return
    }
    document.removeEventListener('keydown', onDocumentKeydown, true)
    resetOverlayBackdropClose()
  },
)

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onDocumentKeydown, true)
  resetOverlayBackdropClose()
})
</script>

<style lang="scss" scoped src="~/assets/styles/components/modals/PaneEntityFormModal.scss"></style>
