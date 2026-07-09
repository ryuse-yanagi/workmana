<template>
  <div class="label-category-panel">
    <div class="label-category-panel__toolbar">
      <button
        type="button"
        class="label-category-panel__add-category-btn"
        :disabled="loading"
        @click="openCreateCategory"
      >
        <ListTree :size="20" :stroke-width="2.1" aria-hidden="true" />
        カテゴリ追加
      </button>
    </div>
    <p v-if="message" class="settings-msg" :class="{ 'settings-msg--err': messageKind === 'err' }">
      {{ message }}
    </p>
    <p v-if="!loading && !categories.length" class="label-category-panel__empty">
      まだカテゴリがありません。「カテゴリ追加」から作成してください。
    </p>
    <draggable
      v-model="categories"
      item-key="id"
      class="label-category-list"
      handle=".label-category-row__drag-handle"
      :animation="150"
      :disabled="loading || reordering"
      ghost-class="label-settings-row--ghost"
      chosen-class="label-settings-row--chosen"
      @end="onCategoryDragEnd"
    >
      <template #item="{ element: category, index: categoryIndex }">
        <div class="label-category-block">
          <div class="label-category-row">
            <button
              type="button"
              class="label-category-row__drag-handle"
              aria-label="ドラッグしてカテゴリの並び順を変更"
              @click.prevent
            >
              <Equal :size="24" :stroke-width="2.25" aria-hidden="true" />
            </button>
            <span class="label-category-row__name">{{ category.name }}</span>
            <div class="label-category-row__actions">
              <button type="button" class="label-action-btn label-action-btn--edit" @click="openEditCategory(category)">
                編集
              </button>
              <button type="button" class="label-action-btn label-action-btn--delete" @click="deleteCategory(category)">
                削除
              </button>
              <button type="button" class="label-action-btn label-action-btn--primary" @click="openCreateLabel(category)">
                <TagPlus :size="16" :stroke-width="2.1" aria-hidden="true" />
                ラベル追加
              </button>
            </div>
          </div>
          <draggable
            v-if="categories[categoryIndex]"
            v-model="categories[categoryIndex]!.labels"
            item-key="id"
            class="label-row-list"
            handle=".label-row__drag-handle"
            :animation="150"
            :disabled="loading || reordering"
            ghost-class="label-settings-row--ghost"
            chosen-class="label-settings-row--chosen"
            @change="onLabelListChange(category.id, $event)"
          >
            <template #item="{ element: label }">
              <div class="label-row">
                <button
                  type="button"
                  class="label-row__drag-handle"
                  aria-label="ドラッグしてラベルの並び順を変更"
                  @click.prevent
                >
                  <Equal :size="24" :stroke-width="2.25" aria-hidden="true" />
                </button>
                <span class="label-row__dot" :style="{ backgroundColor: label.color }" aria-hidden="true" />
                <span class="label-row__name">{{ label.name }}</span>
                <div class="label-row__actions">
                  <button type="button" class="label-action-btn label-action-btn--edit" @click="openEditLabel(label)">
                    編集
                  </button>
                  <button type="button" class="label-action-btn label-action-btn--delete" @click="deleteLabel(label)">
                    削除
                  </button>
                </div>
              </div>
            </template>
          </draggable>
        </div>
      </template>
    </draggable>
    <LabelCategoryNameModal
      v-model="categoryModalOpen"
      :title="categoryModalMode === 'create' ? 'カテゴリの作成' : 'カテゴリの編集'"
      :submit-label="categoryModalMode === 'create' ? '作成' : '保存'"
      :initial-name="editingCategoryName"
      :loading="loading"
      @submit="submitCategory"
    />
    <LabelCreateModal
      v-model="labelCreateModalOpen"
      :title="labelCreateTitle"
      :loading="loading"
      @submit="createLabel"
    />
    <LabelEditModal
      v-model="labelEditModalOpen"
      title="ラベルの編集"
      :initial-name="editingLabel?.name ?? ''"
      :initial-color-index="editingLabel?.color_index"
      :loading="loading"
      @submit="updateLabel"
    />
  </div>
