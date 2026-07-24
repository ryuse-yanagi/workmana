<template>
  <SettingsPanel
    title="グループ設定"
    note="組織メンバーをグループ分けし、色を付けて管理します。上から順に表示されます。"
  >
    <div class="member-groups-panel">
      <div class="member-groups-panel__toolbar">
        <button
          type="button"
          class="member-groups-panel__add-btn"
          :disabled="loading || groups.length >= 20"
          @click="openCreate"
        >
          <Users :size="20" :stroke-width="2.1" aria-hidden="true" />
          グループ作成
        </button>
      </div>
      <p v-if="message" class="settings-msg" :class="{ 'settings-msg--err': messageKind === 'err' }">
        {{ message }}
      </p>
      <p v-if="!loading && !groups.length" class="member-groups-panel__empty">
        まだグループがありません。「グループ作成」から作成してください。
      </p>
      <draggable
        v-model="groups"
        item-key="id"
        class="member-group-list"
        handle=".member-group-row__drag-handle"
        :animation="150"
        :disabled="loading || reordering"
        ghost-class="label-settings-row--ghost"
        chosen-class="label-settings-row--chosen"
        @end="onDragEnd"
      >
        <template #item="{ element: group, index: groupIndex }">
          <div class="member-group-block">
            <div class="member-group-row">
              <button
                type="button"
                class="member-group-row__drag-handle"
                aria-label="ドラッグしてグループの並び順を変更"
                @click.prevent
              >
                <Equal :size="24" :stroke-width="2.25" aria-hidden="true" />
              </button>
              <button
                type="button"
                class="member-group-row__toggle"
                :aria-expanded="!isGroupCollapsed(group.id)"
                :aria-label="isGroupCollapsed(group.id) ? 'メンバーを展開' : 'メンバーを折りたたむ'"
                @click="toggleGroupCollapse(group.id)"
              >
                <ChevronDown
                  v-if="!isGroupCollapsed(group.id)"
                  :size="16"
                  :stroke-width="2.25"
                  aria-hidden="true"
                />
                <ChevronRight
                  v-else
                  :size="16"
                  :stroke-width="2.25"
                  aria-hidden="true"
                />
              </button>
              <span
                class="member-group-row__dot"
                :style="{ backgroundColor: colorForGroup(group) }"
                aria-hidden="true"
              />
              <span class="member-group-row__name">{{ group.name }}</span>
              <div class="member-group-row__actions">
                <button
                  type="button"
                  class="label-action-btn label-action-btn--edit"
                  :disabled="loading"
                  @click="openEdit(group)"
                >
                  編集
                </button>
                <button
                  type="button"
                  class="label-action-btn label-action-btn--delete"
                  :disabled="loading"
                  @click="openDelete(group)"
                >
                  削除
                </button>
              </div>
            </div>
            <draggable
              v-if="!isGroupCollapsed(group.id) && groups[groupIndex] && groups[groupIndex]!.members.length"
              v-model="groups[groupIndex]!.members"
              item-key="id"
              class="member-row-list"
              handle=".member-row__drag-handle"
              :animation="150"
              :disabled="loading || reordering"
              ghost-class="label-settings-row--ghost"
              chosen-class="label-settings-row--chosen"
              @change="onMemberListChange(group.id, $event)"
            >
              <template #item="{ element: member }">
                <div class="member-row">
                  <button
                    type="button"
                    class="member-row__drag-handle"
                    aria-label="ドラッグしてメンバーの並び順を変更"
                    @click.prevent
                  >
                    <Equal :size="24" :stroke-width="2.25" aria-hidden="true" />
                  </button>
                  <MemberAvatar
                    :member="member"
                    size="sm"
                    class="member-row__avatar"
                  />
                  <span class="member-row__name">{{ memberDisplayName(member) }}</span>
                </div>
              </template>
            </draggable>
            <ul
              v-else-if="!isGroupCollapsed(group.id)"
              class="member-row-list"
            >
              <li class="member-row member-row--empty">
                <span class="member-row__empty-text">メンバーがありません</span>
              </li>
            </ul>
          </div>
        </template>
      </draggable>
    </div>

    <MemberGroupEditModal
      v-model="editModalOpen"
      :mode="editModalMode"
      :org-members="orgMembers"
      :initial-values="editingValues"
      :loading="loading"
      @submit="submitEdit"
    />
    <DefaultNamedColorItemDeleteModal
      v-model="deleteModalOpen"
      title="グループの削除"
      item-kind="グループ"
      :item-name="deletingGroupName"
      :loading="loading"
      @confirm="confirmDelete"
    />
  </SettingsPanel>
</template>

