<template>
  <Teleport to="body">
    <Transition
      name="popover-fade"
      @after-leave="onAfterLeave"
    >
      <PopoverShell
        v-if="modelValue"
        ref="shellRef"
        :title="`アーカイブ済み${itemKind}`"
        :aria-label="`アーカイブ済み${itemKind}`"
        :shell-class="shellClass"
        :style="popoverStyle"
        :close-disabled="pendingId !== null || isConfirmOpen"
        :inert="isConfirmOpen"
        @close="closePopover"
      >
        <div class="popover-scroll archived-list-popover__scroll">
          <div class="archived-list-popover__body">
            <p
              v-if="error"
              class="archived-list-popover__err"
            >{{ error }}</p>
            <section
              v-if="loading && items === null"
              class="archived-list-popover__empty archived-list-popover__loading"
              aria-busy="true"
              aria-label="読み込み中"
            >
              <p aria-hidden="true">アーカイブ済みの{{ itemKind }}はありません。</p>
              <div class="spinner" />
            </section>
            <div
              v-else-if="items !== null"
              :class="[
                'archived-list-popover__content',
                { 'archived-list-popover__content--fade-in': contentShouldFadeIn },
              ]"
            >
              <section
                v-if="!items.length"
                class="archived-list-popover__empty"
              >
                <p>アーカイブ済みの{{ itemKind }}はありません。</p>
              </section>
              <ul
                v-else
                class="archived-list-popover__list"
              >
                <li
                  v-for="item in items"
                  :key="item.id"
                  class="archived-list-popover__item"
                >
                  <div class="archived-list-popover__document-card">
                    <span
                      v-if="resource === 'documents'"
                      class="archived-list-popover__document-icon"
                      aria-hidden="true"
                    >
                      <FileText
                        :size="17"
                        :stroke-width="2"
                      />
                    </span>
                    <span class="archived-list-popover__document-body">
                      <OverflowFlexRow
                        v-if="resource === 'workspaces' && workspaceLabels(item).length"
                        class="archived-list-popover__workspace-labels"
                        :watch-key="workspaceLabels(item).map(label => label.id).join(',')"
                      >
                        <LabelStrip
                          v-for="label in workspaceLabels(item)"
                          :key="label.id"
                          :label="label"
                          size="md"
                        />
                      </OverflowFlexRow>
                      <span class="archived-list-popover__document-name">{{ item.name }}</span>
                      <span
                        v-if="itemDescription(item)"
                        class="archived-list-popover__document-desc"
                      >{{ itemDescription(item) }}</span>
                      <span
                        v-if="resource === 'documents' && documentCategoryLabel(item)"
                        class="archived-list-popover__document-category"
                      >
                        <LabelStrip
                          :label="documentCategoryLabel(item)!"
                          :text-color="documentCategoryTextColor(item)"
                          size="sm"
                        />
                      </span>
                      <span
                        v-if="resource === 'workspaces' && workspaceStatusName(item)"
                        class="archived-list-popover__document-category archived-list-popover__workspace-status"
                      >
                        <LabelStrip
                          :label="{
                            name: workspaceStatusName(item)!,
                            color: workspaceStatusLabel(item)?.color ?? '#e7fbf2',
                          }"
                          :text-color="workspaceStatusTextColor(item) ?? '#1f845a'"
                          size="sm"
                        />
                      </span>
                    </span>
                  </div>
                  <footer
                    v-if="canManageArchive"
                    class="archived-list-popover__actions"
                  >
                    <button
                      type="button"
                      class="archived-list-popover__action"
                      :disabled="pendingId === item.id"
                      @click="restoreTarget = item"
                    >
                      復元
                    </button>
                    <button
                      type="button"
                      class="archived-list-popover__action archived-list-popover__action--danger"
                      :disabled="pendingId === item.id"
                      @click="deleteTarget = item"
                    >
                      削除
                    </button>
                  </footer>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </PopoverShell>
    </Transition>
    <ConfirmModal
      v-model="restoreConfirmOpen"
      width="min(480px, 100%)"
      :title="`${itemKind}の復元`"
      :message="restoreConfirmMessage"
      confirm-text="復元"
      :loading="pendingId !== null"
      @confirm="confirmRestore"
    />
    <ConfirmModal
      v-model="deleteConfirmOpen"
      width="min(480px, 100%)"
      :title="`${itemKind}の削除`"
      :message="deleteConfirmMessage"
      confirm-text="削除"
      variant="danger"
      :loading="pendingId !== null"
      @confirm="confirmPermanentDelete"
    />
  </Teleport>
