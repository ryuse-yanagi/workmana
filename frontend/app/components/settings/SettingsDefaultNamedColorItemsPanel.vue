<template>
  <SettingsPanel :title="title" :note="note">
    <div class="named-color-items-panel">
      <div class="named-color-items-panel__toolbar">
        <button
          type="button"
          class="named-color-items-panel__add-btn"
          :disabled="loading || items.length >= 20"
          @click="openCreate"
        >
          <component :is="addButtonIcon" :size="20" :stroke-width="2.1" aria-hidden="true" />
          {{ addButtonLabel }}
        </button>
      </div>
      <p v-if="message" class="settings-msg" :class="{ 'settings-msg--err': messageKind === 'err' }">
        {{ message }}
      </p>
      <p v-if="!loading && !items.length" class="named-color-items-panel__empty">
        まだ{{ itemKind }}がありません。「{{ addButtonLabel }}」から作成してください。
      </p>
      <draggable
        v-model="items"
        item-key="_key"
        class="label-row-list"
        handle=".label-row__drag-handle"
        :animation="150"
        :disabled="loading || reordering"
        ghost-class="label-settings-row--ghost"
        chosen-class="label-settings-row--chosen"
        @end="onDragEnd"
      >
        <template #item="{ element: item, index }">
          <div class="label-row">
            <button
              type="button"
              class="label-row__drag-handle"
              :aria-label="`ドラッグして${itemKind}の並び順を変更`"
              @click.prevent
            >
              <Equal :size="24" :stroke-width="2.25" aria-hidden="true" />
            </button>
            <span
              class="label-row__dot"
              :style="{ backgroundColor: colorForItem(item) }"
              aria-hidden="true"
            />
            <span class="label-row__name">{{ item.name }}</span>
            <div class="label-row__actions">
              <button
                type="button"
                class="label-action-btn label-action-btn--edit"
                :disabled="loading"
                @click="openEdit(index)"
              >
                編集
              </button>
              <button
                type="button"
                class="label-action-btn label-action-btn--delete"
                :disabled="loading"
                @click="openDelete(index)"
              >
                削除
              </button>
            </div>
          </div>
        </template>
      </draggable>
    </div>
    <DefaultNamedColorItemEditModal
      v-model="editModalOpen"
      :mode="editModalMode"
      :name-label="`${itemKind}名`"
      :name-placeholder="`${itemKind}名を入力してください`"
      :create-title="createModalTitle"
      :edit-title="editModalTitle"
      :initial-values="editingItem"
      :loading="loading"
      @submit="submitEdit"
    />
    <DefaultNamedColorItemDeleteModal
      v-model="deleteModalOpen"
      :title="deleteModalTitle"
      :item-kind="itemKind"
      :item-name="deletingItemName"
      :loading="loading"
      @confirm="confirmDelete"
    />
  </SettingsPanel>
</template>
<script setup lang="ts">
import type { Component } from 'vue'
import draggable from 'vuedraggable'
import { Equal } from 'lucide-vue-next'
import { useApi } from '../../composables/useApi'
import DefaultNamedColorItemDeleteModal from '../modals/DefaultNamedColorItemDeleteModal.vue'
import DefaultNamedColorItemEditModal from '../modals/DefaultNamedColorItemEditModal.vue'
import SettingsPanel from './SettingsPanel.vue'
import {
  normalizeDefaultBoardListItems,
  normalizeDefaultDocumentCategoryItems,
  normalizeDefaultWorkspaceStatusItems,
  serializeDefaultBoardListItems,
  serializeDefaultDocumentCategoryItems,
  serializeDefaultWorkspaceStatusItems,
  type DefaultNamedColorItem,
  type OrgSettingsResponse,
} from './types'
import { standardColorAtIndex } from '../../constants/colorPresets'

type DraftItem = DefaultNamedColorItem & { _key: string }
type SettingsField = 'default_board_list_names' | 'default_workspace_status_names' | 'default_document_category_names'

