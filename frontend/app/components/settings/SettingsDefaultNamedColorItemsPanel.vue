<template>
  <SettingsPanel :title="title">
    <template v-if="canManage" #actions>
      <button
        type="button"
        class="settings-panel__action-btn"
        :disabled="loading || items.length >= 20"
        @click="openCreate"
      >
        <component :is="addButtonIcon" :size="20" :stroke-width="2.1" aria-hidden="true" />
        {{ addButtonLabel }}
      </button>
    </template>
    <div class="named-color-items-panel">
      <p v-if="message" class="settings-msg">
        {{ message }}
      </p>
      <p v-if="!loading && !items.length" class="named-color-items-panel__empty">
        <template v-if="canManage">
          まだ{{ itemKind }}がありません。「{{ addButtonLabel }}」から作成してください。
        </template>
        <template v-else>
          まだ{{ itemKind }}がありません。
        </template>
      </p>
      <draggable
        v-model="items"
        item-key="_key"
        class="label-row-list"
        handle=".label-row__drag-handle"
        :animation="150"
        :disabled="!canManage || loading || reordering"
        ghost-class="label-settings-row--ghost"
        chosen-class="label-settings-row--chosen"
        @end="onDragEnd"
      >
        <template #item="{ element: item, index }">
          <div class="label-row">
            <button
              v-if="canManage"
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
            <div v-if="canManage" class="label-row__actions">
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
      ref="editModalRef"
      v-model="editModalOpen"
      :mode="editModalMode"
      :name-label="`${itemKind}名`"
      :name-placeholder="`${itemKind}名を入力...`"
      :create-title="createModalTitle"
      :edit-title="editModalTitle"
      :initial-values="editingItem"
      :loading="loading"
      @submit="submitEdit"
    />
    <DefaultNamedColorItemDeleteModal
      ref="deleteModalRef"
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
import { useOrgSettingsPageData } from '../../composables/useOrgSettingsPageData'
import { useOrgSettingsResource } from '../../composables/useOrgSettingsResource'
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
  canManage: boolean
  title: string
  settingsField: SettingsField
  defaultItems: DefaultNamedColorItem[]
  itemKind: string
  addButtonLabel: string
  addButtonIcon: Component
  createModalTitle: string
  editModalTitle: string
  deleteModalTitle: string
  saveErrorMessage: string
}>()

const { api } = useApi()
const { patchOrgSettingsCache } = useOrgSettingsPageData()
const { fetchOrgSettings } = useOrgSettingsResource()
let nextItemKey = 1
const items = ref<DraftItem[]>(attachKeys(props.initialItems))
const loading = ref(false)
const reordering = ref(false)
const message = ref('')
const messageKind = ref<'ok' | 'err'>('ok')
const editModalOpen = ref(false)
const editModalRef = ref<{ setSubmitError: (message: string) => void } | null>(null)
const editModalMode = ref<'create' | 'edit'>('create')
const editingIndex = ref<number | null>(null)
const editingItem = ref<{ name: string; color_index: number } | null>(null)
const deleteModalOpen = ref(false)
const deleteModalRef = ref<{ setSubmitError: (message: string) => void } | null>(null)
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
  const plain = source.map(({ name, color_index }) => ({
    name,
    color_index,
  }))
  if (props.settingsField === 'default_board_list_names') {
    return serializeDefaultBoardListItems(plain)
  }
  if (props.settingsField === 'default_document_category_names') {
    return serializeDefaultDocumentCategoryItems(plain)
  }
  return serializeDefaultWorkspaceStatusItems(plain)
}

async function persistItems () {
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
    patchOrgSettingsCache(props.orgSlug, res)
    if (successMessage) {
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
    const res = await fetchOrgSettings(props.orgSlug, { refresh: true })
    items.value = attachKeys(normalizeFromResponse(res))
    patchOrgSettingsCache(props.orgSlug, res)
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
  if (!props.canManage) return
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
  if (!props.canManage) return
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
  if (!props.canManage) return
  const item = items.value[index]
  if (!item) return
  editModalMode.value = 'edit'
  editingIndex.value = index
  editingItem.value = {
    name: item.name,
    color_index: item.color_index,
  }
  editModalOpen.value = true
}

function openDelete (index: number) {
  if (!props.canManage) return
  deletingIndex.value = index
  deleteModalOpen.value = true
}

async function submitEdit (payload: {
  name: string
  color_index: number
}) {
  if (!props.canManage) return
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
    await persistItems()
    editModalOpen.value = false
    editingIndex.value = null
    editingItem.value = null
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : props.saveErrorMessage
    editModalRef.value?.setSubmitError(msg)
  }
}

async function confirmDelete () {
  if (!props.canManage) return
  if (deletingIndex.value === null) return
  const draft = cloneItems(items.value)
  draft.splice(deletingIndex.value, 1)
  items.value = draft
  loading.value = true
  try {
    await persistItems()
    deleteModalOpen.value = false
    deletingIndex.value = null
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : props.saveErrorMessage
    deleteModalRef.value?.setSubmitError(msg)
  }
}

defineExpose({ load })
</script>
<style lang="scss" src="~/assets/styles/components/settings/SettingsDefaultNamedColorItemsPanel.global.scss"></style>
<style lang="scss" scoped src="~/assets/styles/components/settings/SettingsDefaultNamedColorItemsPanel.scss"></style>
