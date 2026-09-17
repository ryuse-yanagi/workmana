<template>
  <SettingsPanel title="ユーザー設定">
    <template v-if="canManage" #actions>
      <button
        type="button"
        class="settings-panel__action-btn"
        @click="inviteModalOpen = true"
      >
        <UserPlus :size="20" :stroke-width="2.1" aria-hidden="true" />
        ユーザー招待
      </button>
    </template>
    <p v-if="!canManage" class="invite-readonly">
      招待の送信は組織管理者のみ行えます。
    </p>

    <p v-if="message" class="settings-msg">
      {{ message }}
    </p>

    <section
      v-if="loadingInvites || pendingInvites.length > 0"
      class="invite-section"
    >
      <h3 class="invite-section__title">招待中のユーザー</h3>
      <p v-if="loadingInvites" class="invite-section__empty">読み込み中…</p>
      <ul v-else class="member-row-list">
        <li
          v-for="invite in pendingInvites"
          :key="invite.id"
          class="invite-row"
        >
          <div class="member-row">
            <div class="member-row__leading">
              <span class="member-row__name">{{ invite.email }}</span>
            </div>
            <div
              v-if="canManage"
              class="member-row__actions"
            >
              <button
                type="button"
                class="label-action-btn label-action-btn--delete"
                :disabled="pendingInviteActionId === invite.id"
                @click="openCancelInvite(invite)"
              >
                取消
              </button>
            </div>
          </div>
          <p class="invite-row__expires">
            期限 {{ formatDate(invite.expires_at) }}
          </p>
        </li>
      </ul>
    </section>

    <template v-if="loadingMembers">
      <section class="invite-section">
        <p class="invite-section__empty">読み込み中…</p>
      </section>
    </template>
    <template v-else>
      <section class="invite-section">
        <h3 class="invite-section__title">管理者</h3>
        <p v-if="!adminMembers.length" class="invite-section__empty">管理者がいません。</p>
        <ul v-else class="member-row-list">
          <li
            v-for="member in adminMembers"
            :key="member.id"
            class="member-row"
          >
            <div class="member-row__leading">
              <MemberAvatar :member="member" size="sm" />
              <span class="member-row__name">{{ member.name }}</span>
            </div>
            <span class="member-row__email">{{ member.email }}</span>
            <div
              v-if="canManage && member.id !== currentUserId"
              class="member-row__actions"
            >
              <button
                type="button"
                class="label-action-btn label-action-btn--edit"
                :disabled="pendingMemberActionId === member.id"
                @click="openEditMember(member)"
              >
                編集
              </button>
              <button
                type="button"
                class="label-action-btn label-action-btn--delete"
                :disabled="pendingMemberActionId === member.id"
                @click="openRemoveMember(member)"
              >
                削除
              </button>
            </div>
          </li>
        </ul>
      </section>

      <section class="invite-section">
        <h3 class="invite-section__title">一般ユーザー</h3>
        <p v-if="!regularMembers.length" class="invite-section__empty">一般ユーザーがいません。</p>
        <ul v-else class="member-row-list">
          <li
            v-for="member in regularMembers"
            :key="member.id"
            class="member-row"
          >
            <div class="member-row__leading">
              <MemberAvatar :member="member" size="sm" />
              <span class="member-row__name">{{ member.name }}</span>
            </div>
            <span class="member-row__email">{{ member.email }}</span>
            <div
              v-if="canManage && member.id !== currentUserId"
              class="member-row__actions"
            >
              <button
                type="button"
                class="label-action-btn label-action-btn--edit"
                :disabled="pendingMemberActionId === member.id"
                @click="openEditMember(member)"
              >
                編集
              </button>
              <button
                type="button"
                class="label-action-btn label-action-btn--delete"
                :disabled="pendingMemberActionId === member.id"
                @click="openRemoveMember(member)"
              >
                削除
              </button>
            </div>
          </li>
        </ul>
      </section>
    </template>

    <UserInviteModal
      ref="inviteModalRef"
      v-model="inviteModalOpen"
      :loading="submittingInvite"
      @submit="submitInvite"
    />
    <MemberEditModal
      ref="memberEditModalRef"
      v-model="memberEditModalOpen"
      :member="editingMember"
      :loading="pendingMemberActionId !== null && pendingMemberActionId === editingMember?.id"
      @submit="submitEditMember"
    />
    <ConfirmModal
      v-model="cancelInviteModalOpen"
      title="ユーザー招待の取り消し"
      :message="cancelInviteMessage"
      confirm-text="取り消し"
      cancel-text="キャンセル"
      variant="danger"
      :loading="pendingInviteActionId !== null"
      @confirm="confirmCancelInvite"
    />
    <MemberDeleteModal
      ref="memberDeleteModalRef"
      v-model="memberDeleteModalOpen"
      :member-name="deletingMember?.name ?? ''"
      :loading="pendingMemberActionId !== null && pendingMemberActionId === deletingMember?.id"
      @confirm="confirmRemoveMember"
    />
  </SettingsPanel>