</template>

<script setup lang="ts">
import { FileText } from 'lucide-vue-next'
import { useApi } from '../../../composables/shared/useApi'
import { useArchivedListPopoverLayout } from '../../../composables/archived/useArchivedListPopoverLayout'
import {
  useArchivedNamedItemsCache,
  type ArchivedNamedItem,
} from '../../../composables/archived/useArchivedNamedItemsCache'
import {
  standardColorEmphasisText,
  standardColorSurfaceBackground,
} from '../../../constants/colorPresets'
import { resolveStandardColors } from '../../../utils/shared/colorPresetResolution'
import { buildDestructiveConfirmMessage } from '../../../utils/shared/destructiveConfirmMessage'
import LabelStrip from '../../ui/LabelStrip.vue'
import OverflowFlexRow from '../../ui/OverflowFlexRow.vue'
import PopoverShell from '../../ui/PopoverShell.vue'
import ConfirmModal from '../shared/ConfirmModal.vue'

export type { ArchivedNamedItem }

const props = withDefaults(defineProps<{
  modelValue: boolean
  orgSlug: string
  resource: 'workspaces' | 'documents'
  itemKind: 'スペース' | '資料'
  /** 資料のアーカイブ一覧はスペース配下 API を使う */
  workspaceId?: string | number | null
  canManageArchive?: boolean
}>(), {
  workspaceId: null,
  canManageArchive: false,
})
const emit = defineEmits<{
  'update:modelValue': [boolean]
  restored: [ArchivedNamedItem]
  deleted: [number]
}>()

const ARCHIVED_DOCUMENTS_POPOVER_WIDTH = 320

const { api } = useApi()
const {
  getCached,
  fetchList,
  removeCachedItem,
} = useArchivedNamedItemsCache()
const items = ref<ArchivedNamedItem[] | null>(null)
const error = ref<string | null>(null)
const loading = ref(false)
const contentShouldFadeIn = ref(false)
const pendingId = ref<number | null>(null)
const restoreTarget = ref<ArchivedNamedItem | null>(null)
const deleteTarget = ref<ArchivedNamedItem | null>(null)
const shellRef = ref<InstanceType<typeof PopoverShell> | null>(null)
let contentFadeInTimer: ReturnType<typeof setTimeout> | null = null

const shellClass = computed(() => (
  props.resource === 'documents'
    ? 'popover archived-list-popover archived-list-popover--documents'
    : 'popover archived-list-popover archived-list-popover--workspaces'
))
const restoreConfirmOpen = computed({
  get: () => restoreTarget.value !== null,
  set: (open: boolean) => {
    if (!open) restoreTarget.value = null
  },
})
const deleteConfirmOpen = computed({
  get: () => deleteTarget.value !== null,
  set: (open: boolean) => {
    if (!open) deleteTarget.value = null
  },
})
const isConfirmOpen = computed(() => (
  restoreTarget.value !== null || deleteTarget.value !== null
))
const deleteConfirmMessage = computed(() =>
  buildDestructiveConfirmMessage(props.itemKind, '削除', deleteTarget.value?.name),
)
const restoreConfirmMessage = computed(() =>
  buildDestructiveConfirmMessage(props.itemKind, '復元', restoreTarget.value?.name),
)
const isExclusiveOpen = computed(() => (
  props.modelValue && !isConfirmOpen.value
))

const {
  style: popoverStyle,
  close: closePopover,
  onAfterLeave,
  positionPopover,
} = useArchivedListPopoverLayout({
  isOpen: () => props.modelValue,
  isExclusiveOpen,
  baseWidth: ARCHIVED_DOCUMENTS_POPOVER_WIDTH,
  canClose: () => pendingId.value === null && !isConfirmOpen.value,
  onClose: () => emit('update:modelValue', false),
  rootRef: shellRef,
})

function cacheInput () {
  return {
    orgSlug: props.orgSlug,
    resource: props.resource,
    workspaceId: props.workspaceId,
  }
}

function clearContentFadeInTimer () {
  if (contentFadeInTimer === null) return
  clearTimeout(contentFadeInTimer)
  contentFadeInTimer = null
}

function triggerContentFadeIn () {
  clearContentFadeInTimer()
  contentShouldFadeIn.value = true
  contentFadeInTimer = setTimeout(() => {
    contentShouldFadeIn.value = false
    contentFadeInTimer = null
  }, 260)
}

