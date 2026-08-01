<template>
  <BaseModal
    :model-value="modelValue"
    :title="`アーカイブ済み${itemKind}一覧`"
    :aria-label="`アーカイブ済み${itemKind}一覧`"
    width="min(672px, 100%)"
    :close-disabled="pendingId !== null"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="archived-items-modal__body">
      <p class="archived-items-modal__subtitle">
        <template v-if="canManageArchive">
          アーカイブした{{ itemKind }}だけが表示されます。完全削除はこの画面からのみ行えます。
        </template>
        <template v-else>
          閲覧のみ / 復元・完全削除は管理者のみ
        </template>
      </p>
      <p v-if="error" class="archived-items-modal__err">{{ error }}</p>
      <div v-if="loading && items === null" class="archived-items-modal__state">
        読み込み中...
      </div>
      <section v-else-if="!items?.length" class="archived-items-modal__empty">
        <p>アーカイブ済みの{{ itemKind }}はありません。</p>
      </section>
      <ul v-else class="archived-items-modal__list">
        <li v-for="item in items" :key="item.id" class="archived-items-modal__item">
          <div class="archived-items-modal__item-content">
            <strong>{{ item.name }}</strong>
            <p v-if="item.description">{{ item.description }}</p>
          </div>
          <footer v-if="canManageArchive" class="archived-items-modal__actions">
            <button
              type="button"
              class="archived-items-modal__action"
              :disabled="pendingId === item.id"
              @click="restoreTarget = item"
            >
              復元
            </button>
            <span class="archived-items-modal__action-sep" aria-hidden="true">•</span>
            <button
              type="button"
              class="archived-items-modal__action archived-items-modal__action--danger"
              :disabled="pendingId === item.id"
              @click="deleteTarget = item"
            >
              削除
            </button>
          </footer>
        </li>
      </ul>
    </div>
    <ConfirmModal
      v-model="restoreConfirmOpen"
      :title="`${itemKind}の復元確認`"
      confirm-text="復元"
      :loading="pendingId !== null"
      @confirm="confirmRestore"
    />
    <ConfirmModal
      v-model="deleteConfirmOpen"
      :title="`${itemKind}の完全削除`"
      message="完全削除は取り消せません。"
      confirm-text="完全削除"
      variant="danger"
      :loading="pendingId !== null"
      @confirm="confirmPermanentDelete"
    />
  </BaseModal>
</template>

<script setup lang="ts">
import { useApi } from '../../composables/useApi'

export type ArchivedNamedItem = {
  id: number
  name: string
  description?: string | null
  archived_at?: string | null
}

const props = withDefaults(defineProps<{
  modelValue: boolean
  orgSlug: string
  resource: 'workspaces' | 'documents'
  itemKind: 'スペース' | '資料'
  canManageArchive?: boolean
}>(), {
  canManageArchive: false,
})
const emit = defineEmits<{
  'update:modelValue': [boolean]
  restored: [ArchivedNamedItem]
  deleted: [number]
}>()
const { api } = useApi()
const items = ref<ArchivedNamedItem[] | null>(null)
const error = ref<string | null>(null)
const loading = ref(false)
const pendingId = ref<number | null>(null)
const restoreTarget = ref<ArchivedNamedItem | null>(null)
const deleteTarget = ref<ArchivedNamedItem | null>(null)
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

async function load () {
  error.value = null
  loading.value = true
  try {
    const response = await api<{ data: ArchivedNamedItem[] }>(
      `/orgs/${props.orgSlug}/${props.resource}/archived`,
    )
    items.value = response.data
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : '読み込みに失敗しました'
  } finally {
    loading.value = false
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
      `/orgs/${props.orgSlug}/${props.resource}/${target.id}/unarchive`,
      { method: 'POST' },
    )
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
    await api(`/orgs/${props.orgSlug}/${props.resource}/${target.id}`, {
      method: 'DELETE',
    })
    deleteTarget.value = null
    items.value = (items.value ?? []).filter(item => item.id !== target.id)
    emit('deleted', target.id)
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : '完全削除に失敗しました'
  } finally {
    pendingId.value = null
  }
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) void load()
  },
)
</script>

<style lang="scss" scoped src="~/assets/styles/components/modals/ArchivedNamedItemsModal.scss"></style>
