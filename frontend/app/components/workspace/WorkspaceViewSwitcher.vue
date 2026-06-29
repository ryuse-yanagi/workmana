<template>
  <div class="workspace-view-switcher" data-workspace-view-switcher-root>
    <button
      ref="triggerRef"
      type="button"
      class="workspace-view-switcher-trigger"
      :aria-expanded="menuOpen"
      aria-haspopup="menu"
      :aria-label="`${activeViewLabel}表示。表示形式を切り替え`"
      @click.stop="toggleMenu"
    >
      <component
        :is="activeViewIcon"
        :size="24"
        :stroke-width="2.25"
        class="workspace-view-switcher-trigger__icon"
        aria-hidden="true"
      />
      <span class="workspace-view-switcher-trigger__label">{{ activeViewLabel }}</span>
    </button>
  </div>
  <Teleport to="body">
    <div
      ref="menuRef"
      v-if="menuOpen"
      class="workspace-view-switcher-menu"
      role="menu"
      :style="menuStyle"
    >
      <NuxtLink
        v-for="view in views"
        :key="view.key"
        :to="view.to"
        class="workspace-view-switcher-item"
        role="menuitem"
        @click="closeMenu"
      >
        <component
          :is="viewIcons[view.key]"
          :size="18"
          :stroke-width="2.25"
          class="workspace-view-switcher-item__icon"
          aria-hidden="true"
        />
        <span class="workspace-view-switcher-item__label">{{ view.label }}</span>
        <Check
          v-if="isViewSelected(view.key)"
          :size="18"
          :stroke-width="2.5"
          class="workspace-view-switcher-item__check"
          aria-hidden="true"
        />
      </NuxtLink>
    </div>
  </Teleport>
</template>
<script setup lang="ts">
import type { Component } from 'vue'
import { ChartGantt, Check, LayoutPanelLeft, NotebookPen, TableProperties } from 'lucide-vue-next'
import {
  useWorkspaceViewRoutes,
  type WorkspaceViewKey,
} from '../../composables/useWorkspaceViewRoutes'
const viewIcons: Record<WorkspaceViewKey, Component> = {
  board: LayoutPanelLeft,
  table: TableProperties,
  gantt: ChartGantt,
}
const props = defineProps<{
  orgSlug: string
  workspaceId: string
}>()
const MENU_MIN_WIDTH = 184
const MENU_OFFSET_X = 14
const triggerRef = ref<HTMLElement | null>(null)
const menuRef = ref<HTMLElement | null>(null)
const menuOpen = ref(false)
const menuPosition = ref<{ top: number; left: number } | null>(null)
const { views, activeView } = useWorkspaceViewRoutes(
  () => props.orgSlug,
  () => props.workspaceId,
)
const activeViewIcon = computed(() => {
  if (activeView.value === 'documents') {
    return NotebookPen
  }
  return viewIcons[activeView.value]
})
const activeViewLabel = computed(() => {
  if (activeView.value === 'documents') {
    return 'Documents'
  }
  return views.value.find(view => view.key === activeView.value)?.label ?? 'ボード'
})
const isViewSelected = (key: WorkspaceViewKey) => {
  return activeView.value === key
}
const menuStyle = computed(() => {
  if (!menuPosition.value) {
    return {
      visibility: 'hidden',
    } as Record<string, string>
  }
  const { top, left } = menuPosition.value
  return {
    top: `${top}px`,
    left: `${left}px`,
    minWidth: `${MENU_MIN_WIDTH}px`,
    visibility: 'visible',
  }
})
function closeMenu () {
  menuOpen.value = false
  menuPosition.value = null
}
function positionMenu () {
  const anchor = triggerRef.value
  if (!anchor || !import.meta.client) {
    menuPosition.value = null
    return
  }
  const rect = anchor.getBoundingClientRect()
  const pad = 8
  const gap = 6
  const menuWidth = menuRef.value?.offsetWidth ?? MENU_MIN_WIDTH
  const triggerCenterX = rect.left + rect.width / 2
  let left = triggerCenterX - menuWidth / 2 + MENU_OFFSET_X
  left = Math.max(pad, Math.min(left, window.innerWidth - menuWidth - pad))
  menuPosition.value = {
    top: rect.bottom + gap,
    left,
  }
}
function toggleMenu () {
  if (menuOpen.value) {
    closeMenu()
    return
  }
  menuOpen.value = true
  menuPosition.value = null
  nextTick(() => {
    positionMenu()
    nextTick(() => positionMenu())
  })
}
function onGlobalClick (ev: Event) {
  const t = ev.target
  if (!(t instanceof Node)) {
    closeMenu()
    return
  }
  const el = t instanceof Element ? t : t.parentElement
  if (el?.closest('[data-workspace-view-switcher-root]')) {
    return
  }
  if (el?.closest('.workspace-view-switcher-menu')) {
    return
  }
  closeMenu()
}
function onWindowResize () {
  if (!menuOpen.value) {
    return
  }
  positionMenu()
}
onMounted(() => {
  if (!import.meta.client) {
    return
  }
  window.addEventListener('click', onGlobalClick)
  window.addEventListener('resize', onWindowResize)
})
onBeforeUnmount(() => {
  if (!import.meta.client) {
    return
  }
  window.removeEventListener('click', onGlobalClick)
  window.removeEventListener('resize', onWindowResize)
})
</script>
<style lang="scss" scoped>
.workspace-view-switcher {
  display: flex;
  align-items: center;
  align-self: stretch;
  height: 100%;
  flex-shrink: 0;
  margin-left: 2.4rem;
}
.workspace-view-switcher-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  height: 100%;
  border: none;
  background: transparent;
  color: #334155;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}
.workspace-view-switcher-trigger__icon {
  flex-shrink: 0;
  display: block;
}
.workspace-view-switcher-trigger__label {
  font-size: 0.9rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  line-height: 1;
  white-space: nowrap;
}
.workspace-view-switcher-menu {
  position: fixed;
  z-index: 120;
  box-sizing: border-box;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.12);
  padding: 0.35rem;
}
.workspace-view-switcher-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  box-sizing: border-box;
  border: none;
  border-radius: 8px;
  padding: 0.55rem 0.65rem;
  background: transparent;
  color: #0f172a;
  font: inherit;
  font-size: 0.875rem;
  font-weight: 600;
  text-align: left;
  text-decoration: none;
  cursor: pointer;
  &:hover {
    background: #f1f5f9;
  }
}
.workspace-view-switcher-item__icon {
  flex-shrink: 0;
  color: #64748b;
}
.workspace-view-switcher-item__label {
  min-width: 0;
}
.workspace-view-switcher-item__check {
  margin-left: auto;
  flex-shrink: 0;
  color: mixin.$main-aqua;
}
</style>
