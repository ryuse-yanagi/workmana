<template>
  <SettingsPanel title="ユーザー設定">
    <template v-if="canManage" #actions>
      <button
        type="button"
        class="settings-panel__action-btn"
        @click="inviteModalOpen = true"
      >
        ユーザー招待
      </button>
    </template>
    <p v-if="!canManage" class="invite-readonly">
      招待の送信は組織管理者のみ行えます。
    </p>

    <p v-if="message" class="settings-msg">
      {{ message }}
    </p>

    <section class="invite-section">
      <h3 class="invite-section__title">未使用の招待</h3>
      <p v-if="loadingInvites" class="invite-section__empty">読み込み中…</p>
      <p v-else-if="!pendingInvites.length" class="invite-section__empty">
        未使用の招待はありません。
      </p>
      <ul v-else class="invite-list">
        <li v-for="invite in pendingInvites" :key="invite.id" class="invite-list__item">
          <div class="invite-list__main">
            <span class="invite-list__email">{{ invite.email }}</span>
            <span class="invite-list__role">{{ roleLabel(invite.role) }}</span>
          </div>
          <div class="invite-list__actions">
            <span class="invite-list__meta">
              期限 {{ formatDate(invite.expires_at) }}
            </span>
            <button
              v-if="canManage"
              type="button"
              class="invite-list__btn invite-list__btn--danger"
              :disabled="pendingInviteActionId === invite.id"
              @click="openCancelInvite(invite)"
            >
              取消
            </button>
          </div>
        </li>
      </ul>
    </section>

    <section class="invite-section">
      <h3 class="invite-section__title">メンバー</h3>
      <p v-if="loadingMembers" class="invite-section__empty">読み込み中…</p>
      <p v-else-if="!members.length" class="invite-section__empty">メンバーがいません。</p>
      <ul v-else class="invite-list">
        <li v-for="member in members" :key="member.id" class="invite-list__item">
          <div class="invite-list__main">
            <MemberAvatar :member="member" size="sm" />
            <span class="invite-list__email">{{ member.name }}</span>
            <span class="invite-list__role">{{ roleLabel(member.role) }}</span>
          </div>
          <div class="invite-list__actions">
            <span class="invite-list__meta">{{ member.email }}</span>
            <button
              v-if="canManage && member.id !== currentUserId"
              type="button"
              class="invite-list__btn invite-list__btn--edit"
              :disabled="pendingMemberActionId === member.id"
              @click="openEditMember(member)"
            >
              編集
            </button>
            <button
              v-if="canManage && member.id !== currentUserId"
              type="button"
              class="invite-list__btn invite-list__btn--danger"
              :disabled="pendingMemberActionId === member.id"
              @click="openRemoveMember(member)"
            >
              削除
            </button>
          </div>
        </li>
      </ul>
    </section>

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
      title="招待の取消確認"
      :message="cancelInviteMessage"
      confirm-text="取消"
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
import SettingsPanel from './SettingsPanel.vue'
import ConfirmModal from '../modals/ConfirmModal.vue'
import MemberDeleteModal from '../modals/MemberDeleteModal.vue'
import MemberEditModal from '../modals/MemberEditModal.vue'
import UserInviteModal from '../modals/UserInviteModal.vue'
import MemberAvatar from '../ui/MemberAvatar.vue'
import { useCurrentUser } from '../../composables/useCurrentUser'
import {
  applyUserProfileToMembers,
  useOnUserProfileUpdated,
} from '../../composables/userProfileUpdated'

type InviteRole = 'admin' | 'member'

type PendingInvite = {
  id: number
  email: string
  role: InviteRole
  expires_at: string | null
  created_at: string | null
}

type OrgMember = {
  id: number
  name: string
  email: string
  role?: string | null
  avatar_url?: string | null
}

const props = defineProps<{
  orgSlug: string
  canManage: boolean
}>()

const { api } = useApi()
const { currentUserId, ensureCurrentUser } = useCurrentUser()

const message = ref('')
const messageKind = ref<'ok' | 'err'>('ok')
const loadingInvites = ref(false)
const loadingMembers = ref(false)
const pendingInvites = ref<PendingInvite[]>([])
const members = ref<OrgMember[]>([])
const pendingInviteActionId = ref<number | null>(null)
const pendingMemberActionId = ref<number | null>(null)

const inviteModalOpen = ref(false)
const submittingInvite = ref(false)
const inviteModalRef = ref<{ setSubmitError: (message: string) => void } | null>(null)

const cancelInviteModalOpen = ref(false)
const cancelTargetInvite = ref<PendingInvite | null>(null)
const cancelInviteMessage = computed(() => {
  const email = cancelTargetInvite.value?.email
  return email
    ? `「${email}」への招待を取り消しますか？`
    : 'この招待を取り消しますか？'
})

const memberEditModalOpen = ref(false)
const editingMember = ref<OrgMember | null>(null)
const memberEditModalRef = ref<{ setSubmitError: (message: string) => void } | null>(null)

const memberDeleteModalOpen = ref(false)
const deletingMember = ref<OrgMember | null>(null)
const memberDeleteModalRef = ref<{ setSubmitError: (message: string) => void } | null>(null)

function roleLabel (value: string | null | undefined): string {
  return value === 'admin' ? '管理者' : 'メンバー'
}

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

async function loadInvites () {
  if (!props.canManage) {
    pendingInvites.value = []
    return
  }
  loadingInvites.value = true
  try {
    const res = await api<{ data: PendingInvite[] }>(`/orgs/${props.orgSlug}/invites`)
    pendingInvites.value = res.data ?? []
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
  () => [props.orgSlug, props.canManage] as const,
  () => {
    void ensureCurrentUser()
    void loadInvites()
    void loadMembers()
  },
  { immediate: true },
)
useOnUserProfileUpdated((detail) => {
  members.value = applyUserProfileToMembers(members.value, detail)
})
</script>

<style lang="scss" scoped src="~/assets/styles/components/settings/SettingsMembersPanel.scss"></style>
