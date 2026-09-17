<template>
  <div class="label-category-panel">
    <p v-if="message" class="settings-msg">
      {{ message }}
    </p>
    <p v-if="!loading && !categories.length" class="label-category-panel__empty">
      <template v-if="canManage">
        まだカテゴリがありません。「カテゴリ追加」から追加してください。
      </template>
      <template v-else>
        まだカテゴリがありません。
      </template>
    </p>
    <draggable
      v-model="categories"
      item-key="id"
      class="label-category-list"
      handle=".label-category-row__drag-handle"
      :animation="150"
      :disabled="!canManage || loading || reordering"
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
              :class="{ 'settings-drag-handle--readonly': !canManage }"
              :aria-hidden="!canManage"
              :tabindex="canManage ? 0 : -1"
              :aria-label="canManage ? 'ドラッグしてカテゴリの並び順を変更' : undefined"
              @click.prevent
            >
              <Equal :size="24" :stroke-width="2.25" aria-hidden="true" />
            </button>
            <span class="label-category-row__name">{{ category.name }}</span>
            <div v-if="canManage" class="label-category-row__actions">
              <button type="button" class="label-action-btn label-action-btn--edit" @click="openEditCategory(category)">
                編集
              </button>
              <button type="button" class="label-action-btn label-action-btn--delete" @click="openDeleteCategory(category)">
                削除
              </button>
              <button type="button" class="label-action-btn label-action-btn--primary" @click="openAddLabel(category)">
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
            :disabled="!canManage || loading || reordering"
            ghost-class="label-settings-row--ghost"
            chosen-class="label-settings-row--chosen"
            @change="onLabelListChange(category.id, $event)"
          >
            <template #item="{ element: label }">
              <div class="label-row">
                <button
                  type="button"
                  class="label-row__drag-handle"
                  :class="{ 'settings-drag-handle--readonly': !canManage }"
                  :aria-hidden="!canManage"
                  :tabindex="canManage ? 0 : -1"
                  :aria-label="canManage ? 'ドラッグしてラベルの並び順を変更' : undefined"
                  @click.prevent
                >
                  <Equal :size="24" :stroke-width="2.25" aria-hidden="true" />
                </button>
                <span class="label-row__dot" :style="{ backgroundColor: label.color }" aria-hidden="true" />
                <span class="label-row__name">{{ label.name }}</span>
                <div v-if="canManage" class="label-row__actions">
                  <button type="button" class="label-action-btn label-action-btn--edit" @click="openEditLabel(label)">
                    編集
                  </button>
                  <button type="button" class="label-action-btn label-action-btn--delete" @click="openDeleteLabel(label)">
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
      ref="categoryModalRef"
      v-model="categoryModalOpen"
      :title="categoryModalMode === 'add' ? 'カテゴリの追加' : 'カテゴリの編集'"
      :submit-label="categoryModalMode === 'add' ? '追加' : '保存'"
      :initial-name="editingCategoryName"
      :loading="loading"
      @submit="submitCategory"
    />
    <LabelAddModal
      ref="labelAddModalRef"
      v-model="labelAddModalOpen"
      :title="labelAddTitle"
      :loading="loading"
      @submit="addLabel"
    />
    <LabelEditModal
      ref="labelEditModalRef"
      v-model="labelEditModalOpen"
      title="ラベルの編集"
      :initial-name="editingLabel?.name ?? ''"
      :initial-color-index="editingLabel?.color_index"
      :loading="loading"
      @submit="updateLabel"
    />
    <LabelDeleteModal
      ref="labelDeleteModalRef"
      v-model="labelDeleteModalOpen"
      :label-name="labelDeleteTarget?.name ?? ''"
      :loading="labelDeletePending"
      @confirm="confirmDeleteLabel"
    />
    <LabelCategoryDeleteModal
      ref="categoryDeleteModalRef"
      v-model="categoryDeleteModalOpen"
      :category-name="categoryDeleteTarget?.name ?? ''"
      :loading="categoryDeletePending"
      @confirm="confirmDeleteCategory"
    />
  </div>
