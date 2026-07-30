<template>
  <Teleport to="body">
    <ul
      v-if="open"
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
  </Teleport>
</template>
<script setup lang="ts">
import type { Component, CSSProperties } from 'vue'

export type FloatingMenuItem = {
  key: string
  label: string
  danger?: boolean
  disabled?: boolean
  icon?: Component
}

const props = withDefaults(defineProps<{
  open: boolean
  items?: FloatingMenuItem[]
  style?: CSSProperties | Record<string, string>
  disabled?: boolean
  density?: 'comfortable' | 'compact'
  /** true のとき項目に角丸・余白インセットを付けない（リストページ向け） */
  flush?: boolean
  rootClass?: string | Record<string, boolean> | Array<string | Record<string, boolean>>
  iconSize?: number
}>(), {
  items: () => [],
  disabled: false,
  density: 'comfortable',
  flush: true,
  iconSize: 18,
})

const emit = defineEmits<{
  select: [item: FloatingMenuItem]
}>()

function onItemClick (item: FloatingMenuItem) {
  if (props.disabled || item.disabled) return
  emit('select', item)
}
</script>
<style lang="scss" scoped src="~/assets/styles/components/ui/FloatingMenu.scss"></style>
