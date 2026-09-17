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
      <button
        v-if="showClear"
        type="button"
        class="board-filter-clear"
        :disabled="clearDisabled"
        @click="$emit('clear')"
      >
        クリア
      </button>
      <p class="popover-shell__title">{{ title }}</p>
      <div class="popover-shell__header-end">
        <slot name="header-end" />
        <button
          type="button"
          class="popover-shell__close"
          :disabled="closeDisabled"
          aria-label="閉じる"
          @click="$emit('close')"
        >
          <X
            :size="16"
            :stroke-width="2.25"
            aria-hidden="true"
          />
        </button>
      </div>
    </header>
    <slot />
  </div>
</template>
<script setup lang="ts">
import { X } from 'lucide-vue-next'
withDefaults(defineProps<{
  title: string
  ariaLabel?: string
  style?: Record<string, string>
  closeDisabled?: boolean
  showClear?: boolean
  clearDisabled?: boolean
  shellClass?: string | Record<string, boolean> | Array<string | Record<string, boolean>>
  headerClass?: string | Record<string, boolean> | Array<string | Record<string, boolean>>
}>(), {
  closeDisabled: false,
  showClear: false,
  clearDisabled: false,
})
defineEmits<{
  close: []
  clear: []
}>()
const rootRef = ref<HTMLElement | null>(null)
defineExpose({ rootRef })
</script>
<style lang="scss" scoped src="~/assets/styles/components/ui/PopoverShell.scss"></style>
