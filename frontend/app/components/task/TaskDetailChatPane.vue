<template>
  <aside class="task-detail-chat-pane" aria-label="コメント">
    <header class="chat-header">
      <h4 class="chat-header-title">コメント</h4>
      <span v-if="comments.length" class="chat-header-count">{{ comments.length }}</span>
    </header>
    <div
      class="chat-messages"
      aria-live="polite"
      aria-relevant="additions"
    >
      <div
        ref="chatMessagesRef"
        class="chat-messages__scroller"
      >
        <div class="chat-messages__body">
      <p v-if="commentsLoading" class="chat-state">読み込み中...</p>
      <p v-else-if="commentsLoadError" class="chat-state chat-state--error">{{ commentsLoadError }}</p>
      <template v-else-if="comments.length">
        <article
          v-for="comment in comments"
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
            <div class="mention-picker-host comment-item__edit-host">
              <ul
                v-if="mentionMenuOpen && mentionTarget === 'edit'"
                class="mention-menu"
                role="listbox"
                aria-label="メンション"
              >
                <li v-if="showAllMentionOption">
                  <button
                    type="button"
                    class="mention-menu__item"
                    role="option"
                    @mousedown.prevent="insertAllMention"
                  >
                    @all
                  </button>
                </li>
                <li v-for="member in filteredMentionCandidates" :key="member.id">
                  <button
                    type="button"
                    class="mention-menu__item"
                    role="option"
                    @mousedown.prevent="insertMemberMention(member)"
                  >
                    {{ memberDisplayName(member) }}
                  </button>
                </li>
                <li
                  v-if="!showAllMentionOption && !filteredMentionCandidates.length"
                  class="mention-menu__empty"
                >
                  メンバーがいません
                </li>
              </ul>
              <div
                :ref="setEditInputRef"
                class="comment-item__edit-input comment-input--rich"
                role="textbox"
                aria-multiline="true"
                :contenteditable="editSaving ? 'false' : 'true'"
                :aria-disabled="editSaving"
                @input="onEditInput"
                @keydown="onEditKeydown"
                @paste="onRichPaste"
              />
            </div>
            <div class="comment-item__edit-actions">
              <button
                type="button"
                class="comment-item__edit-save"
                :disabled="!editDraft.trim() || editSaving"
                @click="saveEdit(comment)"
              >
                保存
              </button>
              <button
                type="button"
                class="comment-item__edit-cancel"
                :disabled="editSaving"
                @click="cancelEdit"
              >
                キャンセル
              </button>
            </div>
            <p v-if="editError" class="comment-item__edit-error">{{ editError }}</p>
          </div>
          <div v-else class="comment-item__card">
            <p class="comment-item__text" v-html="formatCommentBody(comment.body)" />
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
          <footer class="comment-item__actions">
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
            <template v-if="isCommentMine(comment)">
              <button
                type="button"
                class="comment-item__action"
                @click="startEdit(comment)"
              >
                編集
              </button>
              <span class="comment-item__action-sep" aria-hidden="true">•</span>
              <div class="comment-item__delete-menu-host">
                <button
                  type="button"
                  class="comment-item__action"
                  :class="{ 'comment-item__action--active': openDeleteMenuCommentId === comment.id }"
                  :aria-expanded="openDeleteMenuCommentId === comment.id"
                  aria-haspopup="dialog"
                  @click="toggleDeleteMenu(comment.id, $event)"
                >
                  削除
                </button>
              </div>
            </template>
          </footer>
        </div>
      </article>
      </template>
      <p v-else class="chat-state chat-state--empty">コメントはありません</p>
        </div>
      </div>
    </div>
    <footer class="chat-composer">
      <div class="mention-picker-host chat-composer__input-host">
        <ul
          v-if="mentionMenuOpen && mentionTarget === 'composer'"
          class="mention-menu"
          role="listbox"
          aria-label="メンション"
        >
          <li v-if="showAllMentionOption">
            <button
              type="button"
              class="mention-menu__item"
              role="option"
              @mousedown.prevent="insertAllMention"
            >
              @all
            </button>
          </li>
          <li v-for="member in filteredMentionCandidates" :key="member.id">
            <button
              type="button"
              class="mention-menu__item"
              role="option"
              @mousedown.prevent="insertMemberMention(member)"
            >
              {{ memberDisplayName(member) }}
            </button>
          </li>
          <li
            v-if="!showAllMentionOption && !filteredMentionCandidates.length"
            class="mention-menu__empty"
          >
            メンバーがいません
          </li>
        </ul>
        <div
          ref="commentInputRef"
          class="chat-input comment-input--rich"
          :class="{ 'is-empty': !commentDraft.trim() }"
          role="textbox"
          aria-multiline="true"
          data-placeholder="コメントを入力..."
          :contenteditable="composerDisabled ? 'false' : 'true'"
          :aria-disabled="composerDisabled"
          @input="onComposerInput"
          @keydown="onComposerKeydown"
          @paste="onRichPaste"
        />
      </div>
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
    <Teleport to="body">
      <div
        v-if="openDeleteMenuComment"
        ref="deleteMenuRef"
        class="comment-item__delete-menu"
        :style="deleteMenuStyle"
        role="dialog"
        aria-label="コメントの削除"
      >
        <p
          class="comment-item__delete-menu-message"
          :class="{ 'comment-item__delete-menu-message--error': deleteError }"
        >
          <template v-if="deleteError">{{ deleteError }}</template>
          <template v-else>
            このコメントを削除します。よろしいですか？
          </template>
        </p>
        <button
          type="button"
          class="comment-item__delete-menu-btn"
          :disabled="deletePendingId === openDeleteMenuComment.id"
          @click="confirmDeleteComment(openDeleteMenuComment)"
        >
          削除
        </button>
      </div>
    </Teleport>
  </aside>
