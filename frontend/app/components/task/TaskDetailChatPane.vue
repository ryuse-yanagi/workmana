<template>
  <aside class="task-detail-chat-pane" aria-label="コメント">
    <header class="chat-header">
      <h4 class="chat-header-title">コメント</h4>
      <span v-if="comments.length" class="chat-header-count">{{ comments.length }}</span>
    </header>

    <div
      ref="chatMessagesRef"
      class="chat-messages"
      aria-live="polite"
      aria-relevant="additions"
    >
      <p v-if="commentsLoading" class="chat-state">読み込み中...</p>
      <p v-else-if="commentsLoadError" class="chat-state chat-state--error">{{ commentsLoadError }}</p>
      <p v-else-if="!comments.length" class="chat-empty">コメントはまだありません</p>
      <article
        v-for="comment in comments"
        v-else
        :key="comment.id"
        class="comment-item"
      >
        <MemberAvatar
          :member="commentAuthorMember(comment)"
          size="sm"
          decorative
        />
        <div class="comment-item__body">
          <header class="comment-item__header">
            <strong class="comment-item__author">{{ commentAuthorName(comment) }}</strong>
            <time
              class="comment-item__time"
              :datetime="comment.created_at"
              :title="formatCommentFullTime(comment.created_at)"
            >
              {{ formatCommentRelativeTime(comment.created_at) }}
            </time>
            <span v-if="comment.edited" class="comment-item__edited">(編集済み)</span>
          </header>

          <div v-if="editingCommentId === comment.id" class="comment-item__edit">
            <textarea
              ref="editInputRef"
              v-model="editDraft"
              class="comment-item__edit-input"
              rows="3"
              :disabled="editSaving"
            />
            <div class="comment-item__edit-actions">
              <button
                type="button"
                class="comment-item__edit-save"
                :disabled="!editDraft.trim()"
                @click="saveEdit(comment)"
              >
                保存
              </button>
              <button
                type="button"
                class="comment-item__edit-cancel"
                @click="cancelEdit"
              >
                キャンセル
              </button>
            </div>
            <p v-if="editError" class="comment-item__edit-error">{{ editError }}</p>
          </div>
          <div v-else class="comment-item__card">
            <p class="comment-item__text">{{ comment.body }}</p>
          </div>

          <div v-if="comment.reactions.length" class="comment-item__reactions">
            <button
              v-for="reaction in comment.reactions"
              :key="`${comment.id}-${reaction.emoji}`"
              type="button"
              class="comment-item__reaction"
              :class="{ 'comment-item__reaction--mine': reaction.reacted_by_me }"
              :title="reactionTooltip(reaction)"
              :disabled="reactionPendingId === comment.id"
              @click="toggleReaction(comment, reaction.emoji)"
            >
              <span aria-hidden="true">{{ reaction.emoji }}</span>
              <span>{{ reaction.count }}</span>
            </button>
          </div>

          <footer v-if="isCommentMine(comment)" class="comment-item__actions">
            <div class="comment-item__reaction-menu-host">
              <button
                type="button"
                class="comment-item__action comment-item__action--emoji"
                aria-label="リアクション"
                @click="toggleReactionMenu(comment.id)"
              >
                <Smile :size="14" aria-hidden="true" />
              </button>
              <div
                v-if="openReactionMenuCommentId === comment.id"
                class="comment-item__reaction-menu"
              >
                <button
                  v-for="emoji in reactionChoices"
                  :key="emoji"
                  type="button"
                  class="comment-item__reaction-choice"
                  :disabled="reactionPendingId === comment.id"
                  @click="toggleReaction(comment, emoji)"
                >
                  {{ emoji }}
                </button>
              </div>
            </div>
            <button
              type="button"
              class="comment-item__action"
              @click="startEdit(comment)"
            >
              編集
            </button>
            <span class="comment-item__action-sep" aria-hidden="true">•</span>
            <button
              type="button"
              class="comment-item__action"
              @click="openDeleteConfirm(comment)"
            >
              削除
            </button>
          </footer>
        </div>
      </article>
    </div>

    <footer class="chat-composer">
      <textarea
        ref="commentInputRef"
        v-model.trim="commentDraft"
        class="chat-input"
        rows="1"
        placeholder="コメントを入力する..."
        :disabled="commentSending || commentsLoading || !!commentsLoadError || !taskId"
        @input="adjustCommentInputHeight"
        @keydown.enter.exact.prevent="sendComment"
      />
      <button
        type="button"
        class="chat-send-btn"
        :disabled="!commentDraft.trim() || commentSending || commentsLoading || !!commentsLoadError || !taskId"
        aria-label="送信"
        @click="sendComment"
      >
        送信
      </button>
    </footer>
    <p v-if="commentSendError" class="chat-send-error">{{ commentSendError }}</p>

    <ConfirmModal
      v-model="deleteConfirmOpen"
      title="コメントの削除"
      :message="deleteError ? deleteError : 'このコメントを削除しますか？'"
      confirm-text="削除"
      variant="danger"
      :loading="deletePendingId !== null"
      @confirm="confirmDeleteComment"
    />
  </aside>