</template>

<script setup lang="ts">
import { UserPlus } from 'lucide-vue-next'
import SettingsPanel from './SettingsPanel.vue'
import ConfirmModal from '../modals/ConfirmModal.vue'
import MemberDeleteModal from '../modals/MemberDeleteModal.vue'
import MemberEditModal from '../modals/MemberEditModal.vue'
import UserInviteModal from '../modals/UserInviteModal.vue'
import MemberAvatar from '../ui/MemberAvatar.vue'
import { useApi } from '../../composables/useApi'
import { useCurrentUser } from '../../composables/useCurrentUser'
import { useOrgSettingsPageData } from '../../composables/useOrgSettingsPageData'
import {
  applyUserProfileToMembers,
  useOnUserProfileUpdated,
} from '../../composables/userProfileUpdated'
import type { SettingsOrgMember, SettingsPendingInvite } from './types'

type InviteRole = 'admin' | 'member'
type PendingInvite = SettingsPendingInvite
type OrgMember = SettingsOrgMember

const props = withDefaults(defineProps<{
  orgSlug: string
  canManage: boolean
  initialMembers?: OrgMember[]
  initialInvites?: PendingInvite[]
}>(), {
  initialMembers: () => [],
  initialInvites: () => [],
})

const { api } = useApi()
const { currentUserId, ensureCurrentUser } = useCurrentUser()
const { patchMembersCache } = useOrgSettingsPageData()

const message = ref('')
const messageKind = ref<'ok' | 'err'>('ok')
const loadingInvites = ref(false)
const loadingMembers = ref(false)
const pendingInvites = ref<PendingInvite[]>([...props.initialInvites])
const members = ref<OrgMember[]>([...props.initialMembers])
const pendingInviteActionId = ref<number | null>(null)
const pendingMemberActionId = ref<number | null>(null)

const adminMembers = computed(() => members.value.filter(member => member.role === 'admin'))
const regularMembers = computed(() => members.value.filter(member => member.role !== 'admin'))

const inviteModalOpen = ref(false)
const submittingInvite = ref(false)
const inviteModalRef = ref<{ setSubmitError: (message: string) => void } | null>(null)

const cancelInviteModalOpen = ref(false)
const cancelTargetInvite = ref<PendingInvite | null>(null)
const cancelInviteMessage = computed(() => {
  const email = cancelTargetInvite.value?.email
  if (!email) {
    return 'この招待を取り消します。よろしいですか？'
  }
  return `この招待を取り消します。よろしいですか？\n【対象】\n${email}`
})

const memberEditModalOpen = ref(false)
const editingMember = ref<OrgMember | null>(null)
const memberEditModalRef = ref<{ setSubmitError: (message: string) => void } | null>(null)

const memberDeleteModalOpen = ref(false)
const deletingMember = ref<OrgMember | null>(null)
const memberDeleteModalRef = ref<{ setSubmitError: (message: string) => void } | null>(null)

function formatDate (value: string | null): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function syncMembersCache () {
  patchMembersCache(props.orgSlug, members.value, pendingInvites.value)
  if (import.meta.client) {
    window.dispatchEvent(new CustomEvent('tm:settings-members-updated'))
  }
}

async function loadInvites () {
  if (!props.canManage) {
    pendingInvites.value = []
    syncMembersCache()
    return
  }
  loadingInvites.value = true
  try {
    const res = await api<{ data: PendingInvite[] }>(`/orgs/${props.orgSlug}/invites`)
    pendingInvites.value = res.data ?? []
    syncMembersCache()
  } catch (error: unknown) {
    pendingInvites.value = []
    messageKind.value = 'err'
    message.value = error instanceof Error ? error.message : '招待一覧の取得に失敗しました。'
  } finally {
    loadingInvites.value = false
  }
}