</template>
<script setup lang="ts">
import draggable from 'vuedraggable'
import { Equal } from 'lucide-vue-next'
import { TagPlus } from '../icons/TagPlusIcon'
import { useApi } from '../../composables/useApi'
import LabelCategoryNameModal from '../modals/LabelCategoryNameModal.vue'
import LabelAddModal from '../modals/LabelAddModal.vue'
import LabelEditModal from '../modals/LabelEditModal.vue'
import LabelDeleteModal from '../modals/LabelDeleteModal.vue'
import LabelCategoryDeleteModal from '../modals/LabelCategoryDeleteModal.vue'
import type { SettingsLabelCategory, SettingsLabelItem, SettingsLabelTabKey } from './types'
import { normalizeSettingsLabelCategories } from './labelCategoryNormalize'
import { resolveLabelColors, withResolvedLabelColor } from '../../utils/colorPresetResolution'
import { useOrgSettingsPageData } from '../../composables/useOrgSettingsPageData'
import { invalidateOrgDerivedCachesForLabelKind } from '../../composables/invalidateOrgDerivedCaches'
const props = defineProps<{
  orgSlug: string
  labelKind: SettingsLabelTabKey
  canManage: boolean
}>()
const { api } = useApi()
const { getCachedLabelCategories, patchLabelCategoriesCache } = useOrgSettingsPageData()
const categories = ref<SettingsLabelCategory[]>(
  getCachedLabelCategories(props.orgSlug, props.labelKind) ?? [],
)
const loading = ref(false)
const reordering = ref(false)
const message = ref('')
const messageKind = ref<'ok' | 'err'>('ok')
const categoryModalOpen = ref(false)
const categoryModalRef = ref<{ setSubmitError: (message: string) => void } | null>(null)
const categoryModalMode = ref<'add' | 'edit'>('add')
const editingCategoryId = ref<number | null>(null)
const editingCategoryName = ref('')
const labelAddModalOpen = ref(false)
const labelAddModalRef = ref<{ setSubmitError: (message: string) => void } | null>(null)
const labelAddCategoryId = ref<number | null>(null)
const labelEditModalOpen = ref(false)
const labelEditModalRef = ref<{ setSubmitError: (message: string) => void } | null>(null)
const editingLabel = ref<SettingsLabelItem | null>(null)
const labelDeleteModalOpen = ref(false)
const labelDeleteModalRef = ref<{ setSubmitError: (message: string) => void } | null>(null)
const labelDeleteTarget = ref<SettingsLabelItem | null>(null)
const labelDeletePending = ref(false)
const categoryDeleteModalOpen = ref(false)
const categoryDeleteModalRef = ref<{ setSubmitError: (message: string) => void } | null>(null)
const categoryDeleteTarget = ref<SettingsLabelCategory | null>(null)
const categoryDeletePending = ref(false)
const categoryApiBase = computed(() => {
  return props.labelKind === 'workspace' ? 'workspace-label-categories' : 'task-label-categories'
})
const labelApiBase = computed(() => {
  return props.labelKind === 'workspace' ? 'workspace-labels' : 'task-labels'
})
const labelAddTitle = computed(() => {
  return props.labelKind === 'workspace' ? 'ラベル（スペース）の追加' : 'ラベル（タスク）の追加'
})
function setMessage (msg: string, kind: 'ok' | 'err') {
  message.value = msg
  messageKind.value = kind
}
function applyCategories (next: SettingsLabelCategory[], opts?: { invalidateConsumers?: boolean }) {
  categories.value = next
  patchLabelCategoriesCache(props.orgSlug, props.labelKind, next)
  if (opts?.invalidateConsumers) {
    // 設定画面のラベル変更を他画面の派生キャッシュに残さない
    invalidateOrgDerivedCachesForLabelKind(props.orgSlug, props.labelKind)
  }
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
    invalidateOrgDerivedCachesForLabelKind(props.orgSlug, props.labelKind)
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
    invalidateOrgDerivedCachesForLabelKind(props.orgSlug, props.labelKind)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'ラベルの並び替えに失敗しました'
    setMessage(msg, 'err')
    await load({ refresh: true })
  } finally {
    reordering.value = false
  }
}
function onCategoryDragEnd (evt: LabelDragEndEvent) {
  if (!props.canManage) return
  if (evt.oldIndex === undefined || evt.newIndex === undefined || evt.oldIndex === evt.newIndex) {
    return
  }
  void persistCategoryOrder()
}
function onLabelListChange (categoryId: number, evt: LabelListChangeEvent) {
  if (!props.canManage) return
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
    applyCategories(normalizeSettingsLabelCategories(res.data), {
      invalidateConsumers: Boolean(opts?.refresh),
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'カテゴリの取得に失敗しました'
    setMessage(msg, 'err')
  } finally {
    loading.value = false
  }
}
function openAddCategory () {
  categoryModalMode.value = 'add'
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
    if (categoryModalMode.value === 'add') {
      await api(`/orgs/${props.orgSlug}/${categoryApiBase.value}`, {
        method: 'POST',
        body: { name },
      })
    } else if (editingCategoryId.value !== null) {
      await api(`/orgs/${props.orgSlug}/${categoryApiBase.value}/${editingCategoryId.value}`, {
        method: 'PATCH',
        body: { name },
      })
    }
    categoryModalOpen.value = false
    await load({ refresh: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'カテゴリの保存に失敗しました'
    setMessage(msg, 'err')
    categoryModalRef.value?.setSubmitError(msg)
  } finally {
    loading.value = false
  }
}
function openDeleteCategory (category: SettingsLabelCategory) {
  categoryDeleteTarget.value = category
  categoryDeleteModalOpen.value = true
}
async function confirmDeleteCategory () {
  const category = categoryDeleteTarget.value
  if (!category || categoryDeletePending.value) return
  categoryDeletePending.value = true
  setMessage('', 'ok')
  try {
    await api(`/orgs/${props.orgSlug}/${categoryApiBase.value}/${category.id}`, {
      method: 'DELETE',
    })
    categoryDeleteModalOpen.value = false
    categoryDeleteTarget.value = null
    await load({ refresh: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'カテゴリの削除に失敗しました'
    setMessage(msg, 'err')
    categoryDeleteModalRef.value?.setSubmitError(msg)
  } finally {
    categoryDeletePending.value = false
  }
}
function openAddLabel (category: SettingsLabelCategory) {
  labelAddCategoryId.value = category.id
  labelAddModalOpen.value = true
}
async function addLabel (payload: { name: string; color_index: number }) {
  if (labelAddCategoryId.value === null) return
  loading.value = true
  setMessage('', 'ok')
  try {
    await api(`/orgs/${props.orgSlug}/${labelApiBase.value}`, {
      method: 'POST',
      body: {
        category_id: labelAddCategoryId.value,
        name: payload.name,
        color_index: payload.color_index,
      },
    })
    labelAddModalOpen.value = false
    await load({ refresh: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'ラベルの追加に失敗しました'
    setMessage(msg, 'err')
    labelAddModalRef.value?.setSubmitError(msg)
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
    await load({ refresh: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'ラベルの更新に失敗しました'
    setMessage(msg, 'err')
    labelEditModalRef.value?.setSubmitError(msg)
  } finally {
    loading.value = false
  }
}
function openDeleteLabel (label: SettingsLabelItem) {
  labelDeleteTarget.value = label
  labelDeleteModalOpen.value = true
}
async function confirmDeleteLabel () {
  const label = labelDeleteTarget.value
  if (!label || labelDeletePending.value) return
  labelDeletePending.value = true
  setMessage('', 'ok')
  try {
    await api(`/orgs/${props.orgSlug}/${labelApiBase.value}/${label.id}`, {
      method: 'DELETE',
    })
    labelDeleteModalOpen.value = false
    labelDeleteTarget.value = null
    await load({ refresh: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'ラベルの削除に失敗しました'
    setMessage(msg, 'err')
    labelDeleteModalRef.value?.setSubmitError(msg)
  } finally {
    labelDeletePending.value = false
  }
}
onMounted(() => {
  void load()
})
defineExpose({ load, openAddCategory })
</script>
<style lang="scss" src="~/assets/styles/components/settings/SettingsLabelCategoryPanel.global.scss"></style>
<style lang="scss" scoped src="~/assets/styles/components/settings/SettingsLabelCategoryPanel.scss"></style>
