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
      <p v-else-if="!commentGroups.length" class="chat-empty">コメントはまだありません</p>
      <template v-else>
        <template v-for="group in commentGroups" :key="group.dateKey">
          <div class="chat-date-divider">
            <span>{{ group.dateLabel }}</span>
          </div>
          <div
            v-for="comment in group.comments"
            :key="comment.id"
            class="chat-message-row"
            :class="{ 'chat-message-row--mine': isCommentMine(comment) }"
          >
            <MemberAvatar
              v-if="!isCommentMine(comment)"
              :member="resolveCommentAuthor(comment.author_id) ?? fallbackAuthor(comment)"
              size="sm"
              decorative
            />
            <div class="chat-message-body">
              <p
                v-if="!isCommentMine(comment)"
                class="chat-author-name"
              >
                {{ commentAuthorName(comment) }}
              </p>
              <div class="chat-bubble-wrap">
                <div
                  class="chat-bubble"
                  :class="{ 'chat-bubble--mine': isCommentMine(comment) }"
                >
                  <p class="chat-bubble-text">{{ comment.body }}</p>
                </div>
                <time
                  class="chat-time"
                  :datetime="comment.created_at"
                >
                  {{ formatCommentTime(comment.created_at) }}
                </time>
              </div>
            </div>
          </div>
        </template>
      </template>
    </div>

    <footer class="chat-composer">
      <textarea
        ref="commentInputRef"
        v-model.trim="commentDraft"
        class="chat-input"
        rows="1"
        placeholder="メッセージを入力してください"
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
  </aside>
</template>

<script setup lang="ts">
import { useApi } from '../composables/useApi'
import { memberDisplayName, type MemberLike } from '../composables/useMemberDisplay'

type TaskComment = {
  id: number
  author_id: number
  body: string
  created_at: string
}

type CurrentUser = {
  id: number
  name: string | null
  email: string | null
  avatar_url: string | null
}

type CommentGroup = {
  dateKey: string
  dateLabel: string
  comments: TaskComment[]
}

const props = defineProps<{
  orgSlug: string
  projectId: string
  taskId: number | null
  projectMembers: MemberLike[]
}>()

const { api } = useApi()

const comments = ref<TaskComment[]>([])
const commentsLoading = ref(false)
const commentsLoadError = ref<string | null>(null)
const commentDraft = ref('')
const commentSending = ref(false)
const commentSendError = ref<string | null>(null)
const currentUser = ref<CurrentUser | null>(null)
const chatMessagesRef = ref<HTMLElement | null>(null)
const commentInputRef = ref<HTMLTextAreaElement | null>(null)

const commentGroups = computed((): CommentGroup[] => {
  const groups: CommentGroup[] = []
  let current: CommentGroup | null = null

  for (const comment of comments.value) {
    const dateKey = comment.created_at.slice(0, 10)
    const dateLabel = commentDateLabel(comment.created_at)
    if (!current || current.dateKey !== dateKey) {
      current = { dateKey, dateLabel, comments: [] }
      groups.push(current)
    }
    current.comments.push(comment)
  }

  return groups
})

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

function resetComments () {
  comments.value = []
  commentsLoading.value = false
  commentsLoadError.value = null
  commentDraft.value = ''
  commentSending.value = false
  commentSendError.value = null
}

function resolveCommentAuthor (authorId: number): MemberLike | null {
  if (currentUser.value?.id === authorId) {
    return currentUser.value
  }
  return props.projectMembers.find(member => member.id === authorId) ?? null
}

function fallbackAuthor (comment: TaskComment): MemberLike {
  return {
    id: comment.author_id,
    name: null,
    email: null,
    avatar_url: null,
  }
}

function isCommentMine (comment: TaskComment): boolean {
  return currentUser.value?.id === comment.author_id
}

function commentAuthorName (comment: TaskComment): string {
  const author = resolveCommentAuthor(comment)
  if (!author) {
    return `ユーザー #${comment.author_id}`
  }
  return memberDisplayName(author)
}