const props = defineProps<{
  orgSlug: string
  initialItems: DefaultNamedColorItem[]
  title: string
  note: string
  settingsField: SettingsField
  defaultItems: DefaultNamedColorItem[]
  itemKind: string
  addButtonLabel: string
  addButtonIcon: Component
  createModalTitle: string
  editModalTitle: string
  deleteModalTitle: string
  saveSuccessMessage: string
  saveErrorMessage: string
}>()

const { api } = useApi()
let nextItemKey = 1
const items = ref<DraftItem[]>(attachKeys(props.initialItems))
const loading = ref(false)
const reordering = ref(false)
const message = ref('')
const messageKind = ref<'ok' | 'err'>('ok')
const editModalOpen = ref(false)
const editModalMode = ref<'create' | 'edit'>('create')
const editingIndex = ref<number | null>(null)
const editingItem = ref<{ name: string; color_index: number } | null>(null)
const deleteModalOpen = ref(false)
const deletingIndex = ref<number | null>(null)
const deletingItemName = computed(() => {
  if (deletingIndex.value === null) return ''
  return items.value[deletingIndex.value]?.name ?? ''
})

function attachKeys (source: DefaultNamedColorItem[]): DraftItem[] {
  return source.map(item => ({
    ...item,
    _key: `item-${nextItemKey++}`,
  }))
}

function cloneItems (source: DraftItem[]): DraftItem[] {
  return source.map(item => ({ ...item }))
}

function colorForItem (item: DefaultNamedColorItem): string {
  return standardColorAtIndex(item.color_index)
}

function setMessage (msg: string, kind: 'ok' | 'err') {
  message.value = msg
  messageKind.value = kind
}

function normalizeFromResponse (res: OrgSettingsResponse): DefaultNamedColorItem[] {
  if (props.settingsField === 'default_board_list_names') {
    return normalizeDefaultBoardListItems(res.default_board_list_names)
  }
  if (props.settingsField === 'default_document_category_names') {
    return normalizeDefaultDocumentCategoryItems(res.default_document_category_names)
  }
  return normalizeDefaultWorkspaceStatusItems(res.default_workspace_status_names)
}

function serializeItems (source: DraftItem[]): DefaultNamedColorItem[] {
  const plain = source.map(({ name, color_index }) => ({ name, color_index }))
  if (props.settingsField === 'default_board_list_names') {
    return serializeDefaultBoardListItems(plain)
  }
  if (props.settingsField === 'default_document_category_names') {
    return serializeDefaultDocumentCategoryItems(plain)
  }
  return serializeDefaultWorkspaceStatusItems(plain)
}