</template>
<script setup lang="ts">
import { Smile } from 'lucide-vue-next'
import { COMMENT_BODY_MAX_LENGTH } from '../../constants/fieldLengthLimits'
import { useApi } from '../../composables/useApi'
import { syncAppLoadingCursor } from '../../composables/useAppLoadingCursor'
import { useCurrentUser } from '../../composables/useCurrentUser'
import { useDropdownEscapeClose } from '../../composables/useDropdownEscapeClose'
import { useExclusivePopover } from '../../composables/useExclusivePopover'
import { POPOVER_VIEWPORT_INSET } from '../../utils/popoverScrollbar'
import { didPointerGestureStartInsideFloatingPopover } from '../../utils/uiInteraction'
import { memberDisplayName, memberMatchesSearchQuery, type MemberLike } from '../../composables/useMemberDisplay'
import type { TaskCommentReaction, TaskDetailComment } from './taskCommentTypes'
type TaskComment = TaskDetailComment
const props = defineProps<{
  orgSlug: string
  workspaceId: string
  taskId: number | null
  workspaceMembers: MemberLike[]
  /** ボード画面で取得済みのコメント（あれば読み込み表示を出さない） */
  initialComments?: TaskComment[] | null
}>()
const emit = defineEmits<{
  'comments-updated': [{ taskId: number; comments: TaskComment[] }]
}>()
const { api } = useApi()
const { currentUserId, ensureCurrentUser } = useCurrentUser()
const reactionChoices = ['👍', '😄', '🎉', '❤️', '👀', '🚀']
const DELETE_MENU_ANCHOR_GAP = 4
const DELETE_MENU_DEFAULT_WIDTH_PX = 208
const comments = ref<TaskComment[]>([])
const commentsLoading = ref(false)
const commentsLoadError = ref<string | null>(null)
const commentDraft = ref('')
const commentSending = ref(false)
const commentSendError = ref<string | null>(null)
const chatMessagesRef = ref<HTMLElement | null>(null)
const commentInputRef = ref<HTMLElement | null>(null)
const editInputRef = ref<HTMLElement | null>(null)
function setEditInputRef (el: unknown) {
  editInputRef.value = el instanceof HTMLElement ? el : null
}
const editingCommentId = ref<number | null>(null)
const editDraft = ref('')
const editSaving = ref(false)
const editError = ref<string | null>(null)
const deletePendingId = ref<number | null>(null)
const deleteError = ref<string | null>(null)
const reactionPendingId = ref<number | null>(null)
const openReactionMenuCommentId = ref<number | null>(null)
const openDeleteMenuCommentId = ref<number | null>(null)
const deleteMenuAnchorEl = ref<HTMLElement | null>(null)
const deleteMenuRef = ref<HTMLElement | null>(null)
const deleteMenuStyle = ref<Record<string, string>>({})
const mentionMenuOpen = ref(false)
const mentionTarget = ref<'composer' | 'edit' | null>(null)
const mentionQuery = ref('')
const composerDisabled = computed(() => (
  commentSending.value || commentsLoading.value || !!commentsLoadError.value || !props.taskId
))
const openDeleteMenuComment = computed(() => {
  const commentId = openDeleteMenuCommentId.value
  if (commentId === null) {
    return null
  }
  return comments.value.find(comment => comment.id === commentId) ?? null
})
let removeDeleteMenuListeners: (() => void) | null = null
const chatMutationPending = computed(() => (
  commentsLoading.value
  || commentSending.value
  || editSaving.value
  || deletePendingId.value !== null
  || reactionPendingId.value !== null
))
syncAppLoadingCursor(chatMutationPending)
watch(
  () => [props.taskId, props.initialComments] as const,
  async ([taskId, initialComments]) => {
    resetComments()
    if (taskId === null) {
      return
    }
    if (initialComments != null) {
      comments.value = [...initialComments]
      commentsLoading.value = false
      void ensureCurrentUser()
      nextTick(() => scrollChatToBottom())
      void refreshCommentsSilently()
      return
    }
    await Promise.all([ensureCurrentUser(), loadComments()])
  },
  { immediate: true },
)
onMounted(() => {
  document.addEventListener('mouseup', onDocumentClick)
})
onBeforeUnmount(() => {
  document.removeEventListener('mouseup', onDocumentClick)
  unbindDeleteMenuListeners()
})
function closeDeleteMenu () {
  openDeleteMenuCommentId.value = null
  deleteError.value = null
  deleteMenuAnchorEl.value = null
}
const anyCommentMenuOpen = computed(() => (
  openDeleteMenuCommentId.value !== null
  || openReactionMenuCommentId.value !== null
  || mentionMenuOpen.value
))
function closeCommentMenus () {
  closeDeleteMenu()
  openReactionMenuCommentId.value = null
  closeMentionMenu()
}
useDropdownEscapeClose(anyCommentMenuOpen, closeCommentMenus)
useExclusivePopover(anyCommentMenuOpen, closeCommentMenus)
function updateDeleteMenuPosition () {
  nextTick(() => {
    requestAnimationFrame(() => {
      const anchor = deleteMenuAnchorEl.value
      const menu = deleteMenuRef.value
      if (!anchor || !menu) {
        return
      }
      const pad = POPOVER_VIEWPORT_INSET
      const gap = DELETE_MENU_ANCHOR_GAP
      const anchorRect = anchor.getBoundingClientRect()
      const menuWidth = menu.offsetWidth || menu.getBoundingClientRect().width || DELETE_MENU_DEFAULT_WIDTH_PX
      const menuHeight = menu.offsetHeight || menu.getBoundingClientRect().height
      let left = anchorRect.left
      if (left + menuWidth > window.innerWidth - pad) {
        left = Math.max(pad, window.innerWidth - pad - menuWidth)
      }
      if (left < pad) {
        left = pad
      }
      let top = anchorRect.bottom + gap
      if (top + menuHeight > window.innerHeight - pad) {
        top = Math.max(pad, anchorRect.top - gap - menuHeight)
      }
      deleteMenuStyle.value = {
        position: 'fixed',
        top: `${Math.round(top)}px`,
        left: `${Math.round(left)}px`,
        zIndex: '210',
      }
    })
  })
}
function bindDeleteMenuListeners () {
  unbindDeleteMenuListeners()
  const onReposition = () => updateDeleteMenuPosition()
  chatMessagesRef.value?.addEventListener('scroll', onReposition, { passive: true })
  window.addEventListener('resize', onReposition)
  window.addEventListener('scroll', onReposition, true)
  removeDeleteMenuListeners = () => {
    chatMessagesRef.value?.removeEventListener('scroll', onReposition)
    window.removeEventListener('resize', onReposition)
    window.removeEventListener('scroll', onReposition, true)
  }
}
function unbindDeleteMenuListeners () {
  removeDeleteMenuListeners?.()
  removeDeleteMenuListeners = null
}
function onDocumentClick (event: MouseEvent) {
  if (didPointerGestureStartInsideFloatingPopover()) {
    return
  }
  const target = event.target as HTMLElement
  if (!target.closest('.comment-item__reaction-menu-host')) {
    openReactionMenuCommentId.value = null
  }
  if (!target.closest('.mention-picker-host')) {
    closeMentionMenu()
  }
  if (
    openDeleteMenuCommentId.value !== null
    && deletePendingId.value === null
    && !target.closest('.comment-item__delete-menu-host')
    && !target.closest('.comment-item__delete-menu')
  ) {
    closeDeleteMenu()
  }
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
  deleteError.value = null
  reactionPendingId.value = null
  openReactionMenuCommentId.value = null
  openDeleteMenuCommentId.value = null
  deleteMenuAnchorEl.value = null
  unbindDeleteMenuListeners()
  closeMentionMenu()
  clearRichEditor(commentInputRef.value)
}
function escapeHtmlText (value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
function mentionChipHtml (mention: string, label: string): string {
  return `<span class="comment-mention" contenteditable="false" data-mention="${escapeHtmlText(mention)}">@${escapeHtmlText(label)}</span>`
}
function formatCommentBody (body: string): string {
  const escaped = body
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  const withAll = escaped.replace(
    /@\[all\]/g,
    () => mentionChipHtml('all', 'all'),
  )
  const withCompactMentions = withAll.replace(
    /@\[user:(\d+)\]/g,
    (_match, userId: string) => {
      const member = props.workspaceMembers.find(item => item.id === Number(userId))
      const label = member ? memberDisplayName(member) : `user:${userId}`
      return mentionChipHtml(`user:${userId}`, label)
    },
  )
  return withCompactMentions.replace(
    /@\[([^\]]+)\]\(user:(\d+)\)/g,
    (_match, label: string, userId: string) => mentionChipHtml(`user:${userId}`, label),
  )
}
function bodyToEditableHtml (body: string): string {
  return formatCommentBody(body).replace(/\n/g, '<br>')
}
function serializeRichEditor (root: HTMLElement): string {
  let out = ''
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      out += node.textContent ?? ''
      return
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return
    }
    const el = node as HTMLElement
    const mention = el.dataset.mention
    if (mention === 'all') {
      out += '@[all]'
      return
    }
    if (mention?.startsWith('user:')) {
      out += `@[${mention}]`
      return
    }
    if (el.tagName === 'BR') {
      out += '\n'
      return
    }
    const isBlock = el.tagName === 'DIV' || el.tagName === 'P'
    if (isBlock && out && !out.endsWith('\n')) {
      out += '\n'
    }
    Array.from(el.childNodes).forEach(walk)
  }
  Array.from(root.childNodes).forEach(walk)
  return out.replace(/\u00a0/g, ' ')
}
function clearRichEditor (el: HTMLElement | null) {
  if (!el) {
    return
  }
  el.innerHTML = ''
}
function syncDraftFromEditor (target: 'composer' | 'edit') {
  const el = target === 'composer' ? commentInputRef.value : editInputRef.value
  if (!el) {
    return
  }
  const serialized = serializeRichEditor(el)
  if (target === 'composer') {
    commentDraft.value = serialized
  } else {
    editDraft.value = serialized
  }
}
function closeMentionMenu () {
  mentionMenuOpen.value = false
  mentionTarget.value = null
  mentionQuery.value = ''
}
const filteredMentionCandidates = computed(() => {
  return props.workspaceMembers.filter(member => memberMatchesSearchQuery(member, mentionQuery.value))
})
const showAllMentionOption = computed(() => {
  const q = mentionQuery.value.trim().toLowerCase()
  return !q || 'all'.startsWith(q) || '@all'.startsWith(q)
})
type MentionTrigger = {
  query: string
  textNode: Text
  startOffset: number
  endOffset: number
}
function getMentionTrigger (root: HTMLElement): MentionTrigger | null {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) {
    return null
  }
  const node = selection.anchorNode
  if (!node || node.nodeType !== Node.TEXT_NODE || !root.contains(node)) {
    return null
  }
  if ((node.parentElement)?.closest('[data-mention]')) {
    return null
  }
  const textNode = node as Text
  const endOffset = selection.anchorOffset
  const textBefore = (textNode.textContent ?? '').slice(0, endOffset)
  const match = textBefore.match(/@([^\s@]*)$/)
  if (!match) {
    return null
  }
  const startOffset = endOffset - match[0].length
  if (startOffset > 0) {
    const prev = textBefore.charAt(startOffset - 1)
    if (prev && !/\s/.test(prev)) {
      return null
    }
  }
  return {
    query: match[1] ?? '',
    textNode,
    startOffset,
    endOffset,
  }
}
function updateMentionMenuFromEditor (target: 'composer' | 'edit') {
  const el = target === 'composer' ? commentInputRef.value : editInputRef.value
  if (!el || (target === 'composer' && composerDisabled.value) || (target === 'edit' && editSaving.value)) {
    closeMentionMenu()
    return
  }
  const trigger = getMentionTrigger(el)
  if (!trigger) {
    closeMentionMenu()
    return
  }
  mentionTarget.value = target
  mentionQuery.value = trigger.query
  mentionMenuOpen.value = true
  closeDeleteMenu()
  openReactionMenuCommentId.value = null
}
function createMentionChipElement (mention: string, label: string): HTMLSpanElement {
  const chip = document.createElement('span')
  chip.className = 'comment-mention'
  chip.contentEditable = 'false'
  chip.dataset.mention = mention
  chip.textContent = `@${label}`
  return chip
}
function insertMentionChip (mention: string, label: string) {
  const target = mentionTarget.value
  if (!target) {
    return
  }
  const root = target === 'composer' ? commentInputRef.value : editInputRef.value
  if (!root) {
    return
  }
  root.focus()
  const trigger = getMentionTrigger(root)
  const chip = createMentionChipElement(mention, label)
  const space = document.createTextNode('\u00a0')
  if (trigger) {
    const range = document.createRange()
    range.setStart(trigger.textNode, trigger.startOffset)
    range.setEnd(trigger.textNode, trigger.endOffset)
    range.deleteContents()
    range.insertNode(space)
    range.insertNode(chip)
  } else {
    root.appendChild(chip)
    root.appendChild(space)
  }
  const selection = window.getSelection()
  if (selection) {
    const after = document.createRange()
    after.setStartAfter(space)
    after.collapse(true)
    selection.removeAllRanges()
    selection.addRange(after)
  }
  syncDraftFromEditor(target)
  if (target === 'composer') {
    adjustCommentInputHeight()
  }
  closeMentionMenu()
}
function insertAllMention () {
  insertMentionChip('all', 'all')
}
function insertMemberMention (member: MemberLike) {
  insertMentionChip(`user:${member.id}`, memberDisplayName(member))
}
function onRichPaste (event: ClipboardEvent) {
  event.preventDefault()
  const text = event.clipboardData?.getData('text/plain') ?? ''
  if (!text) {
    return
  }
  document.execCommand('insertText', false, text)
}
function enforceBodyMaxLength (target: 'composer' | 'edit') {
  const el = target === 'composer' ? commentInputRef.value : editInputRef.value
  if (!el) {
    return
  }
  const serialized = serializeRichEditor(el)
  if (serialized.length <= COMMENT_BODY_MAX_LENGTH) {
    return
  }
  // 超過時は直前状態へ戻すのが難しいため、プレーンテキスト化して切り詰める
  el.textContent = serialized.slice(0, COMMENT_BODY_MAX_LENGTH)
  syncDraftFromEditor(target)
}
function onComposerInput () {
  syncDraftFromEditor('composer')
  enforceBodyMaxLength('composer')
  adjustCommentInputHeight()
  updateMentionMenuFromEditor('composer')
}
function onEditInput () {
  syncDraftFromEditor('edit')
  enforceBodyMaxLength('edit')
  updateMentionMenuFromEditor('edit')
}
function selectFirstMentionOption () {
  if (showAllMentionOption.value) {
    insertAllMention()
    return
  }
  const first = filteredMentionCandidates.value[0]
  if (first) {
    insertMemberMention(first)
  }
}
function onComposerKeydown (event: KeyboardEvent) {
  if (mentionMenuOpen.value && mentionTarget.value === 'composer') {
    if (event.key === 'Escape') {
      event.preventDefault()
      closeMentionMenu()
      return
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      selectFirstMentionOption()
      return
    }
  }
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    void sendComment()
  }
}
function onEditKeydown (event: KeyboardEvent) {
  if (mentionMenuOpen.value && mentionTarget.value === 'edit') {
    if (event.key === 'Escape') {
      event.preventDefault()
      closeMentionMenu()
      return
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      selectFirstMentionOption()
    }
  }
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
  const member = props.workspaceMembers.find(item => item.id === comment.author_id)
  if (member) {
    return memberDisplayName(member)
  }
  return `ユーザー #${comment.author_id}`
}
function isCommentMine (comment: TaskComment): boolean {
  return currentUserId.value !== null && currentUserId.value === comment.author_id
}
function reactionTooltip (reaction: TaskCommentReaction): string {
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
function notifyCommentsUpdated () {
  if (props.taskId === null) {
    return
  }
  emit('comments-updated', { taskId: props.taskId, comments: [...comments.value] })
}
function replaceComment (updated: TaskComment) {
  comments.value = comments.value.map(comment => (
    comment.id === updated.id ? updated : comment
  ))
  notifyCommentsUpdated()
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
  el.style.height = `${Math.min(Math.max(el.scrollHeight, 36), 120)}px`
}
async function loadComments () {
  if (props.taskId === null) {
    return
  }
  commentsLoading.value = true
  commentsLoadError.value = null
  try {
    const res = await api<{ data: TaskComment[] }>(
      `/orgs/${props.orgSlug}/workspaces/${props.workspaceId}/tasks/${props.taskId}/comments`,
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
async function refreshCommentsSilently () {
  if (props.taskId === null) {
    return
  }
  try {
    const res = await api<{ data: TaskComment[] }>(
      `/orgs/${props.orgSlug}/workspaces/${props.workspaceId}/tasks/${props.taskId}/comments`,
    )
    if (props.taskId === null) {
      return
    }
    comments.value = res.data ?? []
    commentsLoadError.value = null
    nextTick(() => scrollChatToBottom())
  } catch {
    // 初期表示を維持する
  }
}
async function sendComment () {
  if (props.taskId === null) {
    return
  }
  if (commentInputRef.value) {
    syncDraftFromEditor('composer')
  }
  const body = commentDraft.value.trim()
  if (!body || commentSending.value || body.length > COMMENT_BODY_MAX_LENGTH) {
    return
  }
  commentSending.value = true
  commentSendError.value = null
  closeMentionMenu()
  try {
    const created = await api<TaskComment>(
      `/orgs/${props.orgSlug}/workspaces/${props.workspaceId}/tasks/${props.taskId}/comments`,
      { method: 'POST', body: { body } },
    )
    comments.value = [...comments.value, created]
    notifyCommentsUpdated()
    commentDraft.value = ''
    clearRichEditor(commentInputRef.value)
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
  closeDeleteMenu()
  closeMentionMenu()
  nextTick(() => {
    const el = editInputRef.value
    if (!el) {
      return
    }
    el.innerHTML = bodyToEditableHtml(comment.body)
    el.focus()
  })
}
function cancelEdit () {
  if (editSaving.value) {
    return
  }
  editingCommentId.value = null
  editDraft.value = ''
  editError.value = null
  closeMentionMenu()
}
async function saveEdit (comment: TaskComment) {
  if (props.taskId === null || editSaving.value) {
    return
  }
  if (editInputRef.value) {
    syncDraftFromEditor('edit')
  }
  const body = editDraft.value.trim()
  if (!body || body.length > COMMENT_BODY_MAX_LENGTH) {
    return
  }
  editSaving.value = true
  editError.value = null
  closeMentionMenu()
  try {
    const updated = await api<TaskComment>(
      `/orgs/${props.orgSlug}/workspaces/${props.workspaceId}/tasks/${props.taskId}/comments/${comment.id}`,
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
function toggleDeleteMenu (commentId: number, event?: Event) {
  if (deletePendingId.value !== null || editSaving.value) {
    return
  }
  if (openDeleteMenuCommentId.value === commentId) {
    closeDeleteMenu()
    return
  }
  const fromEvent = event?.currentTarget
  deleteMenuAnchorEl.value = fromEvent instanceof HTMLElement ? fromEvent : null
  openDeleteMenuCommentId.value = commentId
  deleteError.value = null
  openReactionMenuCommentId.value = null
  bindDeleteMenuListeners()
  updateDeleteMenuPosition()
}
async function confirmDeleteComment (comment: TaskComment) {
  if (props.taskId === null || deletePendingId.value !== null) {
    return
  }
  const commentId = comment.id
  deletePendingId.value = commentId
  deleteError.value = null
  try {
    await api(
      `/orgs/${props.orgSlug}/workspaces/${props.workspaceId}/tasks/${props.taskId}/comments/${commentId}`,
      { method: 'DELETE' },
    )
    comments.value = comments.value.filter(item => item.id !== commentId)
    notifyCommentsUpdated()
    if (editingCommentId.value === commentId) {
      cancelEdit()
    }
    closeDeleteMenu()
  } catch (e: unknown) {
    deleteError.value = e instanceof Error ? e.message : 'コメントの削除に失敗しました'
    updateDeleteMenuPosition()
  } finally {
    deletePendingId.value = null
  }
}
function toggleReactionMenu (commentId: number) {
  openReactionMenuCommentId.value = openReactionMenuCommentId.value === commentId
    ? null
    : commentId
  if (openReactionMenuCommentId.value !== null) {
    closeDeleteMenu()
  }
}
async function toggleReaction (comment: TaskComment, emoji: string) {
  if (props.taskId === null || reactionPendingId.value !== null) {
    return
  }
  reactionPendingId.value = comment.id
  try {
    const updated = await api<TaskComment>(
      `/orgs/${props.orgSlug}/workspaces/${props.workspaceId}/tasks/${props.taskId}/comments/${comment.id}/reactions`,
      { method: 'POST', body: { emoji } },
    )
    replaceComment(updated)
    openReactionMenuCommentId.value = null
    closeDeleteMenu()
  } catch (e: unknown) {
    window.alert(e instanceof Error ? e.message : 'リアクションの更新に失敗しました')
  } finally {
    reactionPendingId.value = null
  }
}
watch(openDeleteMenuCommentId, (commentId) => {
  if (commentId === null) {
    unbindDeleteMenuListeners()
    return
  }
  updateDeleteMenuPosition()
})
watch(deleteError, () => {
  if (openDeleteMenuCommentId.value !== null) {
    updateDeleteMenuPosition()
  }
})
defineExpose({ resetComments })
</script>
<style lang="scss" scoped src="~/assets/styles/components/task/TaskDetailChatPane.scss"></style>
