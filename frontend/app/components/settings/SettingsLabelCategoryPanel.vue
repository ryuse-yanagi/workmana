<template>
  <div class="label-category-panel">
    <div class="label-category-panel__toolbar">
      <button
        type="button"
        class="label-category-panel__add-category-btn"
        :disabled="loading"
        @click="openCreateCategory"
      >
        <ListTree :size="18" :stroke-width="2.1" aria-hidden="true" />
        カテゴリ追加
      </button>
    </div>
    <p v-if="message" class="settings-msg" :class="{ 'settings-msg--err': messageKind === 'err' }">
      {{ message }}
    </p>
    <p v-if="!loading && !categories.length" class="label-category-panel__empty">
      まだカテゴリがありません。「カテゴリ追加」から作成してください。
    </p>
    <div v-for="category in categories" :key="category.id" class="label-category-block">
      <div class="label-category-row">
        <GripVertical class="label-category-row__drag" aria-hidden="true" />
        <span class="label-category-row__name">{{ category.name }}</span>
        <div class="label-category-row__actions">
          <button type="button" class="label-action-btn label-action-btn--edit" @click="openEditCategory(category)">
            編集
          </button>
          <button type="button" class="label-action-btn label-action-btn--delete" @click="deleteCategory(category)">
            削除
          </button>
          <button type="button" class="label-action-btn label-action-btn--primary" @click="openCreateLabel(category)">
            ラベル追加
          </button>
        </div>
      </div>
      <div
        v-for="label in category.labels"
        :key="label.id"
        class="label-row"
      >
        <GripVertical class="label-row__drag" aria-hidden="true" />
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
    </div>
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
import { GripVertical, ListTree } from 'lucide-vue-next'
import { useApi } from '../../composables/useApi'
import LabelCategoryNameModal from '../modals/LabelCategoryNameModal.vue'
import LabelCreateModal from '../modals/LabelCreateModal.vue'
import LabelEditModal from '../modals/LabelEditModal.vue'
import type { SettingsLabelCategory, SettingsLabelItem, SettingsLabelTabKey } from './types'
import { resolveLabelColors, withResolvedLabelColor } from '../../utils/colorPresetResolution'
const props = defineProps<{
  orgSlug: string
  labelKind: SettingsLabelTabKey
}>()
const { api } = useApi()
const categories = ref<SettingsLabelCategory[]>([])
const loading = ref(false)
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
  props.labelKind === 'workspace' ? 'ワークスペースラベルの作成' : 'タスクラベルの作成'
))
function setMessage (msg: string, kind: 'ok' | 'err') {
  message.value = msg
  messageKind.value = kind
}
function normalizeCategories (raw: SettingsLabelCategory[]): SettingsLabelCategory[] {
  return raw.map(category => ({
    ...category,
    labels: resolveLabelColors(category.labels),
  }))
}
async function load () {
  loading.value = true
  setMessage('', 'ok')
  try {
    const res = await api<{ data: SettingsLabelCategory[] }>(`/orgs/${props.orgSlug}/${categoryApiBase.value}`)
    categories.value = normalizeCategories(res.data)
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
    await load()
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
    await load()
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
    await load()
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
    await load()
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
    await load()
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
  margin-bottom: 0.85rem;
}
.label-category-panel__add-category-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  border: 1px solid transparent;
  border-radius: 999px;
  padding: 0.45rem 1.35rem;
  font-size: 0.88rem;
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
  font-size: 0.9rem;
}
.label-category-block {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  margin-bottom: 0.75rem;
}
.label-category-row,
.label-row {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  min-height: 44px;
  padding: 0.35rem 0.75rem;
  border-radius: 10px;
}
.label-category-row {
  background: mixin.$table-parent-bg;
}
.label-row {
  margin-left: 1.25rem;
  background: #fff;
  border: 1px solid #e2e8f0;
}
.label-category-row__drag,
.label-row__drag {
  flex-shrink: 0;
  width: 1rem;
  color: #94a3b8;
}
.label-category-row__name,
.label-row__name {
  flex: 1;
  min-width: 0;
  font-size: 0.875rem;
  font-weight: 700;
  color: #0f172a;
}
.label-row__dot {
  flex-shrink: 0;
  width: 0.85rem;
  height: 0.85rem;
  border-radius: 999px;
}
.label-category-row__actions,
.label-row__actions {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-shrink: 0;
}
.label-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  height: 28px;
  border: 1px solid #dbe3ee;
  border-radius: 999px;
  padding: 0;
  font-size: 0.875rem;
  font-weight: 600;
  background: #fff;
  cursor: pointer;
  white-space: nowrap;
}
.label-action-btn--edit,
.label-action-btn--delete {
  width: 68px;
}
.label-action-btn--edit {
  color: mixin.$main-aqua;
}
.label-action-btn--delete {
  color: mixin.$danger;
}
.label-action-btn--primary {
  width: 96px;
  border-color: transparent;
  color: mixin.$white;
  background: mixin.$main-aqua;
}
</style>
