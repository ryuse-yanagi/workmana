<template>
  <SettingsPanel :title="title">
    <template v-if="canManage" #actions>
      <button
        type="button"
        class="settings-panel__action-btn"
        :disabled="loading"
        @click="openAdd"
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
        {{ itemKind }}がありません
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
              type="button"
              class="label-row__drag-handle"
              :class="{ 'settings-drag-handle--readonly': !canManage }"
              :aria-hidden="!canManage"
              :tabindex="canManage ? 0 : -1"
              :aria-label="canManage ? `ドラッグして${itemKind}の並び順を変更` : undefined"
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
                v-if="canDeleteItems"
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
    <DefaultNamedColorItemFormModal
      ref="formModalRef"
      v-model="formModalOpen"
      :mode="formModalMode"
      :name-label="`${itemKind}名`"
      :name-placeholder="`${itemKind}名を入力...`"
      :name-max-length="nameMaxLength"
      :add-title="addModalTitle"
      :edit-title="editModalTitle"
      :initial-values="editingItem"
      :loading="loading"
      @submit="submitForm"
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
import { useApi } from '../../composables/shared/useApi'
import { useOrgSettingsPageData } from '../../composables/settings/useOrgSettingsPageData'
import { useOrgSettingsResource } from '../../composables/settings/useOrgSettingsResource'
import { invalidateOrgDerivedCaches } from '../../composables/settings/invalidateOrgDerivedCaches'
import DefaultNamedColorItemDeleteModal from '../modals/shared/DefaultNamedColorItemDeleteModal.vue'
import DefaultNamedColorItemFormModal from '../modals/shared/DefaultNamedColorItemFormModal.vue'
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
import {
  DOCUMENT_CATEGORY_NAME_MAX_LENGTH,
  LIST_NAME_MAX_LENGTH,
  WORKSPACE_STATUS_NAME_MAX_LENGTH,
} from '../../constants/fieldLengthLimits'

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
  addModalTitle: string
  editModalTitle: string
  deleteModalTitle: string
  saveErrorMessage: string
  minItems?: number
}>()

const { api } = useApi()
const { patchOrgSettingsCache } = useOrgSettingsPageData()
const { fetchOrgSettings } = useOrgSettingsResource()
let nextItemKey = 1
const items = ref<DraftItem[]>(attachKeys(props.initialItems))
const minItems = computed(() => props.minItems ?? 0)
const canDeleteItems = computed(() => items.value.length > minItems.value)
const loading = ref(false)
const reordering = ref(false)
const message = ref('')
const formModalOpen = ref(false)
const formModalRef = ref<{ setSubmitError: (message: string) => void } | null>(null)
const formModalMode = ref<'add' | 'edit'>('add')
const editingIndex = ref<number | null>(null)
const editingItem = ref<{ name: string; color_index: number } | null>(null)
const deleteModalOpen = ref(false)
const deleteModalRef = ref<{ setSubmitError: (message: string) => void } | null>(null)
const deletingIndex = ref<number | null>(null)
/** 一覧から楽観的に消しても【対象】が残るよう、開いた時点の名前を保持する */
const deletingItemName = ref('')

const nameMaxLength = computed(() => {
  if (props.settingsField === 'default_workspace_status_names') {
    return WORKSPACE_STATUS_NAME_MAX_LENGTH
  }
  if (props.settingsField === 'default_document_category_names') {
    return DOCUMENT_CATEGORY_NAME_MAX_LENGTH
  }
  return LIST_NAME_MAX_LENGTH
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

function clearMessage () {
  message.value = ''
}

function setErrorMessage (msg: string) {
  message.value = msg
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
  clearMessage()
  try {
    const res = await api<OrgSettingsResponse>(`/orgs/${props.orgSlug}/settings`, {
      method: 'PATCH',
      body: { [props.settingsField]: payload },
    })
    const saved = attachKeys(normalizeFromResponse(res))
    items.value = saved
    patchOrgSettingsCache(props.orgSlug, res)
    if (props.settingsField === 'default_workspace_status_names') {
      invalidateOrgDerivedCaches(props.orgSlug, {
        workspaceIndex: true,
        taskViews: false,
        documents: false,
        settingsResource: false,
      })
    } else if (props.settingsField === 'default_document_category_names') {
      invalidateOrgDerivedCaches(props.orgSlug, {
        workspaceIndex: true,
        taskViews: false,
        documents: true,
        settingsResource: false,
      })
    } else if (props.settingsField === 'default_board_list_names') {
      // 既存スペースのリストは変えないが、未取得ボードの誤用を避けるためビューキャッシュは破棄
      invalidateOrgDerivedCaches(props.orgSlug, {
        workspaceIndex: false,
        taskViews: true,
        documents: false,
        settingsResource: false,
      })
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : props.saveErrorMessage
    setErrorMessage(msg)
    await load()
    throw e
  } finally {
    loading.value = false
  }
}

async function load () {
  loading.value = true
  clearMessage()
  try {
    const res = await fetchOrgSettings(props.orgSlug, { refresh: true })
    items.value = attachKeys(normalizeFromResponse(res))
    patchOrgSettingsCache(props.orgSlug, res)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : props.saveErrorMessage
    setErrorMessage(msg)
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

function openAdd () {
  if (!props.canManage) return
  formModalMode.value = 'add'
  editingIndex.value = null
  const nextIndex = items.value.length
  const fallback = props.defaultItems[nextIndex]
  editingItem.value = {
    name: '',
    color_index: fallback?.color_index ?? (nextIndex % 10),
  }
  formModalOpen.value = true
}

function openEdit (index: number) {
  if (!props.canManage) return
  const item = items.value[index]
  if (!item) return
  formModalMode.value = 'edit'
  editingIndex.value = index
  editingItem.value = {
    name: item.name,
    color_index: item.color_index,
  }
  formModalOpen.value = true
}

function openDelete (index: number) {
  if (!props.canManage) return
  if (!canDeleteItems.value) return
  const item = items.value[index]
  if (!item) return
  deletingIndex.value = index
  deletingItemName.value = item.name
  deleteModalOpen.value = true
}

async function submitForm (payload: {
  name: string
  color_index: number
}) {
  if (!props.canManage) return
  const draft = cloneItems(items.value)
  if (formModalMode.value === 'add') {
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
    formModalOpen.value = false
    editingIndex.value = null
    editingItem.value = null
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : props.saveErrorMessage
    formModalRef.value?.setSubmitError(msg)
  }
}

async function confirmDelete () {
  if (!props.canManage) return
  if (!canDeleteItems.value) return
  if (deletingIndex.value === null) return
  const draft = cloneItems(items.value)
  draft.splice(deletingIndex.value, 1)
  items.value = draft
  loading.value = true
  try {
    await persistItems()
    deleteModalOpen.value = false
    deletingIndex.value = null
    deletingItemName.value = ''
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : props.saveErrorMessage
    deleteModalRef.value?.setSubmitError(msg)
  }
}

defineExpose({ load })
</script>
<style lang="scss" src="~/assets/styles/components/settings/SettingsDefaultNamedColorItemsPanel.global.scss"></style>
<style lang="scss" scoped src="~/assets/styles/components/settings/SettingsDefaultNamedColorItemsPanel.scss"></style>
