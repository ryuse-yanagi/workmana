<template>
  <div
    ref="rootRef"
    class="popover-shell"
    :class="shellClass"
    :style="style"
    role="dialog"
    :aria-label="ariaLabel ?? title"
    @click.stop
  >
    <header class="popover-shell__header" :class="headerClass">
      <h4 class="popover-shell__title">{{ title }}</h4>
      <button
        type="button"
        class="popover-shell__close"
        :disabled="closeDisabled"
        aria-label="閉じる"
        @click="$emit('close')"
      >
        ✕
      </button>
    </header>
    <slot />
  </div>
</template>
<script setup lang="ts">
withDefaults(defineProps<{
  title: string
  ariaLabel?: string
  style?: Record<string, string>
  closeDisabled?: boolean
  shellClass?: string | Record<string, boolean> | Array<string | Record<string, boolean>>
  headerClass?: string | Record<string, boolean> | Array<string | Record<string, boolean>>
}>(), {
  closeDisabled: false,
})
defineEmits<{
  close: []
}>()
const rootRef = ref<HTMLElement | null>(null)
defineExpose({ rootRef })
</script>
<style lang="scss" scoped>
.popover-shell {
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.18);
  overflow: hidden;
}
.popover-shell__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.65rem 0.75rem;
  border-bottom: 1px solid #e2e8f0;
}
.popover-shell__title {
  margin: 0;
  font-size: 0.92rem;
  font-weight: 800;
  color: #0f172a;
}
.popover-shell__close {
  background: transparent;
  border: none;
  color: #64748b;
  font-size: 1.1rem;
  line-height: 1;
  cursor: pointer;
  padding: 0;
}
.popover-shell__close:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
</style>