<script setup lang="ts">
import draggable from 'vuedraggable'
import { ChevronDown, ChevronRight, Equal, Users } from 'lucide-vue-next'
import { useApi } from '../../composables/useApi'
import { memberDisplayName } from '../../composables/useMemberDisplay'
import type { TaskFormMember } from '../../composables/useTaskFormHelpers'
import DefaultNamedColorItemDeleteModal from '../modals/DefaultNamedColorItemDeleteModal.vue'
import MemberGroupEditModal, {
  type MemberGroupEditPayload,
} from '../modals/MemberGroupEditModal.vue'
import MemberAvatar from '../ui/MemberAvatar.vue'
import SettingsPanel from './SettingsPanel.vue'
import { standardColorAtIndex } from '../../constants/colorPresets'
import type { SettingsMemberGroup } from './types'

const props = defineProps<{
  orgSlug: string
}>()

const { api } = useApi()
const groups = ref<SettingsMemberGroup[]>([])
const orgMembers = ref<TaskFormMember[]>([])
const loading = ref(false)
const reordering = ref(false)
const message = ref('')
const messageKind = ref<'ok' | 'err'>('ok')
const collapsedGroupIds = ref<Set<number>>(new Set())
const editModalOpen = ref(false)
const editModalMode = ref<'create' | 'edit'>('create')
const editingGroupId = ref<number | null>(null)
const editingValues = ref<{
  name: string
  color_index: number
  members: TaskFormMember[]
} | null>(null)
const deleteModalOpen = ref(false)
const deletingGroupId = ref<number | null>(null)
const deletingGroupName = computed(() => {
  if (deletingGroupId.value === null) return ''
  return groups.value.find(group => group.id === deletingGroupId.value)?.name ?? ''
})

function colorForGroup (group: SettingsMemberGroup): string {
  return standardColorAtIndex(group.color_index)
}

function isGroupCollapsed (groupId: number): boolean {
  return collapsedGroupIds.value.has(groupId)
}

function toggleGroupCollapse (groupId: number) {
  const next = new Set(collapsedGroupIds.value)
  if (next.has(groupId)) {
    next.delete(groupId)
  } else {
    next.add(groupId)
  }
  collapsedGroupIds.value = next
}

function setMessage (msg: string, kind: 'ok' | 'err') {
  message.value = msg
  messageKind.value = kind
}

async function load () {
  loading.value = true
  setMessage('', 'ok')
  try {
    const [groupsRes, membersRes] = await Promise.all([
      api<{ data: SettingsMemberGroup[] }>(`/orgs/${props.orgSlug}/member-groups`),
      api<{ data: TaskFormMember[] }>(`/orgs/${props.orgSlug}/members`),
    ])
    groups.value = groupsRes.data ?? []
    orgMembers.value = membersRes.data ?? []
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'グループ設定の取得に失敗しました'
    setMessage(msg, 'err')
  } finally {
    loading.value = false
  }
}

type DragEndEvent = {
  oldIndex?: number
  newIndex?: number
}

type MemberListChangeEvent = {
  moved?: {
    oldIndex: number
    newIndex: number
  }
}

function findGroupById (groupId: number): SettingsMemberGroup | undefined {
  return groups.value.find(group => group.id === groupId)
}