async function loadMembers () {
  loadingMembers.value = true
  try {
    const res = await api<{ data: OrgMember[] }>(`/orgs/${props.orgSlug}/members`)
    members.value = res.data ?? []
    syncMembersCache()
  } catch (error: unknown) {
    members.value = []
    messageKind.value = 'err'
    message.value = error instanceof Error ? error.message : 'メンバー一覧の取得に失敗しました。'
  } finally {
    loadingMembers.value = false
  }
}

async function reloadLists () {
  await Promise.all([loadInvites(), loadMembers()])
}

async function submitInvite (payload: { email: string; role: InviteRole }) {
  if (!props.canManage || submittingInvite.value) return
  submittingInvite.value = true
  message.value = ''
  try {
    await api<{ resent?: boolean }>(`/orgs/${props.orgSlug}/invites`, {
      method: 'POST',
      body: {
        email: payload.email,
        role: payload.role,
      },
    })
    inviteModalOpen.value = false
    message.value = ''
    await loadInvites()
  } catch (error: unknown) {
    inviteModalRef.value?.setSubmitError(
      error instanceof Error ? error.message : '招待の送信に失敗しました。',
    )
  } finally {
    submittingInvite.value = false
  }
}

function openCancelInvite (invite: PendingInvite) {
  if (!props.canManage) return
  cancelTargetInvite.value = invite
  cancelInviteModalOpen.value = true
}

async function confirmCancelInvite () {
  const invite = cancelTargetInvite.value
  if (!props.canManage || !invite || pendingInviteActionId.value !== null) return
  pendingInviteActionId.value = invite.id
  message.value = ''
  try {
    await api(`/orgs/${props.orgSlug}/invites/${invite.id}`, { method: 'DELETE' })
    cancelInviteModalOpen.value = false
    cancelTargetInvite.value = null
    message.value = ''
    await reloadLists()
  } catch (error: unknown) {
    messageKind.value = 'err'
    message.value = error instanceof Error ? error.message : '招待の取り消しに失敗しました。'
  } finally {
    pendingInviteActionId.value = null
  }
}

function openEditMember (member: OrgMember) {
  if (!props.canManage || member.id === currentUserId.value) return
  editingMember.value = member
  memberEditModalOpen.value = true
}

async function submitEditMember (payload: { role: InviteRole }) {
  const member = editingMember.value
  if (!props.canManage || !member || member.id === currentUserId.value || pendingMemberActionId.value !== null) return
  pendingMemberActionId.value = member.id
  message.value = ''
  try {
    await api(`/orgs/${props.orgSlug}/members/${member.id}`, {
      method: 'PATCH',
      body: { role: payload.role },
    })
    memberEditModalOpen.value = false
    editingMember.value = null
    message.value = ''
    await loadMembers()
  } catch (error: unknown) {
    memberEditModalRef.value?.setSubmitError(
      error instanceof Error ? error.message : 'ロールの更新に失敗しました。',
    )
  } finally {
    pendingMemberActionId.value = null
  }
}

function openRemoveMember (member: OrgMember) {
  if (!props.canManage || member.id === currentUserId.value) return
  deletingMember.value = member
  memberDeleteModalOpen.value = true
}

async function confirmRemoveMember () {
  const member = deletingMember.value
  if (!props.canManage || !member || member.id === currentUserId.value || pendingMemberActionId.value !== null) return
  pendingMemberActionId.value = member.id
  message.value = ''
  try {
    await api(`/orgs/${props.orgSlug}/members/${member.id}`, { method: 'DELETE' })
    memberDeleteModalOpen.value = false
    deletingMember.value = null
    message.value = ''
    await reloadLists()
  } catch (error: unknown) {
    memberDeleteModalRef.value?.setSubmitError(
      error instanceof Error ? error.message : 'メンバーの削除に失敗しました。',
    )
  } finally {
    pendingMemberActionId.value = null
  }
}

watch(
  () => props.initialMembers,
  (value) => {
    members.value = [...value]
  },
)

watch(
  () => props.initialInvites,
  (value) => {
    pendingInvites.value = [...value]
  },
)

watch(
  () => props.orgSlug,
  (slug, prevSlug) => {
    void ensureCurrentUser()
    if (prevSlug !== undefined && slug !== prevSlug) {
      void reloadLists()
    }
  },
  { immediate: true },
)

useOnUserProfileUpdated((detail) => {
  members.value = applyUserProfileToMembers(members.value, detail)
  syncMembersCache()
})
</script>

<style lang="scss" scoped src="~/assets/styles/components/settings/SettingsMembersPanel.scss"></style>
