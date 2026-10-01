<template>
  <Teleport to="body">
    <Transition name="popover-fade" @after-leave="emit('after-leave')">
      <ul
        v-if="open"
        ref="rootRef"
        class="floating-menu"
        :class="[
          `floating-menu--${density}`,
          { 'floating-menu--flush': flush },
          rootClass,
        ]"
        role="menu"
        data-floating-menu
        :style="style"
        @pointerdown.stop
        @click.stop
      >
        <slot>
          <li
            v-for="item in items"
            :key="item.key"
            role="none"
          >
            <button
              type="button"
              class="floating-menu__item"
              :class="{ 'floating-menu__item--danger': item.danger }"
              role="menuitem"
              :disabled="disabled || item.disabled"
              @click="onItemClick(item)"
            >
              <component
                :is="item.icon"
                v-if="item.icon"
                class="floating-menu__icon"
                :size="iconSize"
                :stroke-width="2.25"
                aria-hidden="true"
              />
              {{ item.label }}
            </button>
          </li>
        </slot>
      </ul>
    </Transition>
  </Teleport>
</template>
<script setup lang="ts">
import type { Component, CSSProperties } from 'vue'
import { useExclusivePopover } from '../../composables/ui/useExclusivePopover'
import { clampPopoverBox } from '../../utils/ui/popoverScrollbar'

export type FloatingMenuItem = {
  key: string
  label: string
  danger?: boolean
  disabled?: boolean
  icon?: Component
}

const props = withDefaults(defineProps<{
  open: boolean
  /** 同一メニューを別対象へ切り替えるときの再配置キー */
  instanceKey?: string | number
  items?: FloatingMenuItem[]
  style?: CSSProperties | Record<string, string>
  disabled?: boolean
  density?: 'comfortable' | 'compact'
  /** true のとき項目に角丸・余白インセットを付けない（リストページ向け） */
  flush?: boolean
  rootClass?: string | Record<string, boolean> | Array<string | Record<string, boolean>>
  iconSize?: number
}>(), {
  instanceKey: 'menu',
  items: () => [],
  disabled: false,
  density: 'comfortable',
  flush: true,
  iconSize: 18,
})

const emit = defineEmits<{
  select: [item: FloatingMenuItem]
  close: []
  'after-leave': []
}>()

const rootRef = ref<HTMLElement | null>(null)

useExclusivePopover(
  () => props.open,
  () => emit('close'),
)

function clampToViewport () {
  const el = rootRef.value
  if (!el || !import.meta.client) {
    return
  }
  const rect = el.getBoundingClientRect()
  const { top, left } = clampPopoverBox(rect.top, rect.left, rect.width, rect.height)
  if (Math.abs(top - rect.top) > 0.5) {
    el.style.top = `${Math.round(top)}px`
  }
  if (Math.abs(left - rect.left) > 0.5) {
    el.style.left = `${Math.round(left)}px`
  }
}

watch(
  () => [props.open, props.instanceKey, props.style] as const,
  async ([open]) => {
    if (!open) {
      return
    }
    await nextTick()
    requestAnimationFrame(() => {
      clampToViewport()
    })
  },
)

function onItemClick (item: FloatingMenuItem) {
  if (props.disabled || item.disabled) return
  emit('select', item)
}
</script>
<style lang="scss" scoped src="~/assets/styles/components/ui/FloatingMenu.scss"></style>