async function persistOrder () {
  reordering.value = true
  setMessage('', 'ok')
  try {
    groups.value.forEach((group, index) => {
      group.sort_order = index
    })
    await api<{ data: { ok: boolean } }>(`/orgs/${props.orgSlug}/member-groups/reorder`, {
      method: 'PATCH',
      body: { group_ids: groups.value.map(group => group.id) },
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'グループの並び替えに失敗しました'
    setMessage(msg, 'err')
    await load()
  } finally {
    reordering.value = false
  }
}

async function persistMemberOrder (groupId: number) {
  await nextTick()
  const group = findGroupById(groupId)
  if (!group) {
    return
  }
  reordering.value = true
  setMessage('', 'ok')
  try {
    await api<{ data: { ok: boolean } }>(
      `/orgs/${props.orgSlug}/member-groups/${groupId}/members/reorder`,
      {
        method: 'PATCH',
        body: { member_ids: group.members.map(member => member.id) },
      },
    )
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'メンバーの並び替えに失敗しました'
    setMessage(msg, 'err')
    await load()
  } finally {
    reordering.value = false
  }
}

function onDragEnd (evt: DragEndEvent) {
  if (evt.oldIndex === undefined || evt.newIndex === undefined || evt.oldIndex === evt.newIndex) {
    return
  }
  void persistOrder()
}

function onMemberListChange (groupId: number, evt: MemberListChangeEvent) {
  const moved = evt.moved
  if (!moved || moved.oldIndex === moved.newIndex) {
    return
  }
  void persistMemberOrder(groupId)
}

function openCreate () {
  if (groups.value.length >= 20) return
  editModalMode.value = 'create'
  editingGroupId.value = null
  editingValues.value = {
    name: '',
    color_index: groups.value.length % 10,
    members: [],
  }
  editModalOpen.value = true
}

function openEdit (group: SettingsMemberGroup) {
  editModalMode.value = 'edit'
  editingGroupId.value = group.id
  editingValues.value = {
    name: group.name,
    color_index: group.color_index,
    members: [...group.members],
  }
  editModalOpen.value = true
}

function openDelete (group: SettingsMemberGroup) {
  deletingGroupId.value = group.id
  deleteModalOpen.value = true
}

async function submitEdit (payload: MemberGroupEditPayload) {
  loading.value = true
  setMessage('', 'ok')
  try {
    if (editModalMode.value === 'create') {
      const created = await api<SettingsMemberGroup>(`/orgs/${props.orgSlug}/member-groups`, {
        method: 'POST',
        body: payload,
      })
      groups.value = [...groups.value, created]
      setMessage('グループを作成しました。', 'ok')
    } else if (editingGroupId.value !== null) {
      const updated = await api<SettingsMemberGroup>(
        `/orgs/${props.orgSlug}/member-groups/${editingGroupId.value}`,
        {
          method: 'PATCH',
          body: payload,
        },
      )
      groups.value = groups.value.map(group => (
        group.id === updated.id ? updated : group
      ))
      setMessage('グループ設定を更新しました。', 'ok')
    } else {
      return
    }
    editModalOpen.value = false
    editingGroupId.value = null
    editingValues.value = null
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'グループ設定の更新に失敗しました'
    setMessage(msg, 'err')
  } finally {
    loading.value = false
  }
}

async function confirmDelete () {
  if (deletingGroupId.value === null) return
  loading.value = true
  setMessage('', 'ok')
  try {
    await api(`/orgs/${props.orgSlug}/member-groups/${deletingGroupId.value}`, {
      method: 'DELETE',
    })
    const deletedId = deletingGroupId.value
    groups.value = groups.value.filter(group => group.id !== deletedId)
    const nextCollapsed = new Set(collapsedGroupIds.value)
    nextCollapsed.delete(deletedId)
    collapsedGroupIds.value = nextCollapsed
    deleteModalOpen.value = false
    deletingGroupId.value = null
    setMessage('グループ設定を更新しました。', 'ok')
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'グループの削除に失敗しました'
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
.member-groups-panel__toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 11.9px;
}
.member-groups-panel__add-btn {
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
  background: mixin.$main;
  cursor: pointer;
}
.member-groups-panel__add-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.member-groups-panel__empty {
  margin: 0;
  color: #64748b;
  font-size: 12.6px;
}
.member-group-list {
  display: flex;
  flex-direction: column;
  gap: 10.5px;
}
.member-group-block {
  display: flex;
  flex-direction: column;
  gap: 6.3px;
}
.member-row-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6.3px;
}
.member-group-row,
.member-row {
  display: flex;
  align-items: center;
  gap: 7.7px;
  box-sizing: border-box;
  width: 100%;
  padding: 0 10.5px;
  border-radius: 10px;
}
.member-group-row {
  height: 40px;
  background: mixin.$gray;
}
.member-row {
  height: 54px;
  background: #f5f6fa;
}
.member-group-row__drag-handle,
.member-row__drag-handle {
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
.member-group-row__drag-handle {
  background: mixin.$gray;
}
.member-row__drag-handle {
  background: #f5f6fa;
}
.member-group-row__drag-handle:active,
.member-row__drag-handle:active {
  cursor: default;
}
.member-group-row__toggle {
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
  background: transparent;
  color: #64748b;
  cursor: pointer;
}
.label-settings-row--ghost {
  opacity: 0.45;
}
.label-settings-row--chosen {
  opacity: 0.85;
}
.member-group-row__name,
.member-row__name {
  flex: 1;
  min-width: 0;
  font-size: 12.25px;
  font-weight: 700;
  color: #0f172a;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.member-group-row__dot {
  flex-shrink: 0;
  width: 11.9px;
  height: 11.9px;
  border-radius: 999px;
}
.member-row__avatar {
  flex-shrink: 0;
}
.member-row--empty {
  justify-content: flex-start;
  padding-left: 42px;
}
.member-row__empty-text {
  color: #94a3b8;
  font-size: 12.04px;
  font-weight: 600;
}
.member-group-row__actions {
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
  color: mixin.$main;
}
.label-action-btn--delete {
  color: mixin.$danger;
}
.label-action-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
</style>