async function persistItems (successMessage?: string) {
  const payload = serializeItems(items.value)
  loading.value = true
  setMessage('', 'ok')
  try {
    const res = await api<OrgSettingsResponse>(`/orgs/${props.orgSlug}/settings`, {
      method: 'PATCH',
      body: { [props.settingsField]: payload },
    })
    const saved = attachKeys(normalizeFromResponse(res))
    items.value = saved
    if (successMessage) {
      setMessage(successMessage, 'ok')
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : props.saveErrorMessage
    setMessage(msg, 'err')
    await load()
    throw e
  } finally {
    loading.value = false
  }
}

async function load () {
  loading.value = true
  setMessage('', 'ok')
  try {
    const res = await api<OrgSettingsResponse>(`/orgs/${props.orgSlug}/settings`)
    items.value = attachKeys(normalizeFromResponse(res))
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : props.saveErrorMessage
    setMessage(msg, 'err')
  } finally {
    loading.value = false
  }
}

type DragEndEvent = {
  oldIndex?: number
  newIndex?: number
}

function onDragEnd (evt: DragEndEvent) {
  if (evt.oldIndex === undefined || evt.newIndex === undefined || evt.oldIndex === evt.newIndex) {
    return
  }
  reordering.value = true
  void persistItems()
    .catch(() => {})
    .finally(() => {
      reordering.value = false
    })
}

function openCreate () {
  if (items.value.length >= 20) return
  editModalMode.value = 'create'
  editingIndex.value = null
  const nextIndex = items.value.length
  const fallback = props.defaultItems[nextIndex]
  editingItem.value = {
    name: '',
    color_index: fallback?.color_index ?? (nextIndex % 10),
  }
  editModalOpen.value = true
}

function openEdit (index: number) {
  const item = items.value[index]
  if (!item) return
  editModalMode.value = 'edit'
  editingIndex.value = index
  editingItem.value = { name: item.name, color_index: item.color_index }
  editModalOpen.value = true
}

function openDelete (index: number) {
  deletingIndex.value = index
  deleteModalOpen.value = true
}

async function submitEdit (payload: { name: string; color_index: number }) {
  const draft = cloneItems(items.value)
  if (editModalMode.value === 'create') {
    draft.push({
      ...payload,
      _key: `item-${nextItemKey++}`,
    })
  } else if (editingIndex.value !== null) {
    const current = draft[editingIndex.value]
    if (!current) return
    draft[editingIndex.value] = {
      ...current,
      ...payload,
    }
  } else {
    return
  }

  items.value = draft
  loading.value = true
  try {
    await persistItems(props.saveSuccessMessage)
    editModalOpen.value = false
    editingIndex.value = null
    editingItem.value = null
  } catch {
    // persistItems already surfaced the error
  }
}

async function confirmDelete () {
  if (deletingIndex.value === null) return
  const draft = cloneItems(items.value)
  draft.splice(deletingIndex.value, 1)
  items.value = draft
  loading.value = true
  try {
    await persistItems(props.saveSuccessMessage)
    deleteModalOpen.value = false
    deletingIndex.value = null
  } catch {
    // persistItems already surfaced the error
  }
}

onMounted(() => {
  void load()
})

defineExpose({ load })
</script>
<style lang="scss">
@use './shared';
</style>
<style lang="scss" scoped>
.named-color-items-panel__toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 11.9px;
}
.named-color-items-panel__add-btn {
  display: inline-flex;
  align-items: center;
  gap: 5.6px;
  border: 1px solid transparent;
  border-radius: 999px;
  padding: 6.3px 18.9px;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: mixin.$white;
  background: mixin.$main-aqua;
  cursor: pointer;
}
.named-color-items-panel__add-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.named-color-items-panel__empty {
  margin: 0;
  color: #64748b;
  font-size: 12.6px;
}
.label-row-list {
  display: flex;
  flex-direction: column;
  gap: 6.3px;
}
.label-row {
  display: flex;
  align-items: center;
  gap: 7.7px;
  box-sizing: border-box;
  width: 100%;
  height: 54px;
  padding: 0 10.5px;
  border-radius: 10px;
  background: #f5f6fa;
}
.label-row__drag-handle {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  margin: 0;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: #f5f6fa;
  color: #a2abb6;
  cursor: pointer;
  touch-action: none;
}
.label-row__drag-handle:active {
  cursor: default;
}
.label-settings-row--ghost {
  opacity: 0.45;
}
.label-settings-row--chosen {
  opacity: 0.85;
}
.label-row__name {
  flex: 1;
  min-width: 0;
  font-size: 12.25px;
  font-weight: 700;
  color: #0f172a;
}
.label-row__dot {
  flex-shrink: 0;
  width: 11.9px;
  height: 11.9px;
  border-radius: 999px;
}
.label-row__actions {
  display: flex;
  align-items: center;
  gap: 4.9px;
  flex-shrink: 0;
}
.label-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  height: 24px;
  border: none;
  border-radius: 999px;
  padding: 0;
  font-size: 12.25px;
  font-weight: 600;
  background: #fff;
  cursor: pointer;
  white-space: nowrap;
}
.label-action-btn--edit,
.label-action-btn--delete {
  width: 64px;
}
.label-action-btn--edit {
  color: mixin.$main-aqua;
}
.label-action-btn--delete {
  color: mixin.$danger;
}
.label-action-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
</style>