function itemActionPath (itemId: number, action?: 'unarchive'): string {
  const base = `/orgs/${props.orgSlug}/${props.resource}/${itemId}`
  return action ? `${base}/${action}` : base
}

function itemDescription (item: ArchivedNamedItem): string | null {
  const firstLine = item.description?.split(/\r?\n/)[0]?.trim()
  return firstLine || null
}

function namedColorLabel (entry: { name?: string | null; color_index?: number; color?: string } | null | undefined) {
  const name = entry?.name?.trim()
  if (!name || !entry) {
    return null
  }
  const resolved = resolveStandardColors([{ ...entry, name }])[0]
  const color = resolved?.color ?? entry.color
  if (!color) {
    return null
  }
  return {
    name,
    color: standardColorSurfaceBackground(color),
  }
}

function namedColorText (entry: { name?: string | null; color_index?: number; color?: string } | null | undefined): string | undefined {
  if (!entry?.name?.trim()) {
    return undefined
  }
  const resolved = resolveStandardColors([entry])[0] ?? entry
  if (!resolved.color) {
    return undefined
  }
  return standardColorEmphasisText(resolved.color)
}

function documentCategoryLabel (item: ArchivedNamedItem) {
  return namedColorLabel(item.category)
}

function documentCategoryTextColor (item: ArchivedNamedItem): string | undefined {
  return namedColorText(item.category)
}

function workspaceLabels (item: ArchivedNamedItem) {
  return (item.labels ?? []).flatMap(label => {
    const name = label.name?.trim()
    if (!name) return []
    return [{
      id: label.id,
      name,
      color: label.color || '#ccc',
    }]
  })
}

function workspaceStatusName (item: ArchivedNamedItem): string | null {
  const name = item.status?.name?.trim()
  return name || null
}

function workspaceStatusLabel (item: ArchivedNamedItem) {
  return namedColorLabel(item.status)
}

function workspaceStatusTextColor (item: ArchivedNamedItem): string | undefined {
  return namedColorText(item.status)
}

async function load () {
  error.value = null
  const cached = getCached(cacheInput())
  if (cached) {
    items.value = cached
    loading.value = false
    contentShouldFadeIn.value = false
    if (props.modelValue) {
      nextTick(() => {
        positionPopover()
        requestAnimationFrame(() => positionPopover())
      })
    }
    if (props.resource === 'workspaces') {
      void revalidateCachedList()
    }
    return
  }

  loading.value = true
  contentShouldFadeIn.value = false
  items.value = null
  try {
    items.value = await fetchList(cacheInput())
    triggerContentFadeIn()
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : '読み込みに失敗しました'
  } finally {
    loading.value = false
    if (props.modelValue) {
      nextTick(() => {
        positionPopover()
        requestAnimationFrame(() => positionPopover())
      })
    }
  }
}

async function revalidateCachedList () {
  try {
    const fresh = await fetchList(cacheInput(), { refresh: true })
    if (!props.modelValue) return
    items.value = fresh
    nextTick(() => {
      positionPopover()
    })
  } catch {
    // 表示中の一覧はキャッシュのまま残す
  }
}

async function confirmRestore () {
  const target = restoreTarget.value
  if (!target) return
  restoreTarget.value = null
  pendingId.value = target.id
  error.value = null
  try {
    const restored = await api<ArchivedNamedItem>(
      itemActionPath(target.id, 'unarchive'),
      { method: 'POST' },
    )
    removeCachedItem(cacheInput(), target.id)
    items.value = (items.value ?? []).filter(item => item.id !== target.id)
    emit('restored', restored)
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : '復元に失敗しました'
  } finally {
    pendingId.value = null
  }
}

async function confirmPermanentDelete () {
  const target = deleteTarget.value
  if (!target) return
  pendingId.value = target.id
  error.value = null
  try {
    await api(itemActionPath(target.id), {
      method: 'DELETE',
    })
    deleteTarget.value = null
    removeCachedItem(cacheInput(), target.id)
    items.value = (items.value ?? []).filter(item => item.id !== target.id)
    emit('deleted', target.id)
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : '削除に失敗しました'
  } finally {
    pendingId.value = null
  }
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      void load()
      return
    }
    clearContentFadeInTimer()
    contentShouldFadeIn.value = false
    error.value = null
    restoreTarget.value = null
    deleteTarget.value = null
  },
)

onBeforeUnmount(() => {
  clearContentFadeInTimer()
})
</script>

<style lang="scss" scoped src="~/assets/styles/components/modals/archived/archived-list-popover.scss"></style>