</template>

<script setup lang="ts">
import { Smile } from 'lucide-vue-next'
import { useApi } from '../../composables/useApi'
import { memberDisplayName, type MemberLike } from '../../composables/useMemberDisplay'

type CommentAuthor = {
  id: number
  name: string | null
  email: string | null
  avatar_url: string | null
}

type CommentReaction = {
  emoji: string
  count: number
  reacted_by_me: boolean
  users: CommentAuthor[]
}

type TaskComment = {
  id: number
  author_id: number
  author: CommentAuthor | null
  body: string
  created_at: string
  updated_at: string
  edited: boolean
  reactions: CommentReaction[]
}

const props = defineProps<{
  orgSlug: string
  projectId: string
  taskId: number | null
  projectMembers: MemberLike[]
}>()

const { api } = useApi()

const reactionChoices = ['👍', '😄', '🎉', '❤️', '👀', '🚀']

const comments = ref<TaskComment[]>([])
const commentsLoading = ref(false)
const commentsLoadError = ref<string | null>(null)
const commentDraft = ref('')
const commentSending = ref(false)
const commentSendError = ref<string | null>(null)
const currentUserId = ref<number | null>(null)
const chatMessagesRef = ref<HTMLElement | null>(null)
const commentInputRef = ref<HTMLTextAreaElement | null>(null)
const editInputRef = ref<HTMLTextAreaElement | null>(null)
const editingCommentId = ref<number | null>(null)
const editDraft = ref('')
const editSaving = ref(false)
const editError = ref<string | null>(null)
const deletePendingId = ref<number | null>(null)
const deleteConfirmOpen = ref(false)
const deleteTargetCommentId = ref<number | null>(null)
const deleteError = ref<string | null>(null)
const reactionPendingId = ref<number | null>(null)
const openReactionMenuCommentId = ref<number | null>(null)

watch(
  () => props.taskId,
  async (taskId) => {
    resetComments()
    if (taskId === null) {
      return
    }
    await Promise.all([loadCurrentUser(), loadComments()])
  },
  { immediate: true },
)

onMounted(() => {
  document.addEventListener('mousedown', onDocumentClick)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocumentClick)
})

function onDocumentClick (event: MouseEvent) {
  if (openReactionMenuCommentId.value === null) {
    return
  }
  const target = event.target as HTMLElement
  if (target.closest('.comment-item__reaction-menu-host')) {
    return
  }
  openReactionMenuCommentId.value = null
}

function resetComments () {
  comments.value = []
  commentsLoading.value = false
  commentsLoadError.value = null
  commentDraft.value = ''
  commentSending.value = false
  commentSendError.value = null
  editingCommentId.value = null
  editDraft.value = ''
  editSaving.value = false
  editError.value = null
  deletePendingId.value = null
  deleteConfirmOpen.value = false
  deleteTargetCommentId.value = null
  deleteError.value = null
  reactionPendingId.value = null
  openReactionMenuCommentId.value = null
}

function commentAuthorMember (comment: TaskComment): MemberLike {
  if (comment.author) {
    return comment.author
  }
  return {
    id: comment.author_id,
    name: null,
    email: null,
    avatar_url: null,
  }
}

