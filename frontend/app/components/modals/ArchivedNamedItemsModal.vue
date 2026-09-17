<template>
  <Teleport
    v-if="isPopover"
    to="body"
  >
    <Transition
      name="popover-fade"
      @after-leave="onAfterLeave"
    >
      <PopoverShell
        v-if="modelValue"
        ref="shellRef"
        :title="`アーカイブ済み${itemKind}`"
        :aria-label="`アーカイブ済み${itemKind}`"
        shell-class="popover archived-list-popover archived-list-popover--documents"
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
            <div
              v-if="loading && items === null"
              class="archived-list-popover__loading"
              aria-busy="true"
              aria-label="読み込み中"
            >
              <div class="spinner" />
            </div>
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
                      class="archived-list-popover__document-icon"
                      aria-hidden="true"
                    >
                      <FileText
                        :size="17"
                        :stroke-width="2"
                      />
                    </span>
                    <span class="archived-list-popover__document-body">
                      <span class="archived-list-popover__document-name">{{ item.name }}</span>
                      <span
                        v-if="documentDescription(item)"
                        class="archived-list-popover__document-desc"
                      >{{ documentDescription(item) }}</span>
                      <span
                        v-if="documentCategoryLabel(item)"
                        class="archived-list-popover__document-category"
                      >
                        <LabelStrip
                          :label="documentCategoryLabel(item)!"
                          :text-color="documentCategoryTextColor(item)"
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

  <BaseModal
    v-else
    :model-value="modelValue"
    :title="`アーカイブ済み${itemKind}`"
    :aria-label="`アーカイブ済み${itemKind}`"
    width="min(672px, 100%)"
    fixed-max-height
    :close-disabled="pendingId !== null"
    :confirm-on-ctrl-enter="false"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="archived-list-modal__body">
      <p
        v-if="error"
        class="archived-list-modal__err"
      >{{ error }}</p>
      <div
        v-if="loading && items === null"
        class="archived-list-modal__loading"
        aria-busy="true"
        aria-label="読み込み中"
      >
        <div class="spinner" />
      </div>
      <div
        v-else-if="items !== null"
        :class="[
          'archived-list-modal__content',
          { 'archived-list-modal__content--fade-in': contentShouldFadeIn },
        ]"
      >
        <section
          v-if="!items.length"
          class="archived-list-modal__empty"
        >
          <p>アーカイブ済みの{{ itemKind }}はありません。</p>
        </section>
        <ul
          v-else
          class="archived-list-modal__list"
        >
          <li
            v-for="item in items"
            :key="item.id"
            class="archived-list-modal__item"
          >
            <div class="archived-list-modal__card">
              <div class="archived-list-modal__card-body">
                <p class="archived-list-modal__name">{{ item.name }}</p>
                <p
                  v-if="item.description"
                  class="archived-list-modal__description"
                >{{ item.description }}</p>
              </div>
            </div>
            <footer
              v-if="canManageArchive"
              class="archived-list-modal__actions"
            >
              <button
                type="button"
                class="archived-list-modal__action"
                :disabled="pendingId === item.id"
                @click="restoreTarget = item"
              >
                復元
              </button>
              <button
                type="button"
                class="archived-list-modal__action archived-list-modal__action--danger"
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
  </BaseModal>
</template>

<script setup lang="ts">
import { FileText } from 'lucide-vue-next'
import { useApi } from '../../composables/useApi'
import { useArchivedListPopoverLayout } from '../../composables/useArchivedListPopoverLayout'
import {
  useArchivedNamedItemsCache,
  type ArchivedNamedItem,
} from '../../composables/useArchivedNamedItemsCache'
import {
  standardColorEmphasisText,
  standardColorSurfaceBackground,
} from '../../constants/colorPresets'
import { resolveStandardColors } from '../../utils/colorPresetResolution'
import { buildDestructiveConfirmMessage } from '../../utils/destructiveConfirmMessage'
import LabelStrip from '../ui/LabelStrip.vue'
import PopoverShell from '../ui/PopoverShell.vue'
import BaseModal from './BaseModal.vue'
import ConfirmModal from './ConfirmModal.vue'

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

const isPopover = computed(() => props.resource === 'documents')
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
  isPopover.value && props.modelValue && !isConfirmOpen.value
))

const {
  style: popoverStyle,
  close: closePopover,
  onAfterLeave,
  positionPopover,
} = useArchivedListPopoverLayout({
  isOpen: () => isPopover.value && props.modelValue,
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

function documentDescription (item: ArchivedNamedItem): string | null {
  const text = item.description?.trim()
  return text || null
}

function documentCategoryLabel (item: ArchivedNamedItem) {
  const category = item.category
  if (!category?.name?.trim()) {
    return null
  }
  const resolved = resolveStandardColors([category])[0] ?? category
  if (!resolved.color) {
    return null
  }
  return {
    name: resolved.name ?? category.name,
    color: standardColorSurfaceBackground(resolved.color),
  }
}

function documentCategoryTextColor (item: ArchivedNamedItem): string | undefined {
  const category = item.category
  if (!category?.name?.trim()) {
    return undefined
  }
  const resolved = resolveStandardColors([category])[0] ?? category
  if (!resolved.color) {
    return undefined
  }
  return standardColorEmphasisText(resolved.color)
}

async function load () {
  error.value = null
  const cached = getCached(cacheInput())
  if (cached) {
    items.value = cached
    loading.value = false
    contentShouldFadeIn.value = false
    if (isPopover.value && props.modelValue) {
      nextTick(() => {
        positionPopover()
        requestAnimationFrame(() => positionPopover())
      })
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
    if (isPopover.value && props.modelValue) {
      nextTick(() => {
        positionPopover()
        requestAnimationFrame(() => positionPopover())
      })
    }
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

<style lang="scss" scoped src="~/assets/styles/components/modals/archived-list-modal.scss"></style>
<style lang="scss" scoped src="~/assets/styles/components/modals/archived-list-popover.scss"></style>