function commentDateLabel (iso: string): string {
  const date = new Date(iso)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)

  const dateKey = (value: Date) => `${value.getFullYear()}-${value.getMonth()}-${value.getDate()}`
  if (dateKey(date) === dateKey(today)) {
    return '今日'
  }
  if (dateKey(date) === dateKey(yesterday)) {
    return '昨日'
  }

  const y = date.getFullYear()
  const m = date.getMonth() + 1
  const d = date.getDate()
  return `${y}/${m}/${d}`
}

function formatCommentTime (iso: string): string {
  const date = new Date(iso)
  return `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`
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
    currentUser.value = await api<CurrentUser>('/me')
  } catch {
    currentUser.value = null
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

defineExpose({ resetComments })
</script>

<style lang="scss" scoped>
.task-detail-chat-pane {
  flex: 1 1 22rem;
  min-width: 18rem;
  display: flex;
  flex-direction: column;
  border-left: 1px solid #dbe3ea;
  background: #eceff1;
}

.chat-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.4rem 0.85rem;
  background: #6b7f94;
  color: #fff;
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
  padding: 0.85rem 0.75rem 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.chat-state,
.chat-empty {
  margin: auto 0;
  text-align: center;
  color: #64748b;
  font-size: 0.86rem;
}

.chat-state--error {
  color: #b91c1c;
}

.chat-date-divider {
  display: flex;
  justify-content: center;
  margin: 0.35rem 0 0.15rem;
}

.chat-date-divider span {
  padding: 0.18rem 0.65rem;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.12);
  color: #475569;
  font-size: 0.72rem;
  font-weight: 700;
}

.chat-message-row {
  display: flex;
  align-items: flex-start;
  gap: 0.45rem;
  max-width: 100%;
}

.chat-message-row--mine {
  flex-direction: row-reverse;
}

.chat-message-body {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  max-width: calc(100% - 2.5rem);
}

.chat-message-row--mine .chat-message-body {
  align-items: flex-end;
}

.chat-author-name {
  margin: 0;
  padding: 0 0.35rem;
  font-size: 0.72rem;
  font-weight: 700;
  color: #475569;
}

.chat-bubble-wrap {
  display: flex;
  align-items: flex-end;
  gap: 0.35rem;
  max-width: 100%;
}

.chat-message-row--mine .chat-bubble-wrap {
  flex-direction: row-reverse;
}

.chat-bubble {
  padding: 0.55rem 0.75rem;
  border-radius: 1rem;
  background: #fff;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
  max-width: min(18rem, 100%);
}

.chat-bubble--mine {
  background: #95ec69;
  border-radius: 1rem 1rem 0.25rem 1rem;
}

.chat-message-row:not(.chat-message-row--mine) .chat-bubble {
  border-radius: 1rem 1rem 1rem 0.25rem;
}

.chat-bubble-text {
  margin: 0;
  font-size: 0.88rem;
  line-height: 1.45;
  color: #0f172a;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.chat-time {
  flex-shrink: 0;
  font-size: 0.68rem;
  color: #64748b;
  line-height: 1.2;
}

.chat-composer {
  flex-shrink: 0;
  display: flex;
  align-items: flex-end;
  gap: 0.45rem;
  padding: 0.65rem 0.75rem 0.75rem;
  background: #fff;
  border-top: 1px solid #dbe3ea;
}

.chat-input {
  flex: 1 1 auto;
  min-height: 2.35rem;
  max-height: 7.5rem;
  resize: none;
  border: 1px solid #cbd5e1;
  border-radius: 1.1rem;
  padding: 0.55rem 0.85rem;
  font: inherit;
  font-size: 0.88rem;
  line-height: 1.4;
  background: #f8fafc;
}

.chat-input:focus {
  outline: none;
  border-color: #6b7f94;
  background: #fff;
}

.chat-send-btn {
  flex-shrink: 0;
  border: none;
  border-radius: 999px;
  padding: 0.55rem 0.9rem;
  background: #06c755;
  color: #fff;
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
}

.chat-send-btn:hover:not(:disabled) {
  background: #05b34c;
}

.chat-send-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.chat-send-error {
  margin: 0;
  padding: 0 0.75rem 0.65rem;
  color: #b91c1c;
  font-size: 0.78rem;
  font-weight: 700;
}

@media (max-width: 62rem) {
  .task-detail-chat-pane {
    min-height: 18rem;
    border-left: none;
    border-top: 1px solid #dbe3ea;
  }
}
</style>
