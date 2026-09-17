<template>
  <section
    class="field-block attachments-block"
    :class="{ 'attachments-block--collapsed': collapsed }"
  >
    <div class="attachments-block__header">
      <div class="attachments-block__title-row">
        <button
          type="button"
          class="attachments-block__icon-toggle"
          :class="{ 'attachments-block__icon-toggle--collapsed': collapsed }"
          :aria-expanded="!collapsed"
          :aria-label="collapsed ? '添付ファイルを展開' : '添付ファイルを折りたたむ'"
          @click="emit('toggle-collapsed')"
        >
          <span class="attachments-block__icon attachments-block__icon--default" aria-hidden="true">
            <Paperclip :size="20" :stroke-width="2.25" />
          </span>
          <span class="attachments-block__icon attachments-block__icon--hover" aria-hidden="true">
            <ChevronDown :size="20" :stroke-width="2.25" />
          </span>
          <span class="attachments-block__icon attachments-block__icon--collapsed" aria-hidden="true">
            <ChevronRight :size="20" :stroke-width="2.25" />
          </span>
        </button>
        <span class="attachments-block__title">添付ファイル</span>
      </div>
      <button
        type="button"
        class="attachments-upload"
        :disabled="uploadDisabled"
        @click="emit('add')"
      >
        追加
      </button>
    </div>
    <div v-show="!collapsed" class="attachments-block__body">
      <p v-if="loading" class="attachments-state">読み込み中…</p>
      <p v-else-if="error" class="attachments-state attachments-state--error">{{ error }}</p>
      <p v-else-if="!attachments.length" class="attachments-state attachments-state--empty">
        まだ添付ファイルはありません
      </p>
      <ul v-else class="attachments-list">
        <li
          v-for="attachment in attachments"
          :key="attachment.id"
          class="attachments-item"
          :class="{
            'attachments-item--busy':
              downloadingId === attachment.id
              || deletingId === attachment.id,
            'attachments-item--menu-open': openMenuId === attachment.id,
          }"
          @contextmenu="onItemContextMenu(attachment.id, $event)"
        >
          <button
            type="button"
            class="attachments-item__main"
            :disabled="downloadingId === attachment.id || deletingId === attachment.id"
            :aria-label="`${attachment.original_name}をダウンロード`"
            @click="emit('download', attachment)"
          >
            <span
              class="attachments-item__thumb"
              :class="`attachments-item__thumb--${attachmentFileKind(attachment)}`"
              aria-hidden="true"
            >
              <component
                :is="attachmentFileIcon(attachment)"
                :size="18"
                :stroke-width="2.1"
              />
            </span>
            <span class="attachments-item__body">
              <span class="attachments-item__name">{{ attachment.original_name }}</span>
              <span class="attachments-item__meta">
                <span>{{ formatAttachmentSize(attachment.size_bytes) }}</span>
                <span
                  v-if="formatAttachmentDate(attachment.created_at)"
                  class="attachments-item__meta-sep"
                  aria-hidden="true"
                >·</span>
                <span v-if="formatAttachmentDate(attachment.created_at)">
                  {{ formatAttachmentDate(attachment.created_at) }}
                </span>
              </span>
            </span>
          </button>
          <div
            class="attachments-item__menu-wrap"
            :class="{ 'attachments-item__menu-wrap--open': openMenuId === attachment.id }"
            @click.stop
            @pointerdown.stop
            @contextmenu.stop
          >
            <button
              type="button"
              class="attachments-item__menu"
              data-popover-trigger
              :disabled="deletingId === attachment.id || downloadingId === attachment.id"
              :aria-expanded="openMenuId === attachment.id"
              aria-haspopup="menu"
              aria-label="添付ファイルのメニュー"
              @click="toggleMenu(attachment.id, $event)"
            >
              <Ellipsis :size="16" :stroke-width="2.25" aria-hidden="true" />
            </button>
          </div>
        </li>
      </ul>
    </div>
    <FloatingMenu
      :open="openMenuId !== null && menuPosition !== null"
      density="compact"
      :style="menuStyle"
      :disabled="deletingId !== null"
      :items="menuItems"
      @select="onMenuSelect"
      @close="closeMenu"
    />
  </section>
</template>

<script setup lang="ts">
import { ChevronDown, ChevronRight, Ellipsis, Paperclip } from 'lucide-vue-next'
import FloatingMenu, { type FloatingMenuItem } from '../ui/FloatingMenu.vue'
import type { TaskAttachmentItem } from './taskAttachmentTypes'
import {
  attachmentFileIcon,
  attachmentFileKind,
  formatAttachmentDate,
  formatAttachmentSize,
} from './taskAttachmentDisplay'
import {
  POPOVER_VIEWPORT_INSET,
  clampPopoverBox,
  resolveMeasuredFloatingMenuHeight,
} from '../../utils/popoverScrollbar'

