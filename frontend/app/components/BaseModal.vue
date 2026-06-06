<template>
  <Teleport to="body">
    <Transition name="tm-fade">
      <div
        v-if="modelValue"
        class="base-modal-overlay"
        :class="[overlayAlignClass, overlayClass]"
        role="presentation"
        @mousedown="onOverlayMouseDown"
        @click.self="onOverlayClick"
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
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  modelValue: boolean
  title?: string
  ariaLabel?: string
  closeDisabled?: boolean
  showClose?: boolean
  closeOnBackdrop?: boolean
  width?: string
  borderRadius?: string
  align?: 'center' | 'top'
  zIndex?: number
  overlayClass?: string | Record<string, boolean> | Array<string | Record<string, boolean>>
}>(), {
  title: '',
  closeDisabled: false,
  showClose: true,
  closeOnBackdrop: true,
  width: 'min(36rem, 100%)',
  borderRadius: '10px',
  align: 'center',
  zIndex: 70,
})

const emit = defineEmits<{
  'update:modelValue': [boolean]
  close: []
  'overlay-mousedown': [MouseEvent]
  'overlay-click': [MouseEvent]
}>()

const cardRef = ref<HTMLElement | null>(null)

const overlayAlignClass = computed(() =>
  props.align === 'top' ? 'base-modal-overlay--top' : 'base-modal-overlay--center',
)

const cardStyle = computed(() => ({
  width: props.width,
  borderRadius: props.borderRadius,
}))

function requestClose () {
  if (props.closeDisabled) {
    return
  }
  emit('update:modelValue', false)
  emit('close')
}

function onOverlayMouseDown (event: MouseEvent) {
  emit('overlay-mousedown', event)
}

function onOverlayClick (event: MouseEvent) {
  emit('overlay-click', event)
  if (!props.closeOnBackdrop || props.closeDisabled) {
    return
  }
  requestClose()
}

defineExpose({ cardRef })
</script>

<style lang="scss" scoped>
.base-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  justify-content: center;
  padding: 1rem;
  z-index: v-bind('props.zIndex');
}

.base-modal-overlay--center {
  align-items: center;
}

.base-modal-overlay--top {
  align-items: flex-start;
  padding-top: 4rem;
  overflow-y: auto;
}

.base-modal-card {
  overflow: hidden;
  background: #fff;
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.18);
}

.base-modal-header {
  @include mixin.modal-header-bar;
}

.base-modal-title {
  margin: 0;
  font-size: 1.05rem;
  line-height: 1;
}

.base-modal-close {
  background: transparent;
  border: none;
  color: #fff;
  font-size: 1.4rem;
  line-height: 1;
  cursor: pointer;
  padding: 0;
  margin: 0;
}

.base-modal-close:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
</style>