</template>
<script setup lang="ts">
import draggable from 'vuedraggable'
import { Equal, ListTree } from 'lucide-vue-next'
import { TagPlus } from '../icons/TagPlusIcon'
import { useApi } from '../../composables/useApi'
import LabelCategoryNameModal from '../modals/LabelCategoryNameModal.vue'
import LabelCreateModal from '../modals/LabelCreateModal.vue'
import LabelEditModal from '../modals/LabelEditModal.vue'
import type { SettingsLabelCategory, SettingsLabelItem, SettingsLabelTabKey } from './types'
import { normalizeSettingsLabelCategories } from './labelCategoryNormalize'
import { resolveLabelColors, withResolvedLabelColor } from '../../utils/colorPresetResolution'
import { useOrgSettingsPageData } from '../../composables/useOrgSettingsPageData'
const props = defineProps<{
  orgSlug: string
  labelKind: SettingsLabelTabKey
}>()
const { api } = useApi()
const { getCachedLabelCategories, patchLabelCategoriesCache } = useOrgSettingsPageData()
const categories = ref<SettingsLabelCategory[]>([])
const loading = ref(false)
const reordering = ref(false)
const message = ref('')
const messageKind = ref<'ok' | 'err'>('ok')
const categoryModalOpen = ref(false)
const categoryModalMode = ref<'create' | 'edit'>('create')
const editingCategoryId = ref<number | null>(null)
const editingCategoryName = ref('')
const labelCreateModalOpen = ref(false)
const labelCreateCategoryId = ref<number | null>(null)
const labelEditModalOpen = ref(false)
const editingLabel = ref<SettingsLabelItem | null>(null)
const categoryApiBase = computed(() => (
  props.labelKind === 'workspace' ? 'workspace-label-categories' : 'task-label-categories'
))
const labelApiBase = computed(() => (
  props.labelKind === 'workspace' ? 'workspace-labels' : 'task-labels'
))
const labelCreateTitle = computed(() => (
  props.labelKind === 'workspace' ? 'ラベル（スペース）の作成' : 'ラベル（タスク）の作成'
))
function setMessage (msg: string, kind: 'ok' | 'err') {
  message.value = msg
  messageKind.value = kind
}
function applyCategories (next: SettingsLabelCategory[]) {
  categories.value = next
  patchLabelCategoriesCache(props.orgSlug, props.labelKind, next)
}
type LabelDragEndEvent = {
  oldIndex?: number
  newIndex?: number
}
type LabelListChangeEvent = {
  moved?: {
    oldIndex: number
    newIndex: number
  }
}
function findCategoryById (categoryId: number): SettingsLabelCategory | undefined {
  return categories.value.find(category => category.id === categoryId)
}
async function persistCategoryOrder () {
  reordering.value = true
  setMessage('', 'ok')
  try {
    categories.value.forEach((category, index) => {
      category.sort_order = index
    })
    await api<{ data: { ok: boolean } }>(`/orgs/${props.orgSlug}/${categoryApiBase.value}/reorder`, {
      method: 'PATCH',
      body: { category_ids: categories.value.map(category => category.id) },
    })
    patchLabelCategoriesCache(props.orgSlug, props.labelKind, categories.value)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'カテゴリの並び替えに失敗しました'
    setMessage(msg, 'err')
    await load({ refresh: true })
  } finally {
    reordering.value = false
  }
}
async function persistLabelOrder (categoryId: number) {
  await nextTick()
  const category = findCategoryById(categoryId)
  if (!category) {
    return
  }
  reordering.value = true
  setMessage('', 'ok')
  try {
    category.labels.forEach((label, index) => {
      label.sort_order = index
    })
    await api<{ data: { ok: boolean } }>(`/orgs/${props.orgSlug}/${labelApiBase.value}/reorder`, {
      method: 'PATCH',
      body: {
        category_id: category.id,
        label_ids: category.labels.map(label => label.id),
      },
    })
    patchLabelCategoriesCache(props.orgSlug, props.labelKind, categories.value)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'ラベルの並び替えに失敗しました'
    setMessage(msg, 'err')
    await load({ refresh: true })
  } finally {
    reordering.value = false
  }
}
function onCategoryDragEnd (evt: LabelDragEndEvent) {
  if (evt.oldIndex === undefined || evt.newIndex === undefined || evt.oldIndex === evt.newIndex) {
    return
  }
  void persistCategoryOrder()
}
function onLabelListChange (categoryId: number, evt: LabelListChangeEvent) {
  const moved = evt.moved
  if (!moved || moved.oldIndex === moved.newIndex) {
    return
  }
  void persistLabelOrder(categoryId)
}
async function load (opts?: { refresh?: boolean }) {
  if (!opts?.refresh) {
    const cached = getCachedLabelCategories(props.orgSlug, props.labelKind)
    if (cached) {
      applyCategories(cached)
      return
    }
  }
  loading.value = true
  setMessage('', 'ok')
  try {
    const res = await api<{ data: SettingsLabelCategory[] }>(`/orgs/${props.orgSlug}/${categoryApiBase.value}`)
    applyCategories(normalizeSettingsLabelCategories(res.data))
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'カテゴリの取得に失敗しました'
    setMessage(msg, 'err')
  } finally {
    loading.value = false
  }
}
function openCreateCategory () {
  categoryModalMode.value = 'create'
  editingCategoryId.value = null
  editingCategoryName.value = ''
  categoryModalOpen.value = true
}
function openEditCategory (category: SettingsLabelCategory) {
  categoryModalMode.value = 'edit'
  editingCategoryId.value = category.id
  editingCategoryName.value = category.name
  categoryModalOpen.value = true
}
async function submitCategory (name: string) {
  loading.value = true
  setMessage('', 'ok')
  try {
    if (categoryModalMode.value === 'create') {
      await api(`/orgs/${props.orgSlug}/${categoryApiBase.value}`, {
        method: 'POST',
        body: { name },
      })
      setMessage('カテゴリを作成しました。', 'ok')
    } else if (editingCategoryId.value !== null) {
      await api(`/orgs/${props.orgSlug}/${categoryApiBase.value}/${editingCategoryId.value}`, {
        method: 'PATCH',
        body: { name },
      })
      setMessage('カテゴリを更新しました。', 'ok')
    }
    categoryModalOpen.value = false
    await load({ refresh: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'カテゴリの保存に失敗しました'
    setMessage(msg, 'err')
  } finally {
    loading.value = false
  }
}
async function deleteCategory (category: SettingsLabelCategory) {
  if (!import.meta.client) return
  const confirmed = window.confirm(`カテゴリ「${category.name}」を削除しますか？配下のラベルも削除されます。`)
  if (!confirmed) return
  loading.value = true
  setMessage('', 'ok')
  try {
    await api(`/orgs/${props.orgSlug}/${categoryApiBase.value}/${category.id}`, {
      method: 'DELETE',
    })
    setMessage('カテゴリを削除しました。', 'ok')
    await load({ refresh: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'カテゴリの削除に失敗しました'
    setMessage(msg, 'err')
  } finally {
    loading.value = false
  }
}
function openCreateLabel (category: SettingsLabelCategory) {
  labelCreateCategoryId.value = category.id
  labelCreateModalOpen.value = true
}
async function createLabel (payload: { name: string; color_index: number }) {
  if (labelCreateCategoryId.value === null) return
  loading.value = true
  setMessage('', 'ok')
  try {
    await api(`/orgs/${props.orgSlug}/${labelApiBase.value}`, {
      method: 'POST',
      body: {
        category_id: labelCreateCategoryId.value,
        name: payload.name,
        color_index: payload.color_index,
      },
    })
    labelCreateModalOpen.value = false
    setMessage('ラベルを作成しました。', 'ok')
    await load({ refresh: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'ラベルの作成に失敗しました'
    setMessage(msg, 'err')
  } finally {
    loading.value = false
  }
}
function openEditLabel (label: SettingsLabelItem) {
  editingLabel.value = label
  labelEditModalOpen.value = true
}
async function updateLabel (payload: { name: string; color_index: number }) {
  if (!editingLabel.value) return
  loading.value = true
  setMessage('', 'ok')
  try {
    const updated = await api<SettingsLabelItem>(`/orgs/${props.orgSlug}/${labelApiBase.value}/${editingLabel.value.id}`, {
      method: 'PATCH',
      body: payload,
    })
    withResolvedLabelColor(updated)
    labelEditModalOpen.value = false
    editingLabel.value = null
    setMessage('ラベルを更新しました。', 'ok')
    await load({ refresh: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'ラベルの更新に失敗しました'
    setMessage(msg, 'err')
  } finally {
    loading.value = false
  }
}
async function deleteLabel (label: SettingsLabelItem) {
  if (!import.meta.client) return
  const confirmed = window.confirm(`ラベル「${label.name}」を削除しますか？`)
  if (!confirmed) return
  loading.value = true
  setMessage('', 'ok')
  try {
    await api(`/orgs/${props.orgSlug}/${labelApiBase.value}/${label.id}`, {
      method: 'DELETE',
    })
    setMessage('ラベルを削除しました。', 'ok')
    await load({ refresh: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'ラベルの削除に失敗しました'
    setMessage(msg, 'err')
  } finally {
    loading.value = false
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
.label-category-panel__toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 11.9px;
}
.label-category-panel__add-category-btn {
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
.label-category-panel__add-category-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.label-category-panel__empty {
  margin: 0;
  color: #64748b;
  font-size: 12.6px;
}
.label-category-list {
  display: flex;
  flex-direction: column;
  gap: 10.5px;
}
.label-category-block {
  display: flex;
  flex-direction: column;
  gap: 6.3px;
}
.label-row-list {
  display: flex;
  flex-direction: column;
  gap: 6.3px;
}
.label-category-row,
.label-row {
  display: flex;
  align-items: center;
  gap: 7.7px;
  box-sizing: border-box;
  width: 100%;
  padding: 0 10.5px;
  border-radius: 10px;
}
.label-category-row {
  height: 40px;
  background: mixin.$gray;
}
.label-row {
  height: 54px;
  background: #f5f6fa;
}
.label-category-row__drag-handle,
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
  color: #a2abb6;
  cursor: pointer;
  touch-action: none;
}
.label-category-row__drag-handle {
  background: mixin.$gray;
}
.label-row__drag-handle {
  background: #f5f6fa;
}
.label-category-row__drag-handle:active,
.label-row__drag-handle:active {
  cursor: default;
}
.label-settings-row--ghost {
  opacity: 0.45;
}
.label-settings-row--chosen {
  opacity: 0.85;
}
.label-category-row__name,
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
.label-category-row__actions,
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
.label-action-btn--primary {
  width: 120px;
  height: 24px;
  gap: 4px;
  padding: 0 8px;
  font-size: 12px;
  line-height: 1;
  color: mixin.$white;
  background: mixin.$main-aqua;
  align-self: center;
}
.label-action-btn--primary :deep(svg) {
  display: block;
  flex-shrink: 0;
}
</style>