function commentAuthorName (comment: TaskComment): string {
  if (comment.author) {
    return memberDisplayName(comment.author)
  }
  const member = props.projectMembers.find(item => item.id === comment.author_id)
  if (member) {
    return memberDisplayName(member)
  }
  return `ユーザー #${comment.author_id}`
}

function isCommentMine (comment: TaskComment): boolean {
  return currentUserId.value !== null && currentUserId.value === comment.author_id
}

function reactionTooltip (reaction: CommentReaction): string {
  const names = reaction.users
    .map(user => memberDisplayName(user))
    .join('、')
  return names || reaction.emoji
}

function formatCommentRelativeTime (iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.max(0, Math.floor(diffMs / 1000))

  if (diffSec < 60) {
    return 'たった今'
  }

  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) {
    return `${diffMin}分前`
  }

  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) {
    return `${diffHour}時間前`
  }

  return formatCommentFullTime(iso)
}

function formatCommentFullTime (iso: string): string {
  const date = new Date(iso)
  return date.toLocaleString('ja-JP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function replaceComment (updated: TaskComment) {
  comments.value = comments.value.map(comment => (
    comment.id === updated.id ? updated : comment
  ))
}

function scrollChatToBottom () {
  const el = chatMessagesRef.value
  if (!el) {
    return
  }
  el.scrollTop = el.scrollHeight
}

function adjustCommentInputHeight () {
  const el = commentInputRef.value
  if (!el) {
    return
  }
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, 120)}px`
}

async function loadCurrentUser () {
  try {
    const me = await api<{ id: number }>('/me')
    currentUserId.value = me.id
  } catch {
    currentUserId.value = null
  }
}

async function loadComments () {
  if (props.taskId === null) {
    return
  }

  commentsLoading.value = true
  commentsLoadError.value = null
  try {
    const res = await api<{ data: TaskComment[] }>(
      `/orgs/${props.orgSlug}/projects/${props.projectId}/tasks/${props.taskId}/comments`,
    )
    comments.value = res.data ?? []
    nextTick(() => scrollChatToBottom())
  } catch (e: unknown) {
    commentsLoadError.value = e instanceof Error ? e.message : 'コメントの読み込みに失敗しました'
    comments.value = []
  } finally {
    commentsLoading.value = false
  }
}

async function sendComment () {
  if (props.taskId === null) {
    return
  }

  const body = commentDraft.value.trim()
  if (!body || commentSending.value) {
    return
  }

  commentSending.value = true
  commentSendError.value = null
  try {
    const created = await api<TaskComment>(
      `/orgs/${props.orgSlug}/projects/${props.projectId}/tasks/${props.taskId}/comments`,
      { method: 'POST', body: { body } },
    )
    comments.value = [...comments.value, created]
    commentDraft.value = ''
    nextTick(() => {
      adjustCommentInputHeight()
      scrollChatToBottom()
      commentInputRef.value?.focus()
    })
  } catch (e: unknown) {
    commentSendError.value = e instanceof Error ? e.message : 'コメントの送信に失敗しました'
  } finally {
    commentSending.value = false
  }
}

function startEdit (comment: TaskComment) {
  if (deletePendingId.value !== null) {
    return
  }
  editingCommentId.value = comment.id
  editDraft.value = comment.body
  editError.value = null
  openReactionMenuCommentId.value = null
  nextTick(() => editInputRef.value?.focus())
}

function cancelEdit () {
  if (editSaving.value) {
    return
  }
  editingCommentId.value = null
  editDraft.value = ''
  editError.value = null
}

async function saveEdit (comment: TaskComment) {
  if (props.taskId === null || editSaving.value) {
    return
  }

  const body = editDraft.value.trim()
  if (!body) {
    return
  }

  editSaving.value = true
  editError.value = null
  try {
    const updated = await api<TaskComment>(
      `/orgs/${props.orgSlug}/projects/${props.projectId}/tasks/${props.taskId}/comments/${comment.id}`,
      { method: 'PATCH', body: { body } },
    )
    replaceComment(updated)
    editSaving.value = false
    editingCommentId.value = null
    editDraft.value = ''
  } catch (e: unknown) {
    editError.value = e instanceof Error ? e.message : 'コメントの更新に失敗しました'
    editSaving.value = false
  }
}

function openDeleteConfirm (comment: TaskComment) {
  if (deletePendingId.value !== null || editSaving.value) {
    return
  }
  deleteTargetCommentId.value = comment.id
  deleteError.value = null
  deleteConfirmOpen.value = true
}

async function confirmDeleteComment () {
  if (props.taskId === null || deleteTargetCommentId.value === null || deletePendingId.value !== null) {
    return
  }

  const commentId = deleteTargetCommentId.value
  deletePendingId.value = commentId
  deleteError.value = null
  try {
    await api(
      `/orgs/${props.orgSlug}/projects/${props.projectId}/tasks/${props.taskId}/comments/${commentId}`,
      { method: 'DELETE' },
    )
    comments.value = comments.value.filter(item => item.id !== commentId)
    if (editingCommentId.value === commentId) {
      cancelEdit()
    }
    deleteConfirmOpen.value = false
    deleteTargetCommentId.value = null
  } catch (e: unknown) {
    deleteError.value = e instanceof Error ? e.message : 'コメントの削除に失敗しました'
  } finally {
    deletePendingId.value = null
  }
}

function toggleReactionMenu (commentId: number) {
  openReactionMenuCommentId.value = openReactionMenuCommentId.value === commentId
    ? null
    : commentId
}

async function toggleReaction (comment: TaskComment, emoji: string) {
  if (props.taskId === null || reactionPendingId.value !== null) {
    return
  }

  reactionPendingId.value = comment.id
  try {
    const updated = await api<TaskComment>(
      `/orgs/${props.orgSlug}/projects/${props.projectId}/tasks/${props.taskId}/comments/${comment.id}/reactions`,
      { method: 'POST', body: { emoji } },
    )
    replaceComment(updated)
    openReactionMenuCommentId.value = null
  } catch (e: unknown) {
    window.alert(e instanceof Error ? e.message : 'リアクションの更新に失敗しました')
  } finally {
    reactionPendingId.value = null
  }
}

defineExpose({ resetComments })
</script>

<style lang="scss" scoped>
.task-detail-chat-pane {
  flex: 1 1 22rem;
  min-width: 18rem;
  display: flex;
  flex-direction: column;
  border-left: 1px solid mixin.$border-light;
  background: #f4f5f7;
}

.chat-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.6rem 0.85rem;
  background: #6b7f94;
  color: mixin.$white;
}

.chat-header-title {
  margin: 0;
  font-size: 0.82rem;
  font-weight: 700;
  line-height: 1;
}

.chat-header-count {
  font-size: 0.68rem;
  font-weight: 700;
  line-height: 1;
  padding: 0.12rem 0.35rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.18);
}

.chat-messages {
  flex: 1 1 auto;
  min-height: 12rem;
  overflow-y: auto;
  padding: 0.85rem 0.85rem 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.chat-state,
.chat-empty {
  margin: auto 0;
  text-align: center;
  color: mixin.$text-muted;
  font-size: 0.86rem;
}

.chat-state--error {
  color: mixin.$danger;
}

.comment-item {
  display: flex;
  align-items: flex-start;
  gap: 0.55rem;
}

.comment-item__body {
  flex: 1;
  min-width: 0;
}

.comment-item__header {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-bottom: 0.35rem;
}

.comment-item__author {
  font-size: 0.86rem;
  font-weight: 800;
  color: mixin.$text;
}

.comment-item__time {
  font-size: 0.78rem;
  font-weight: 600;
  line-height: 1.2;
  color: mixin.$main;
}

.comment-item__edited {
  font-size: 0.74rem;
  color: mixin.$text-muted;
}

.comment-item__card {
  border: 1px solid #dfe1e6;
  border-radius: 8px;
  background: mixin.$white;
  padding: 0.55rem 0.7rem;
}

.comment-item__text {
  margin: 0;
  font-size: 0.88rem;
  line-height: 1.5;
  color: mixin.$text;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.comment-item__edit {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.comment-item__edit-input {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid mixin.$border;
  border-radius: 8px;
  padding: 0.55rem 0.7rem;
  font: inherit;
  font-size: 0.88rem;
  line-height: 1.5;
  resize: vertical;
}

.comment-item__edit-input:focus {
  @include mixin.input-focus-ring;
}

.comment-item__edit-actions {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.comment-item__edit-save,
.comment-item__edit-cancel {
  border: none;
  border-radius: 6px;
  padding: 0.42rem 0.75rem;
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
}

.comment-item__edit-save {
  background: mixin.$main;
  color: mixin.$white;
}

.comment-item__edit-cancel {
  background: transparent;
  color: mixin.$text-sub;
}

.comment-item__edit-save:disabled,
.comment-item__edit-cancel:disabled {
  opacity: 0.55;
  cursor: default;
}

.comment-item__edit-input:disabled {
  cursor: default;
  opacity: 1;
}

.comment-item__edit-error {
  margin: 0;
  color: mixin.$danger;
  font-size: 0.78rem;
}

.comment-item__reactions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.35rem;
}

.comment-item__reaction {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  border: 1px solid #dfe1e6;
  border-radius: 999px;
  padding: 0.15rem 0.45rem;
  background: mixin.$white;
  color: mixin.$text;
  font-size: 0.78rem;
  cursor: pointer;
}

.comment-item__reaction--mine {
  border-color: mixin.$main;
  background: #e8f0ff;
}

.comment-item__reactions .comment-item__reaction:disabled {
  opacity: 0.6;
  cursor: wait;
}

.comment-item__actions {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin-top: 0.35rem;
}

.comment-item__action {
  border: none;
  padding: 0;
  background: transparent;
  color: #5e6c84;
  font-size: 0.78rem;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;

  &:hover:not(:disabled) {
    color: mixin.$text;
    text-decoration: underline;
    text-underline-offset: 0.12em;
  }

  &:disabled {
    opacity: 0.55;
    cursor: default;
  }

  &--emoji {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.35rem;
    height: 1.35rem;
    border-radius: 4px;

    &:hover:not(:disabled) {
      text-decoration: none;
      background: rgba(9, 30, 66, 0.08);
    }
  }
}

.comment-item__reaction-menu-host {
  position: relative;
}

.comment-item__reaction-menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  z-index: 20;
  display: flex;
  gap: 0.2rem;
  padding: 0.35rem;
  border: 1px solid mixin.$border;
  border-radius: 8px;
  background: mixin.$white;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
}

.comment-item__reaction-choice {
  border: none;
  border-radius: 6px;
  width: 1.8rem;
  height: 1.8rem;
  background: transparent;
  font-size: 1rem;
  cursor: pointer;

  &:hover:not(:disabled) {
    background: mixin.$surface-muted;
  }

  &:disabled {
    opacity: 0.55;
    cursor: wait;
  }
}

.comment-item__action-sep {
  color: #97a0af;
  font-size: 0.72rem;
  line-height: 1;
  user-select: none;
}

.chat-composer {
  flex-shrink: 0;
  display: flex;
  align-items: flex-end;
  gap: 0.45rem;
  padding: 0.65rem 0.75rem 0.75rem;
  background: mixin.$white;
  border-top: 1px solid mixin.$border-light;
}

.chat-input {
  flex: 1 1 auto;
  min-height: 2.35rem;
  max-height: 7.5rem;
  resize: none;
  border: 1px solid mixin.$border;
  border-radius: 8px;
  padding: 0.55rem 0.75rem;
  font: inherit;
  font-size: 0.88rem;
  line-height: 1.4;
  background: mixin.$white;
}

.chat-input:focus {
  @include mixin.input-focus-ring;
}

.chat-send-btn {
  flex-shrink: 0;
  border: none;
  border-radius: 8px;
  padding: 0.55rem 0.85rem;
  background: mixin.$main;
  color: mixin.$white;
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
}

.chat-send-btn:hover:not(:disabled) {
  background: mixin.$main-hover;
}

.chat-send-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.chat-send-error {
  margin: 0;
  padding: 0 0.75rem 0.65rem;
  color: mixin.$danger;
  font-size: 0.78rem;
  font-weight: 700;
}

@media (max-width: 62rem) {
  .task-detail-chat-pane {
    min-height: 18rem;
    border-left: none;
    border-top: 1px solid mixin.$border-light;
  }
}
</style>