const props = withDefaults(defineProps<{
  attachments: TaskAttachmentItem[]
  collapsed: boolean
  loading?: boolean
  error?: string | null
  uploadDisabled?: boolean
  downloadingId?: number | null
  deletingId?: number | null
}>(), {
  loading: false,
  error: null,
  uploadDisabled: false,
  downloadingId: null,
  deletingId: null,
})

const emit = defineEmits<{
  'toggle-collapsed': []
  add: []
  download: [TaskAttachmentItem]
  delete: [number]
}>()

const MENU_MIN_WIDTH = 168
const menuItems: FloatingMenuItem[] = [
  { key: 'delete', label: '添付ファイルの削除', danger: true },
]

const openMenuId = ref<number | null>(null)
const menuPosition = ref<{ top: number; left: number } | null>(null)
let removeMenuResizeListener: (() => void) | null = null

const menuStyle = computed(() => {
  if (!menuPosition.value) {
    return {}
  }
  const { top, left } = menuPosition.value
  return {
    position: 'fixed' as const,
    top: `${top}px`,
    left: `${left}px`,
    minWidth: `${MENU_MIN_WIDTH}px`,
    zIndex: 1100,
  }
})

function closeMenu () {
  openMenuId.value = null
  menuPosition.value = null
}

function positionMenu (anchor: HTMLElement) {
  if (!import.meta.client) {
    menuPosition.value = { top: 0, left: 0 }
    return
  }
  const rect = anchor.getBoundingClientRect()
  const margin = 6
  const pad = POPOVER_VIEWPORT_INSET
  const menuWidth = MENU_MIN_WIDTH
  const menuHeight = resolveMeasuredFloatingMenuHeight(menuItems.length)
  let left = rect.right + margin
  const maxLeft = window.innerWidth - menuWidth - pad
  if (left > maxLeft) {
    left = Math.max(pad, rect.left - menuWidth - margin)
  }
  menuPosition.value = clampPopoverBox(rect.top, left, menuWidth, menuHeight, pad)
}

function openMenu (attachmentId: number, anchor: HTMLElement) {
  if (openMenuId.value === attachmentId) {
    closeMenu()
    return
  }
  positionMenu(anchor)
  openMenuId.value = attachmentId
  nextTick(() => {
    if (openMenuId.value === attachmentId) {
      positionMenu(anchor)
    }
  })
}

function toggleMenu (attachmentId: number, event: MouseEvent) {
  event.stopPropagation()
  if (props.deletingId !== null || props.downloadingId !== null) {
    return
  }
  const el = event.currentTarget
  if (!(el instanceof HTMLElement)) return
  openMenu(attachmentId, el)
}

function onItemContextMenu (attachmentId: number, event: MouseEvent) {
  event.preventDefault()
  event.stopPropagation()
  if (props.deletingId !== null || props.downloadingId !== null) {
    return
  }
  const item = event.currentTarget
  if (!(item instanceof HTMLElement)) return
  const trigger = item.querySelector('.attachments-item__menu')
  if (!(trigger instanceof HTMLElement)) return
  openMenu(attachmentId, trigger)
}

function onMenuSelect (item: FloatingMenuItem) {
  const attachmentId = openMenuId.value
  closeMenu()
  if (item.key === 'delete' && attachmentId !== null) {
    emit('delete', attachmentId)
  }
}

function onMenuEscape (event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  if (openMenuId.value === null) return
  event.stopPropagation()
  closeMenu()
}

watch(
  () => props.collapsed,
  (collapsed) => {
    if (collapsed) closeMenu()
  },
)

watch(
  () => openMenuId.value !== null,
  (open) => {
    if (open) {
      document.addEventListener('keydown', onMenuEscape)
      const onResize = () => closeMenu()
      window.addEventListener('resize', onResize)
      removeMenuResizeListener = () => window.removeEventListener('resize', onResize)
      return
    }
    removeMenuResizeListener?.()
    removeMenuResizeListener = null
    document.removeEventListener('keydown', onMenuEscape)
  },
)

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onMenuEscape)
  removeMenuResizeListener?.()
  removeMenuResizeListener = null
  closeMenu()
})

defineExpose({
  closeMenu,
  isMenuOpen: computed(() => openMenuId.value !== null),
})
</script>

<style lang="scss" scoped src="~/assets/styles/components/task/TaskDetailAttachmentsBlock.scss"></style>
