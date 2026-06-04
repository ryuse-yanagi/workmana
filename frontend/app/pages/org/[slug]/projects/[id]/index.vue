<template>
  <main
    class="board-page"
    :style="boardPageCssVars"
  >
    <template v-if="fatalLoadError">
      <section class="load-fatal-panel">
        <p class="load-fatal-message">{{ fatalLoadError }}</p>
        <button type="button" class="load-fatal-retry" @click="retryBoardLoad">
          再試行
        </button>
      </section>
    </template>

    <template v-else>
      <header class="page-header">
        <div class="subheader">
          <NuxtLink :to="`/org/${slug}`" class="subheader-title subheader-back-link">
            &lt; {{ workUnitListLabel }}
          </NuxtLink>
          <div class="subheader-filters">
            <select v-model="labelFilterId" class="header-sort" aria-label="ラベル絞り込み">
              <option value="">全ラベル</option>
              <option v-for="label in orgLabels" :key="label.id" :value="String(label.id)">
                {{ label.name }}
              </option>
            </select>
            <p class="subheader-count" aria-live="polite">{{ visibleTaskCount }} 件</p>
            <input
              v-model.trim="searchQuery"
              class="header-search"
              type="search"
              placeholder="カード名で検索"
              aria-label="カード名検索"
            />
          </div>
          <NuxtLink
            class="header-primary-btn header-primary-btn--icon-group linkish"
            :to="`/org/${slug}/projects/${projectId}/archived`"
            aria-label="アーカイブ済みカード"
            title="アーカイブ済みカード"
          >
            <Trash2 :size="24" :stroke-width="2.25" aria-hidden="true" />
            <NotebookText :size="24" :stroke-width="2.25" aria-hidden="true" />
            <Workflow :size="24" :stroke-width="2.25" aria-hidden="true" />
          </NuxtLink>
        </div>
      </header>

      <div v-if="!pageReady" class="page-await-spacer" aria-busy="true" />

      <Transition v-else name="tm-fade" appear>
        <div key="board-body" class="page-shell-fade">
          <p v-if="error" class="err">{{ error }}</p>

          <section
            class="board"
            :class="{
              'board-dragging': boardDragging,
              'board-drag-cross-list': boardDragCrossList,
              'board-dragging--tail-zone': boardDragPreviewMode === 'tail',
              'board-list-dragging': listColumnDragging,
            }"
          >
            <div class="board-columns">
            <draggable
              v-model="lists"
              item-key="key"
              class="board-lists-sortable"
              group="board-lists"
              direction="horizontal"
              draggable=".list-column"
              :animation="180"
              :delay="0"
              :delay-on-touch-only="false"
              :touch-start-threshold="0"
              :disabled="listReorderPending || editingListKey !== null"
              handle=".list-header"
              ghost-class="drag-ghost"
              chosen-class="drag-chosen"
              drag-class="drag-active"
              filter=".list-drop-zone, .composer, .no-list-drag, .list-header--editing"
              @start="onListColumnDragStart"
              @end="onListColumnDragEnd"
            >
              <template #item="{ element: list }">
                <article
                  :data-list-key="list.key"
                  :class="[
                    'list-column',
                    {
                      'list-column--empty': isListColumnEmpty(list.key),
                      'list-column--drag-source':
                        boardDragging
                        && boardDragCrossList
                        && boardDragStartListKey === list.key,
                      'list-column--tail-target':
                        boardDragging && boardDragPreviewListKey === list.key,
                    },
                  ]"
                >
              <header
                class="list-header"
                :class="{ 'list-header--editing': editingListKey === list.key }"
              >
                <div class="list-title-field">
                  <h2
                    v-if="editingListKey !== list.key"
                    class="list-title-text list-title-clickable"
                    role="button"
                    tabindex="0"
                    @click="onListTitleClick(list)"
                    @keydown.enter.prevent="startListEdit(list)"
                    @keydown.space.prevent="startListEdit(list)"
                  >
                    {{ list.title }}
                  </h2>
                  <input
                    v-else
                    ref="listTitleInputEl"
                    v-model="listEditDrafts[list.key]"
                    type="text"
                    maxlength="255"
                    class="list-title-input"
                    :disabled="listRenamePending"
                    @blur="confirmListTitle(list)"
                    @keydown.enter.prevent="confirmListTitle(list)"
                    @keydown.escape.prevent="cancelListEdit"
                  >
                </div>
                <div class="list-header-right no-list-drag">
                  <span class="list-count">{{ visibleCount(list.key) }}</span>
                </div>
              </header>

              <draggable
                :list="tasksByList[list.key]"
                item-key="id"
                :class="[
                  'list-drop-zone',
                  {
                    'list-drop-zone--scrollable': scrollableDropZoneListKeys[list.key],
                    'list-drop-zone--empty': isListColumnEmpty(list.key),
                  },
                ]"
                group="board-cards"
                draggable=".task-card"
                ghost-class="drag-ghost"
                chosen-class="drag-chosen"
                drag-class="drag-active"
                fallback-class="drag-active"
                filter=".no-drag"
                direction="vertical"
                :force-fallback="true"
                :fallback-on-body="true"
                :fallback-tolerance="3"
                :animation="150"
                :easing="'cubic-bezier(0.25, 0.1, 0.25, 1)'"
                :swap-threshold="0.65"
                :empty-insert-threshold="80"
                :move="onBoardDragMove"
                @scroll.passive="closeCardMenu"
                @change="onListChange($event, list)"
                @start="onBoardDragStart"
                @end="onBoardDragEnd"
              >
                <template #item="{ element: task }">
                  <article
                    v-show="isTaskVisible(task)"
                    :data-task-id="task.id"
                    :class="['task-card', { 'task-card--fade-in': isTaskJustCreated(task.id) }]"
                    :role="editingTaskId === task.id ? undefined : 'button'"
                    :tabindex="editingTaskId === task.id ? undefined : 0"
                    @click="openTaskDetail(task)"
                    @keydown.enter.prevent="openTaskDetail(task)"
                    @keydown.space.prevent="openTaskDetail(task)"
                    @contextmenu.prevent="onTaskCardContextMenu(task, $event)"
                  >
                    <template v-if="editingTaskId === task.id">
                      <form class="card-edit-form" @submit.prevent="saveTaskTitle(task)" @click.stop>
                        <input
                          v-model.trim="taskTitleDraft"
                          type="text"
                          maxlength="500"
                          class="card-title-input"
                          :disabled="taskRenamePending"
                          @keydown.escape.prevent="cancelTaskEdit"
                        />
                        <div class="edit-actions">
                          <button type="submit" class="ghost-btn small" :disabled="taskRenamePending || !taskTitleDraft">
                            {{ taskRenamePending ? '保存中...' : '保存' }}
                          </button>
                          <button type="button" class="ghost-btn small" :disabled="taskRenamePending" @click="cancelTaskEdit">
                            キャンセル
                          </button>
                        </div>
                      </form>
                    </template>
                    <template v-else>
                      <div
                        class="card-menu-wrap no-drag"
                        :class="{ 'card-menu-wrap--open': openCardMenuTaskId === task.id }"
                        @click.stop
                        @pointerdown.stop
                        @mousedown.stop
                      >
                        <button
                          type="button"
                          class="card-menu-trigger"
                          :aria-expanded="openCardMenuTaskId === task.id"
                          aria-label="カードのメニュー"
                          @click="toggleCardMenu(task.id, $event)"
                        >
                          <Pencil :size="18" :stroke-width="2.25" aria-hidden="true" />
                        </button>
                      </div>
                      <div class="task-card-body">
                        <div v-if="task.labels?.length" class="task-label-list">
                          <span
                            v-for="label in task.labels"
                            :key="label.id"
                            class="task-label-strip"
                            :style="{ backgroundColor: label.color }"
                          >
                            {{ label.name }}
                          </span>
                        </div>
                        <p
                          v-if="taskHeadingName(task)"
                          class="task-card-heading"
                        >
                          {{ taskHeadingName(task) }}
                        </p>
                        <p class="task-title">
                          {{ task.title }}
                        </p>
                        <div v-if="cardAssignees(task).length" class="task-card-footer">
                          <div class="task-card-members" aria-label="担当メンバー">
                            <span
                              v-for="member in cardAssignees(task)"
                              :key="member.id"
                              class="task-card-member"
                              :title="memberDisplayName(member)"
                            >
                              <img
                                v-if="member.avatar_url"
                                :src="member.avatar_url"
                                alt=""
                                class="task-card-member-image"
                              />
                              <span v-else class="task-card-member-initial">{{ memberInitial(member) }}</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    </template>
                  </article>
                </template>
                <template #footer>
                  <div
                    v-if="boardDragging && boardDragPreviewMode === 'tail' && boardDragPreviewListKey === list.key"
                    class="drag-ghost drag-ghost--tail-preview no-drag"
                    aria-hidden="true"
                  />
                </template>
              </draggable>

              <div class="composer">
                <button
                  v-if="activeComposerKey !== list.key"
                  type="button"
                  class="add-btn add-card-btn"
                  @mousedown.prevent
                  @click="openComposer(list.key)"
                >
                  <span>＋</span>カードの作成
                </button>
                <div v-else class="composer-form">
                  <input
                    :ref="bindComposerInputEl"
                    v-model="cardDrafts[list.key]"
                    type="text"
                    maxlength="120"
                    placeholder="カード名を入力"
                    class="composer-input"
                    @blur="confirmCardDraft(list.key)"
                    @keydown.enter.prevent="confirmCardDraft(list.key)"
                    @keydown.escape="cancelCardDraft(list.key)"
                  >
                  <div class="composer-actions">
                    <button
                      type="button"
                      class="composer-submit-btn"
                      @mousedown.prevent
                      @click="confirmCardDraft(list.key)"
                    >
                      {{ pending ? '作成中...' : '作成' }}
                    </button>
                    <button
                      type="button"
                      class="composer-close-btn"
                      aria-label="キャンセル"
                      @mousedown.prevent
                      @click="cancelCardDraft(list.key)"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
                </article>
              </template>
            </draggable>

            <article class="create-list-column">
              <button
                v-if="!showListCreator"
                type="button"
                class="ghost-btn list-create-btn"
                @click="openListCreator"
              >
                <span>＋</span>リストの作成
              </button>
              <div v-else class="composer-form">
                <input
                  :ref="bindListComposerInputEl"
                  v-model="newListTitle"
                  type="text"
                  maxlength="40"
                  placeholder="リスト名を入力"
                  class="composer-input"
                  @blur="confirmListDraft"
                  @keydown.enter.prevent="confirmListDraft"
                  @keydown.escape="cancelCreateList"
                >
                <div class="composer-actions">
                  <button
                    type="button"
                    class="composer-submit-btn"
                    @mousedown.prevent
                    @click="confirmListDraft"
                  >
                    {{ pending ? '作成中...' : '作成' }}
                  </button>
                  <button
                    type="button"
                    class="composer-close-btn"
                    aria-label="キャンセル"
                    @mousedown.prevent
                    @click="cancelCreateList"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </article>
            </div>
          </section>
        </div>
      </Transition>

      <ConfirmModal
        v-model="archiveConfirmTaskOpen"
        title="タスクカードのアーカイブ確認"
        confirm-text="アーカイブ"
        variant="danger"
        @confirm="confirmArchiveFromModal"
      />

      <TaskDetailModal
        v-model="taskDetailOpen"
        :org-slug="slug"
        :project-id="projectId"
        :task-id="detailTaskId"
        :org-labels="orgLabels"
        :project-headings="projectHeadings"
        :project-members="projectMembers"
        :remote-update="detailModalRemotePatch"
        :remote-update-rev="detailModalRemoteRev"
        @updated="onTaskDetailUpdated"
        @heading-created="onTaskHeadingCreated"
      />

      <div
        v-if="undoToastTask"
        class="undo-toast"
        role="status"
      >
        <span class="undo-toast-message">「{{ undoToastTask.title }}」をアーカイブしました</span>
        <button type="button" class="undo-toast-close" aria-label="通知を閉じる" @click="clearUndoTimer">✕</button>
      </div>

    </template>

    <Teleport to="body">
      <ul
        v-if="openMenuTask && cardMenuPosition"
        class="card-menu"
        role="menu"
        :style="cardMenuStyle"
      >
        <li role="none">
          <button
            type="button"
            class="card-menu-item"
            role="menuitem"
            @click="openTaskEditFromMenu(openMenuTask)"
          >
            カード名を編集
          </button>
        </li>
        <li role="none">
          <button
            type="button"
            class="card-menu-item"
            role="menuitem"
            @click="openArchiveConfirm(openMenuTask)"
          >
            カードをアーカイブ
          </button>
        </li>
      </ul>
    </Teleport>
  </main>
</template>

<script setup lang="ts">
import { Trash2, Workflow, NotebookText, Pencil } from 'lucide-vue-next'
import draggable from 'vuedraggable'
import TaskDetailModal, { type TaskDetail, type TaskDetailMember } from '../../../../../components/TaskDetailModal.vue'
import { raceWithTimeout, timeoutMessage, TM_PAGE_LOAD_TIMEOUT_MS } from '../../../../../composables/raceWithTimeout'
import { useApi } from '../../../../../composables/useApi'
import { useOrgTerminology, useWorkUnitLabel } from '../../../../../composables/useOrgTerminology'
import { useProjectRealtimeChannel } from '../../../../../composables/useProjectRealtimeChannel'

definePageMeta({ name: 'org-slug-projects-id' })

const route = useRoute()
const slug = computed(() => route.params.slug as string)
const projectId = computed(() => route.params.id as string)
const { api } = useApi()
const { fetchWorkUnitLabel, syncLabelState } = useOrgTerminology()
const { workUnitLabel, workUnitListLabel } = useWorkUnitLabel(() => slug.value)

type Label = { id: number; name: string; color: string }
type TaskHeading = { id: number; name: string }
type TaskAssignee = { id: number; name: string | null; email: string | null; avatar_url: string | null }
type Task = {
  id: number
  title: string
  status: string
  list_id: number | null
  task_heading_id?: number | null
  heading?: TaskHeading | null
  sort_order?: number
  labels?: Label[]
  assignees?: TaskAssignee[]
}
type ListDef = { key: string; title: string; listId: number }
type ListRowRes = { id: number; name: string; sort_order: number; created_at?: string }

const tasks = ref<Task[] | null>(null)
const tasksByList = reactive<Record<string, Task[]>>({})
const error = ref<string | null>(null)
const pending = ref(false)
const pageReady = ref(false)
const fatalLoadError = ref<string | null>(null)
const searchQuery = ref('')
const showListCreator = ref(false)
const newListTitle = ref('')
const activeComposerKey = ref<string | null>(null)
const composerInputEl = ref<HTMLInputElement | null>(null)
const listTitleInputEl = ref<HTMLInputElement | null>(null)
const listComposerInputEl = ref<HTMLInputElement | null>(null)
const cardDrafts = reactive<Record<string, string>>({})
const lists = ref<ListDef[]>([])
const orgLabels = ref<Label[]>([])
const projectHeadings = ref<TaskHeading[]>([])
const projectMembers = ref<TaskDetailMember[]>([])
const labelFilterId = ref('')
const editingListKey = ref<string | null>(null)
const listEditDrafts = reactive<Record<string, string>>({})
const listRenamePending = ref(false)
const listReorderPending = ref(false)
const listColumnDragging = ref(false)
/** リストヘッダーのドラッグ直後にタイトル click で編集が開くのを防ぐ */
const suppressListTitleClick = ref(false)
let listOrderSnapshot: ListDef[] | null = null
const editingTaskId = ref<number | null>(null)
const taskTitleDraft = ref('')
const taskRenamePending = ref(false)
const justCreatedTaskIds = reactive<Record<number, true>>({})
const boardDragging = ref(false)
const scrollableDropZoneListKeys = reactive<Record<string, boolean>>({})
let boardDragPointerX = 0
let boardDragPointerY = 0
let boardDragTaskId: number | null = null
/** ドラッグ中カードの表示サイズ（リスト内プレースホルダ用） */
let boardDragCardWidthPx = 0
let boardDragCardHeightPx = 0
/** Sortable が確定した移動先リスト */
let boardDragLastToListKey: string | null = null
/** ドラッグ開始時のリスト key */
const boardDragStartListKey = ref<string | null>(null)
/** 他リスト上にホバー中（ソース列のプレースホルダ抑止） */
const boardDragCrossList = ref(false)
/** プレビュー表示先リスト（常に1列のみ） */
const boardDragPreviewListKey = ref<string | null>(null)
/** sortable＝カード間、tail＝一覧最下部（composer より下） */
const boardDragPreviewMode = ref<'sortable' | 'tail' | null>(null)
/** ドラッグ終了時フォールバック用の最終プレビュー列 */
let boardDragStickyColumnKey: string | null = null

const globalHeaderOffsetPx = ref(46)

const boardPageCssVars = computed(() => {
  return {
    '--global-header-offset': `${globalHeaderOffsetPx.value}px`,
    '--app-shell-page-pad': '0.25rem',
  } as Record<string, string>
})

let globalHeaderObserver: ResizeObserver | null = null

function readGlobalHeaderHeight (): number {
  if (!import.meta.client) {
    return 52
  }
  const el = document.querySelector('.global-header') as HTMLElement | null
  if (!el) {
    return 52
  }
  return Math.ceil(el.getBoundingClientRect().height)
}

function updateStickyOffsets () {
  if (!import.meta.client) {
    return
  }
  globalHeaderOffsetPx.value = readGlobalHeaderHeight()
}

const openCardMenuTaskId = ref<number | null>(null)
const cardMenuPosition = ref<{ top: number; left: number } | null>(null)
/** ビューポートはみ出し時のメニュー幅のおおよその下限（px） */
const CARD_MENU_MIN_WIDTH = 168

const archiveConfirmTask = ref<Task | null>(null)
const archiveConfirmTaskOpen = computed({
  get: () => archiveConfirmTask.value !== null,
  set: (open: boolean) => {
    if (!open) archiveConfirmTask.value = null
  },
})
const undoToastTask = ref<Task | null>(null)
let undoTimerId: ReturnType<typeof setTimeout> | null = null

const detailTaskId = ref<number | null>(null)
const detailModalRemotePatch = ref<TaskDetail | null>(null)
const detailModalRemoteRev = ref(0)
const taskDetailOpen = computed({
  get: () => detailTaskId.value !== null,
  set: (open: boolean) => {
    if (!open) detailTaskId.value = null
  },
})

const allLists = computed(() => lists.value)

const openMenuTask = computed(() => {
  const id = openCardMenuTaskId.value
  if (id == null || !tasks.value) {
    return null
  }
  return tasks.value.find(t => t.id === id) ?? null
})

const cardMenuStyle = computed(() => {
  if (!cardMenuPosition.value) {
    return {}
  }
  const { top, left } = cardMenuPosition.value
  return {
    position: 'fixed' as const,
    top: `${top}px`,
    left: `${left}px`,
    zIndex: 1000,
  }
})
const filteredTaskIds = computed<Set<number> | null>(() => {
  const query = searchQuery.value.toLowerCase()
  if (!query) return null
  const ids = new Set<number>()
  for (const task of tasks.value ?? []) {
    if (task.title.toLowerCase().includes(query)) ids.add(task.id)
  }
  return ids
})

function isTaskVisible (task: Task) {
  const ids = filteredTaskIds.value
  const byQuery = !ids || ids.has(task.id)
  if (!byQuery) return false
  if (!labelFilterId.value) return true
  return (task.labels ?? []).some(label => String(label.id) === labelFilterId.value)
}

function visibleCount (listKey: string) {
  const cards = tasksByList[listKey] ?? []
  return cards.filter(isTaskVisible).length
}

/** 空リスト用の余白スタイル（ドラッグ中のソース列の見かけの空きも含む） */
function isListColumnEmpty (listKey: string): boolean {
  const count = visibleCount(listKey)
  if (!boardDragging.value) {
    return count === 0
  }

  // プレビューがこの列 → カードが戻ってきた扱いで通常余白
  if (boardDragPreviewListKey.value === listKey) {
    return false
  }

  // ソース列から他列へプレビュー移動中（最後の1枚を運んでいるとき）
  if (
    boardDragStartListKey.value === listKey
    && boardDragCrossList.value
  ) {
    if (count === 0) {
      return true
    }
    if (count === 1 && boardDragTaskId != null) {
      return (tasksByList[listKey] ?? []).some(
        t => t.id === boardDragTaskId && isTaskVisible(t),
      )
    }
  }

  return count === 0
}

const visibleTaskCount = computed(() => {
  const list = tasks.value
  if (!list?.length) return 0
  return list.filter(task => isTaskVisible(task)).length
})

function rebuildBoardFromTasks () {
  for (const key of Object.keys(tasksByList)) {
    delete tasksByList[key]
  }
  for (const list of allLists.value) {
    tasksByList[list.key] = []
  }
  for (const task of tasks.value ?? []) {
    const key = task.list_id === null ? '' : `list_${task.list_id}`
    if (!key || !tasksByList[key]) continue
    tasksByList[key].push(task)
  }
  for (const list of allLists.value) {
    const arr = tasksByList[list.key]
    if (!arr?.length) continue
    arr.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id - b.id)
  }
}

function isTaskJustCreated (taskId: number): boolean {
  return !!justCreatedTaskIds[taskId]
}

function markTaskAsJustCreated (taskId: number) {
  justCreatedTaskIds[taskId] = true
  setTimeout(() => {
    delete justCreatedTaskIds[taskId]
  }, 260)
}

function cardAssignees (task: Task): TaskAssignee[] {
  return (task.assignees ?? []).slice(0, 3)
}

function taskHeadingName (task: Task): string | null {
  if (task.heading?.name) {
    return task.heading.name
  }
  const id = task.task_heading_id
  if (id == null) {
    return null
  }
  return projectHeadings.value.find(h => h.id === id)?.name ?? null
}

function memberDisplayName (member: TaskAssignee): string {
  return (member.name || member.email || `ユーザー #${member.id}`).trim()
}

function memberInitial (member: TaskAssignee): string {
  return memberDisplayName(member).slice(0, 1).toUpperCase()
}

function closeCardMenu () {
  openCardMenuTaskId.value = null
  cardMenuPosition.value = null
}

function positionCardMenu (anchor: HTMLElement) {
  if (import.meta.client) {
    const r = anchor.getBoundingClientRect()
    const margin = 6
    const pad = 8
    let left = r.right + margin
    const maxLeft = window.innerWidth - CARD_MENU_MIN_WIDTH - pad
    if (left > maxLeft) {
      left = Math.max(pad, r.left - CARD_MENU_MIN_WIDTH - margin)
    }
    cardMenuPosition.value = {
      top: r.top,
      left,
    }
  } else {
    cardMenuPosition.value = { top: 0, left: 0 }
  }
}

function openCardMenu (taskId: number, anchor: HTMLElement) {
  if (openCardMenuTaskId.value === taskId) {
    closeCardMenu()
    return
  }
  positionCardMenu(anchor)
  openCardMenuTaskId.value = taskId
}

function toggleCardMenu (taskId: number, ev: MouseEvent) {
  ev.stopPropagation()
  const el = ev.currentTarget
  if (!(el instanceof HTMLElement)) return
  openCardMenu(taskId, el)
}

function onTaskCardContextMenu (task: Task, ev: MouseEvent) {
  if (editingTaskId.value === task.id) return
  ev.stopPropagation()
  const card = ev.currentTarget
  if (!(card instanceof HTMLElement)) return
  const trigger = card.querySelector('.card-menu-trigger')
  if (!(trigger instanceof HTMLElement)) return
  openCardMenu(task.id, trigger)
}

function onGlobalClick (ev: Event) {
  const t = ev.target
  if (t instanceof Node) {
    const el = t instanceof Element ? t : t.parentElement
    if (el && el.closest('.card-menu-wrap')) {
      return
    }
    if (el && el.closest('.card-menu')) {
      return
    }
  }
  closeCardMenu()
}

function onWindowResize () {
  closeCardMenu()
  updateStickyOffsets()
  updateDropZoneScrollableState()
}

function syncCreateListColumnWidth () {
  if (!import.meta.client) {
    return
  }
  const createCol = document.querySelector<HTMLElement>('.create-list-column')
  const refColumn = document.querySelector<HTMLElement>('.board-lists-sortable .list-column[data-list-key]')
  if (!createCol) {
    return
  }
  if (refColumn) {
    const w = Math.round(refColumn.getBoundingClientRect().width)
    createCol.style.flex = `0 0 ${w}px`
    createCol.style.width = `${w}px`
    createCol.style.minWidth = `${w}px`
    createCol.style.maxWidth = `${w}px`
  } else {
    createCol.style.flex = '1 0 17rem'
    createCol.style.width = ''
    createCol.style.minWidth = '17rem'
    createCol.style.maxWidth = ''
  }
}

function updateDropZoneScrollableState () {
  if (!import.meta.client) {
    return
  }
  nextTick(() => {
    syncCreateListColumnWidth()
    const nextScrollable: Record<string, boolean> = {}
    const columns = document.querySelectorAll<HTMLElement>('.list-column[data-list-key]')
    columns.forEach((column) => {
      const listKey = column.dataset.listKey
      if (!listKey) {
        return
      }
      const dropZone = column.querySelector<HTMLElement>('.list-drop-zone')
      if (!dropZone) {
        nextScrollable[listKey] = false
        return
      }
      nextScrollable[listKey] = dropZone.scrollHeight > dropZone.clientHeight + 1
    })
    for (const key of Object.keys(scrollableDropZoneListKeys)) {
      delete scrollableDropZoneListKeys[key]
    }
    for (const [key, scrollable] of Object.entries(nextScrollable)) {
      scrollableDropZoneListKeys[key] = scrollable
    }
  })
}

function clearUndoTimer () {
  if (undoTimerId !== null) {
    clearTimeout(undoTimerId)
    undoTimerId = null
  }
  undoToastTask.value = null
}

function scheduleUndoToast (task: Task) {
  clearUndoTimer()
  undoToastTask.value = { ...task }
  undoTimerId = setTimeout(() => {
    undoToastTask.value = null
    undoTimerId = null
  }, 5000)
}

function openArchiveConfirm (task: Task) {
  closeCardMenu()
  editingTaskId.value = null
  archiveConfirmTask.value = task
}

function openTaskDetail (task: Task) {
  if (editingTaskId.value === task.id) return
  closeCardMenu()
  detailTaskId.value = task.id
}

function pushDetailModalRemote (detail: TaskDetail) {
  if (detailTaskId.value !== detail.id) {
    return
  }
  detailModalRemotePatch.value = detail
  detailModalRemoteRev.value += 1
}

function onTaskDetailUpdated (detail: TaskDetail) {
  if (!tasks.value) return
  const idx = tasks.value.findIndex(t => t.id === detail.id)
  if (idx < 0) return
  const existing = tasks.value[idx]
  if (!existing) return
  const updated: Task = {
    ...existing,
    title: detail.title,
    status: detail.status,
    list_id: detail.list_id,
    labels: detail.labels,
    assignees: detail.assignees,
    task_heading_id: detail.task_heading_id ?? detail.heading?.id ?? null,
    heading: detail.heading ?? null,
  }
  tasks.value.splice(idx, 1, updated)
  // list_id 変更（リスト間ドラッグ）では列ごとの配列を入れ替えないとカードが元の列に残る
  rebuildBoardFromTasks()
}

function removeTaskFromBoard (taskId: number) {
  if (!tasks.value) return
  const i = tasks.value.findIndex(t => t.id === taskId)
  if (i >= 0) {
    tasks.value.splice(i, 1)
  }
  rebuildBoardFromTasks()
}

function addTaskToBoard (task: Task) {
  if (!tasks.value) {
    tasks.value = []
  }
  tasks.value.push(task)
  rebuildBoardFromTasks()
}

async function confirmArchiveFromModal () {
  const task = archiveConfirmTask.value
  if (!task) return
  archiveConfirmTask.value = null
  const snapshot = { ...task }
  removeTaskFromBoard(task.id)
  error.value = null
  try {
    await api(`/orgs/${slug.value}/projects/${projectId.value}/tasks/${task.id}/archive`, {
      method: 'POST',
    })
    scheduleUndoToast(snapshot)
  } catch (e: unknown) {
    addTaskToBoard(snapshot)
    error.value = e instanceof Error ? e.message : 'アーカイブに失敗しました'
  }
}

async function updateTaskList (taskId: number, listId: number) {
  await api(`/orgs/${slug.value}/projects/${projectId.value}/tasks/${taskId}`, {
    method: 'PATCH',
    body: { list_id: listId },
  })
}

async function persistListTaskOrder (listKey: string) {
  const list = allLists.value.find(l => l.key === listKey)
  if (!list) {
    return
  }
  const taskIds = (tasksByList[listKey] ?? []).map(t => t.id)
  await api<{ data: { ok: boolean } }>(
    `/orgs/${slug.value}/projects/${projectId.value}/lists/${list.listId}/tasks/reorder`,
    {
      method: 'PATCH',
      body: { task_ids: taskIds },
    },
  )
  taskIds.forEach((id, index) => {
    const task = tasks.value?.find(t => t.id === id)
    if (task) {
      task.sort_order = index
    }
  })
}

async function onListChange (
  event: {
    added?: { element: Task }
    moved?: { element: Task }
    removed?: { element: Task }
  },
  toList: ListDef,
) {
  // ドラッグ中の Sortable 仮挿入でプレビュー先が揺れないよう無視する
  if (boardDragging.value) {
    return
  }

  if (event.removed) {
    return
  }

  const task = event.added?.element ?? event.moved?.element
  if (!task) {
    return
  }

  await nextTick()
  try {
    await persistTaskListChange(task.id, toList.key)
    reconcileTaskPlacement(task.id, toList.key)
    await persistListTaskOrder(toList.key)
  } catch {
    // persistTaskListChange / persistListTaskOrder 内で error を設定済み
  }
}

function getTaskIdFromDragEl (el: HTMLElement): number | null {
  const raw = el.dataset.taskId
    ?? el.closest('.task-card')?.getAttribute('data-task-id')
  if (!raw) {
    return null
  }
  const id = Number(raw)
  return Number.isFinite(id) ? id : null
}

function getBoardListColumns (): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('.list-column[data-list-key]'))
}

function findListColumnByKey (listKey: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`.list-column[data-list-key="${listKey}"]`)
}

/**
 * 隣接列の境界中点で列を決める（nearest / empty-insert による左右のちらつきを防ぐ）。
 * 列間ギャップも必ずどちらか一方の列に属する。
 */
function getListKeyAtClientX (clientX: number): string | null {
  const columns = getBoardListColumns()
  if (!columns.length) {
    return null
  }

  for (let i = 0; i < columns.length - 1; i++) {
    const leftCol = columns[i]
    const rightCol = columns[i + 1]
    if (!leftCol || !rightCol) {
      continue
    }
    const leftRect = leftCol.getBoundingClientRect()
    const rightRect = rightCol.getBoundingClientRect()
    const boundary = (leftRect.right + rightRect.left) / 2
    if (clientX < boundary) {
      return leftCol.dataset.listKey ?? null
    }
  }

  const lastCol = columns[columns.length - 1]
  return lastCol?.dataset.listKey ?? null
}

function isListEmptyForBoardDrag (listKey: string): boolean {
  return isListColumnEmpty(listKey)
}

function getDropZoneListKey (dropZone: HTMLElement): string | null {
  return dropZone.closest('.list-column[data-list-key]')?.getAttribute('data-list-key') ?? null
}

function syncBoardDragPointer (originalEvent?: Event) {
  if (originalEvent instanceof MouseEvent || originalEvent instanceof PointerEvent) {
    boardDragPointerX = originalEvent.clientX
    boardDragPointerY = originalEvent.clientY
  }
  if (boardDragging.value) {
    syncBoardPreviewState()
  }
}

/** ドラッグ中ポインタが属するリスト（列間ギャップ含め中点で一意に決定） */
function getHoverListKey (originalEvent?: Event): string | null {
  syncBoardDragPointer(originalEvent)
  return getListKeyAtClientX(boardDragPointerX)
}

/** composer より下、または列の白枠より下＝末尾ドロップ帯（Trello 同様） */
function isPointerInListTailZone (listColumn: HTMLElement): boolean {
  const colBottom = listColumn.getBoundingClientRect().bottom
  const composer = listColumn.querySelector('.composer')
  if (composer instanceof HTMLElement) {
    const composerBottom = composer.getBoundingClientRect().bottom
    if (boardDragPointerY >= composerBottom - 8) {
      return true
    }
  }

  return boardDragPointerY >= colBottom - 8
}

/** ドラッグ中プレビューを1つに統一（sortable か末尾スロットか） */
function syncBoardPreviewState () {
  if (!boardDragging.value) {
    boardDragPreviewListKey.value = null
    boardDragPreviewMode.value = null
    return
  }

  const clientX = boardDragPointerX
  const listKey = getListKeyAtClientX(clientX)
    ?? boardDragStickyColumnKey
    ?? boardDragStartListKey.value

  if (!listKey) {
    boardDragPreviewListKey.value = null
    boardDragPreviewMode.value = null
    return
  }

  const listColumn = findListColumnByKey(listKey)
  if (!listColumn) {
    boardDragPreviewListKey.value = null
    boardDragPreviewMode.value = null
    return
  }

  boardDragLastToListKey = listKey
  boardDragStickyColumnKey = listKey

  // 空リストは Sortable ゴーストが隣列と奪い合うため常に末尾スロットのみ
  const useTailPreview = isListEmptyForBoardDrag(listKey)
    || isPointerInListTailZone(listColumn)

  if (useTailPreview) {
    boardDragPreviewListKey.value = listKey
    boardDragPreviewMode.value = 'tail'
    if (boardDragStartListKey.value && listKey !== boardDragStartListKey.value) {
      boardDragCrossList.value = true
    } else if (boardDragStartListKey.value && listKey === boardDragStartListKey.value) {
      boardDragCrossList.value = false
    }
    removeStraySortableGhosts()
    scheduleSyncDragPlaceholderSize()
    return
  }

  boardDragPreviewMode.value = 'sortable'
  boardDragPreviewListKey.value = listKey

  if (boardDragStartListKey.value && listKey !== boardDragStartListKey.value) {
    boardDragCrossList.value = true
  } else if (boardDragStartListKey.value && listKey === boardDragStartListKey.value) {
    boardDragCrossList.value = false
  }
  scheduleSyncDragPlaceholderSize()
}

/** プレビュー先以外・空リストの Sortable ゴーストを除去（二重・左右ちらつき防止） */
function removeStraySortableGhosts () {
  if (!import.meta.client || !boardDragging.value) {
    return
  }

  const canonical = boardDragPreviewListKey.value ?? getListKeyAtClientX(boardDragPointerX)
  const tailMode = boardDragPreviewMode.value === 'tail'

  document.querySelectorAll('.list-drop-zone > .sortable-ghost').forEach((el) => {
    if (el.classList.contains('drag-ghost--tail-preview')) {
      return
    }

    const listKey = el.closest('.list-column[data-list-key]')?.getAttribute('data-list-key')
    const stray = tailMode
      || !canonical
      || !listKey
      || listKey !== canonical
      || isListEmptyForBoardDrag(listKey)

    if (stray) {
      el.remove()
    }
  })
}

function updateBoardDragPointer (clientX: number, clientY: number) {
  boardDragPointerX = clientX
  boardDragPointerY = clientY
  syncBoardPreviewState()
}

function onBoardDragPointerMove (event: PointerEvent | MouseEvent) {
  updateBoardDragPointer(event.clientX, event.clientY)
  removeStraySortableGhosts()
}

function onBoardNativeDragOver (event: DragEvent) {
  updateBoardDragPointer(event.clientX, event.clientY)
  event.preventDefault()
}

function onDocumentSelectStart (event: Event) {
  if (boardDragging.value || listColumnDragging.value) {
    event.preventDefault()
  }
}

function findUniqueListKeyForTask (taskId: number): string | null {
  let found: string | null = null
  for (const list of allLists.value) {
    if (tasksByList[list.key]?.some(t => t.id === taskId)) {
      if (found !== null) {
        return null
      }
      found = list.key
    }
  }
  return found
}

function reconcileTaskPlacement (taskId: number, canonicalListKey: string) {
  for (const list of allLists.value) {
    if (list.key === canonicalListKey) {
      continue
    }
    const arr = tasksByList[list.key]
    if (!arr?.length) {
      continue
    }
    for (let i = arr.length - 1; i >= 0; i--) {
      if (arr[i]?.id === taskId) {
        arr.splice(i, 1)
      }
    }
  }

  const task = tasks.value?.find(t => t.id === taskId)
  const canonical = tasksByList[canonicalListKey]
  if (task && canonical && !canonical.some(t => t.id === taskId)) {
    canonical.push(task)
  }
}

async function persistTaskListChange (taskId: number, listKey: string) {
  const list = allLists.value.find(l => l.key === listKey)
  const task = tasks.value?.find(t => t.id === taskId)
  if (!list || !task || task.list_id === list.listId) {
    return
  }

  const prevListId = task.list_id
  task.list_id = list.listId
  try {
    await updateTaskList(taskId, list.listId)
  } catch (e: unknown) {
    task.list_id = prevListId
    rebuildBoardFromTasks()
    error.value = e instanceof Error ? e.message : '移動の保存に失敗しました'
    throw e
  }
}

async function finalizeBoardDrag (
  taskId: number,
  canonicalListKey: string | null,
  startListKey: string | null,
  appendToEnd = false,
) {
  await nextTick()
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))

  const task = tasks.value?.find(t => t.id === taskId)
  if (!task) {
    return
  }

  const listKey = canonicalListKey ?? findUniqueListKeyForTask(taskId)
  if (!listKey) {
    return
  }

  if (appendToEnd) {
    for (const list of allLists.value) {
      const arr = tasksByList[list.key]
      if (!arr?.length) {
        continue
      }
      const idx = arr.findIndex(t => t.id === taskId)
      if (idx > -1) {
        arr.splice(idx, 1)
      }
    }
    if (!tasksByList[listKey]) {
      tasksByList[listKey] = []
    }
    tasksByList[listKey].push(task)
  }

  try {
    await persistTaskListChange(taskId, listKey)
  } catch {
    return
  }

  reconcileTaskPlacement(taskId, listKey)

  const listKeysToPersist = new Set<string>([listKey])
  if (startListKey && startListKey !== listKey) {
    listKeysToPersist.add(startListKey)
  }

  for (const key of listKeysToPersist) {
    try {
      await persistListTaskOrder(key)
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : '並び順の保存に失敗しました'
      await load({ refresh: true })
      return
    }
  }
}

/**
 * プレビューは常に1つ: 末尾帯はカスタムスロットのみ、それ以外は Sortable に任せる。
 */
function onBoardDragMove (
  evt: { to: HTMLElement, from: HTMLElement },
  originalEvent?: Event,
): boolean {
  syncBoardDragPointer(originalEvent)

  if (boardDragPreviewMode.value === 'tail') {
    removeStraySortableGhosts()
    return false
  }

  const canonicalListKey = boardDragPreviewListKey.value ?? getListKeyAtClientX(boardDragPointerX)
  const toListKey = getDropZoneListKey(evt.to)

  if (
    !canonicalListKey
    || !toListKey
    || toListKey !== canonicalListKey
    || isListEmptyForBoardDrag(toListKey)
  ) {
    removeStraySortableGhosts()
    return false
  }

  const startListKey = boardDragStartListKey.value
  if (startListKey && toListKey === startListKey && boardDragCrossList.value) {
    return false
  }

  return true
}

function captureBoardDragCardSize (sourceEl: HTMLElement) {
  const rect = sourceEl.getBoundingClientRect()
  boardDragCardWidthPx = Math.round(rect.width)
  boardDragCardHeightPx = Math.round(rect.height)
}

function applyDragPlaceholderSize (el: HTMLElement) {
  const w = boardDragCardWidthPx
  const h = boardDragCardHeightPx
  if (w <= 0 || h <= 0) {
    return
  }
  el.style.boxSizing = 'border-box'
  el.style.width = `${w}px`
  el.style.height = `${h}px`
  el.style.minHeight = ''
  el.style.maxHeight = ''
}

function syncDragPlaceholderSize () {
  if (!import.meta.client || !boardDragging.value) {
    return
  }
  document.querySelectorAll<HTMLElement>('.drag-ghost--tail-preview').forEach(applyDragPlaceholderSize)
  document.querySelectorAll<HTMLElement>('.list-drop-zone .sortable-ghost').forEach(applyDragPlaceholderSize)
}

function scheduleSyncDragPlaceholderSize () {
  if (!import.meta.client || !boardDragging.value) {
    return
  }
  const apply = () => syncDragPlaceholderSize()
  nextTick(apply)
  requestAnimationFrame(apply)
}

function clearDragPlaceholderSize () {
  if (!import.meta.client) {
    return
  }
  const props = ['width', 'height', 'minHeight', 'maxHeight', 'boxSizing'] as const
  document.querySelectorAll<HTMLElement>(
    '.drag-ghost--tail-preview, .list-drop-zone .sortable-ghost',
  ).forEach((el) => {
    for (const prop of props) {
      el.style[prop] = ''
    }
  })
  boardDragCardWidthPx = 0
  boardDragCardHeightPx = 0
}

function syncFloatingDragCardLayout (sourceEl: HTMLElement) {
  captureBoardDragCardSize(sourceEl)
  const apply = () => {
    const fallback = document.querySelector<HTMLElement>('.task-card.sortable-fallback')
    if (!fallback) {
      return
    }
    const w = boardDragCardWidthPx
    const h = boardDragCardHeightPx
    if (w > 0) {
      fallback.style.width = `${w}px`
    }
    fallback.style.height = ''
    fallback.style.minHeight = ''
    fallback.style.maxHeight = ''
    fallback.style.boxSizing = 'border-box'
    fallback.style.opacity = '1'
    fallback.style.visibility = 'visible'
    syncDragPlaceholderSize()
  }
  nextTick(apply)
  requestAnimationFrame(apply)
}

function onBoardDragStart (evt: { item: HTMLElement, originalEvent?: Event }) {
  updateDropZoneScrollableState()
  boardDragTaskId = getTaskIdFromDragEl(evt.item)
  const task = tasks.value?.find(t => t.id === boardDragTaskId)
  boardDragStartListKey.value = task?.list_id != null ? `list_${task.list_id}` : null
  boardDragCrossList.value = false
  boardDragPreviewListKey.value = null
  boardDragPreviewMode.value = null
  boardDragLastToListKey = boardDragStartListKey.value
  syncBoardDragPointer(evt.originalEvent)
  boardDragging.value = true
  boardDragStickyColumnKey = boardDragStartListKey.value
  closeCardMenu()
  syncFloatingDragCardLayout(evt.item)
  if (import.meta.client) {
    document.addEventListener('pointermove', onBoardDragPointerMove, { passive: true })
    document.addEventListener('mousemove', onBoardDragPointerMove, { passive: true })
    document.addEventListener('dragover', onBoardNativeDragOver)
  }
}

/** ドラッグ終了時に表示位置と list_id を揃えて API 保存する */
function onBoardDragEnd (evt?: { originalEvent?: Event }) {
  syncBoardDragPointer(evt?.originalEvent)
  syncBoardPreviewState()
  const taskId = boardDragTaskId
  const startListKey = boardDragStartListKey.value
  const previewMode = boardDragPreviewMode.value
  const toListKey = boardDragPreviewListKey.value
    ?? boardDragLastToListKey
    ?? getHoverListKey(evt?.originalEvent)
    ?? boardDragStickyColumnKey
    ?? findUniqueListKeyForTask(taskId ?? -1)
  const appendToEnd = previewMode === 'tail'

  boardDragging.value = false
  clearDragPlaceholderSize()
  boardDragTaskId = null
  boardDragCrossList.value = false
  boardDragPreviewListKey.value = null
  boardDragPreviewMode.value = null
  removeStraySortableGhosts()
  updateDropZoneScrollableState()
  boardDragLastToListKey = null
  boardDragStartListKey.value = null
  boardDragStickyColumnKey = null
  if (import.meta.client) {
    document.removeEventListener('pointermove', onBoardDragPointerMove)
    document.removeEventListener('mousemove', onBoardDragPointerMove)
    document.removeEventListener('dragover', onBoardNativeDragOver)
  }

  if (taskId == null || !toListKey) {
    return
  }

  void finalizeBoardDrag(taskId, toListKey, startListKey, appendToEnd)
}

function onTaskHeadingCreated (heading: TaskHeading) {
  const exists = projectHeadings.value.some(h => h.id === heading.id)
  if (exists) {
    return
  }
  projectHeadings.value = [...projectHeadings.value, heading]
    .sort((a, b) => a.name.localeCompare(b.name, 'ja'))
}

async function fetchTaskHeadings (): Promise<TaskHeading[]> {
  try {
    const res = await api<{ data: TaskHeading[] }>(
      `/orgs/${slug.value}/projects/${projectId.value}/task-headings`,
    )
    return res.data ?? []
  } catch {
    return []
  }
}

async function fetchBoardPayload () {
  const [listsRes, tasksRes, labelsRes, membersRes, label, headings] = await Promise.all([
    api<{ data: ListRowRes[] }>(
      `/orgs/${slug.value}/projects/${projectId.value}/lists`,
    ),
    api<{ data: Task[] }>(
      `/orgs/${slug.value}/projects/${projectId.value}/tasks`,
    ),
    api<{ data: Label[] }>(
      `/orgs/${slug.value}/task-labels`,
    ),
    api<{ data: TaskDetailMember[] }>(
      `/orgs/${slug.value}/projects/${projectId.value}/members`,
    ),
    fetchWorkUnitLabel(slug.value),
    fetchTaskHeadings(),
  ])
  return { listsRes, tasksRes, labelsRes, membersRes, label, headings }
}

function applyBoardPayload (data: Awaited<ReturnType<typeof fetchBoardPayload>>) {
  const sortedLists = [...data.listsRes.data].sort((a, b) => a.sort_order - b.sort_order)
  lists.value = sortedLists.map(row => ({
    key: `list_${row.id}`,
    title: row.name,
    listId: row.id,
  }))
  for (const list of lists.value) {
    if (!(list.key in cardDrafts)) cardDrafts[list.key] = ''
    if (!(list.key in tasksByList)) tasksByList[list.key] = []
  }

  tasks.value = data.tasksRes.data
  orgLabels.value = data.labelsRes.data
  projectHeadings.value = data.headings
  projectMembers.value = data.membersRes.data
  syncLabelState(slug.value, data.label)
  rebuildBoardFromTasks()
}

async function load (opts?: { refresh?: boolean }) {
  const refresh = opts?.refresh ?? false
  error.value = null
  if (!refresh) {
    fatalLoadError.value = null
  }

  try {
    if (!pageReady.value && !refresh) {
      const r = await raceWithTimeout(() => fetchBoardPayload(), TM_PAGE_LOAD_TIMEOUT_MS)
      if (!r.ok) {
        fatalLoadError.value = r.reason === 'timeout' ? timeoutMessage() : r.message
        return
      }
      applyBoardPayload(r.value)
      pageReady.value = true
    } else {
      const data = await fetchBoardPayload()
      applyBoardPayload(data)
      pageReady.value = true
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '読み込みに失敗しました'
    if (!pageReady.value && !refresh) {
      fatalLoadError.value = msg
    } else {
      error.value = msg
    }
  } finally {
    if (import.meta.client) {
      await nextTick()
      updateStickyOffsets()
      updateDropZoneScrollableState()
    }
  }
}

function retryBoardLoad () {
  fatalLoadError.value = null
  void load()
}

async function openComposer (key: string) {
  activeComposerKey.value = key
  await nextTick()
  composerInputEl.value?.focus()
}

function bindComposerInputEl (el: Element | ComponentPublicInstance | null) {
  composerInputEl.value = el as HTMLInputElement | null
}

function closeComposer () {
  activeComposerKey.value = null
}

function cancelCardDraft (listKey: string) {
  cardDrafts[listKey] = ''
  closeComposer()
}

async function confirmCardDraft (listKey: string) {
  if (pending.value) return
  const title = (cardDrafts[listKey] || '').trim()
  if (!title) {
    cancelCardDraft(listKey)
    return
  }
  await createTask(listKey)
}

async function openListCreator () {
  showListCreator.value = true
  await nextTick()
  listComposerInputEl.value?.focus()
}

function bindListComposerInputEl (el: Element | ComponentPublicInstance | null) {
  listComposerInputEl.value = el as HTMLInputElement | null
}

async function confirmListDraft () {
  if (pending.value) return
  const trimmed = newListTitle.value.trim()
  if (!trimmed) {
    cancelCreateList()
    return
  }
  await createList()
}

async function createList () {
  const trimmed = newListTitle.value.trim()
  if (!trimmed) return
  pending.value = true
  try {
    await api<{ id: number; name: string; sort_order: number }>(
      `/orgs/${slug.value}/projects/${projectId.value}/lists`,
      {
      method: 'POST',
      body: { name: trimmed, sort_order: lists.value.length },
      },
    )
    newListTitle.value = ''
    showListCreator.value = false
    await load({ refresh: true })
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'リスト作成に失敗しました'
  } finally {
    pending.value = false
  }
}

function cancelCreateList () {
  newListTitle.value = ''
  showListCreator.value = false
}

function onListTitleClick (list: ListDef) {
  if (suppressListTitleClick.value) {
    return
  }
  void startListEdit(list)
}

async function startListEdit (list: ListDef) {
  editingTaskId.value = null
  editingListKey.value = list.key
  listEditDrafts[list.key] = list.title
  await nextTick()
  listTitleInputEl.value?.focus()
  listTitleInputEl.value?.select()
}

function cancelListEdit () {
  editingListKey.value = null
}

async function confirmListTitle (list: ListDef) {
  if (listRenamePending.value || editingListKey.value !== list.key) {
    return
  }
  const name = (listEditDrafts[list.key] || '').trim()
  if (!name || name === list.title) {
    cancelListEdit()
    return
  }
  await saveListTitle(list)
}

function lockListColumnWidthsForDrag () {
  if (!import.meta.client) {
    return
  }
  document.querySelectorAll('.board-lists-sortable .list-column').forEach((col) => {
    if (!(col instanceof HTMLElement)) {
      return
    }
    const w = col.getBoundingClientRect().width
    col.style.width = `${w}px`
    col.style.minWidth = `${w}px`
    col.style.maxWidth = `${w}px`
  })
}

function clearListColumnWidthLocks () {
  if (!import.meta.client) {
    return
  }
  document.querySelectorAll('.board-lists-sortable .list-column').forEach((col) => {
    if (!(col instanceof HTMLElement)) {
      return
    }
    col.style.width = ''
    col.style.minWidth = ''
    col.style.maxWidth = ''
  })
}

function onListColumnDragStart () {
  if (boardDragging.value) {
    return
  }
  suppressListTitleClick.value = false
  listColumnDragging.value = true
  closeCardMenu()
  listOrderSnapshot = lists.value.map(l => ({ ...l }))
  lockListColumnWidthsForDrag()
  nextTick(() => lockListColumnWidthsForDrag())
}

async function onListColumnDragEnd () {
  listColumnDragging.value = false
  clearListColumnWidthLocks()
  updateDropZoneScrollableState()
  suppressListTitleClick.value = true
  window.setTimeout(() => {
    suppressListTitleClick.value = false
  }, 100)
  const snapshot = listOrderSnapshot
  listOrderSnapshot = null
  if (!snapshot) {
    return
  }
  const unchanged = snapshot.length === lists.value.length
    && snapshot.every((l, i) => l.listId === lists.value[i]?.listId)
  if (unchanged) {
    return
  }
  await persistListOrder(snapshot)
}

async function persistListOrder (rollback: ListDef[]) {
  listReorderPending.value = true
  error.value = null
  const listIds = lists.value.map(l => l.listId)
  try {
    await api<{ data: { ok: boolean } }>(
      `/orgs/${slug.value}/projects/${projectId.value}/lists/reorder`,
      { method: 'PATCH', body: { list_ids: listIds } },
    )
  } catch (e: unknown) {
    lists.value = rollback.map(l => ({ ...l }))
    error.value = e instanceof Error ? e.message : 'リストの並び替えに失敗しました'
  } finally {
    listReorderPending.value = false
  }
}

async function saveListTitle (list: ListDef) {
  const name = (listEditDrafts[list.key] || '').trim()
  if (!name) return
  listRenamePending.value = true
  error.value = null
  try {
    await api<{ id: number; name: string; sort_order: number }>(
      `/orgs/${slug.value}/projects/${projectId.value}/lists/${list.listId}`,
      { method: 'PATCH', body: { name } },
    )
    const row = lists.value.find(item => item.key === list.key)
    if (row) row.title = name
    editingListKey.value = null
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'リスト名の更新に失敗しました'
  } finally {
    listRenamePending.value = false
  }
}

function startTaskEdit (task: Task) {
  editingListKey.value = null
  editingTaskId.value = task.id
  taskTitleDraft.value = task.title
}

function openTaskEditFromMenu (task: Task) {
  closeCardMenu()
  startTaskEdit(task)
}

function cancelTaskEdit () {
  editingTaskId.value = null
  taskTitleDraft.value = ''
}

async function saveTaskTitle (task: Task) {
  const title = taskTitleDraft.value.trim()
  if (!title) return
  taskRenamePending.value = true
  error.value = null
  try {
    await api<{ title: string }>(
      `/orgs/${slug.value}/projects/${projectId.value}/tasks/${task.id}`,
      { method: 'PATCH', body: { title } },
    )
    task.title = title
    editingTaskId.value = null
    taskTitleDraft.value = ''
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'カード名の更新に失敗しました'
  } finally {
    taskRenamePending.value = false
  }
}

async function createTask (status: string) {
  const title = (cardDrafts[status] || '').trim()
  if (!title) return
  const list = allLists.value.find(item => item.key === status)
  if (!list) return
  pending.value = true
  try {
    const created = await api<Task>(`/orgs/${slug.value}/projects/${projectId.value}/tasks`, {
      method: 'POST',
      body: { title, status: 'todo', list_id: list.listId },
    })
    cardDrafts[status] = ''
    activeComposerKey.value = null
    if (!tasks.value) {
      tasks.value = []
    }
    tasks.value.push(created)
    if (!tasksByList[status]) {
      tasksByList[status] = []
    }
    tasksByList[status].push(created)
    markTaskAsJustCreated(created.id)
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : '作成に失敗しました'
  } finally {
    pending.value = false
  }
}

useProjectRealtimeChannel(projectId, {
  onTaskCreated (task) {
    addTaskToBoard(task)
    markTaskAsJustCreated(task.id)
  },
  onTaskUpdated (task) {
    const detail = task as TaskDetail
    onTaskDetailUpdated(detail)
    pushDetailModalRemote(detail)
  },
  onTaskArchived ({ id }) {
    removeTaskFromBoard(id)
  },
  onTaskRestored (task) {
    const detail = task as TaskDetail
    if (tasks.value?.some(t => t.id === task.id)) {
      onTaskDetailUpdated(detail)
      pushDetailModalRemote(detail)
      return
    }
    addTaskToBoard(task)
  },
  onTaskDeleted (taskId) {
    removeTaskFromBoard(taskId)
  },
  onListCreated () {
    void load({ refresh: true })
  },
  onListUpdated (list) {
    const row = lists.value.find(l => l.listId === list.id)
    if (row) {
      row.title = list.name
    } else {
      void load({ refresh: true })
    }
  },
  onListDeleted () {
    void load({ refresh: true })
  },
})

onMounted(() => {
  void load()

  if (!import.meta.client) {
    return
  }

  window.addEventListener('click', onGlobalClick)
  window.addEventListener('resize', onWindowResize)
  document.addEventListener('selectstart', onDocumentSelectStart)

  nextTick(() => {
    updateStickyOffsets()

    const globalHeader = document.querySelector('.global-header') as HTMLElement | null
    if (globalHeader && 'ResizeObserver' in window) {
      globalHeaderObserver = new ResizeObserver(() => {
        updateStickyOffsets()
      })
      globalHeaderObserver.observe(globalHeader)
    }
  })
})

onBeforeUnmount(() => {
  if (import.meta.client) {
    window.removeEventListener('click', onGlobalClick)
    window.removeEventListener('resize', onWindowResize)
    document.removeEventListener('selectstart', onDocumentSelectStart)
    document.removeEventListener('pointermove', onBoardDragPointerMove)
    document.removeEventListener('mousemove', onBoardDragPointerMove)
    document.removeEventListener('dragover', onBoardNativeDragOver)
    clearListColumnWidthLocks()
  }
  globalHeaderObserver?.disconnect()
  globalHeaderObserver = null
  clearUndoTimer()
})

</script>

<style lang="scss" scoped>
.board-page {
  height: calc(100dvh - var(--global-header-offset, 46px));
  padding: 0 1rem 0;
  margin-top: calc(-1 * var(--app-shell-page-pad, 0.25rem));
  padding-top: 0;
  font-family: system-ui, sans-serif;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.page-shell-fade {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.page-header {
  position: relative;
  z-index: 40;
  flex-shrink: 0;
  margin-bottom: 0.2rem;
  width: calc(100% + 2rem);
  margin-left: -1rem;
  margin-right: -1rem;
  box-sizing: border-box;
  height: 48px;
  display: flex;
  align-items: center;
  padding: 0 0.9rem;
  background: #ffffff;
  border-bottom: 1px solid rgba(15, 23, 42, 0.35);
  box-shadow: 0 1px 8px rgba(15, 23, 42, 0.18);
}

.page-header > * {
  width: 100%;
  height: 100%;
}

.subheader {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  height: 100%;
  min-width: 0;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
}

.subheader::-webkit-scrollbar {
  display: none;
}

.subheader-title {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 900;
  color: #2b2e2f;
  line-height: 1.1;
  flex-shrink: 0;
}

.subheader-back-link {
  text-decoration: none;
  color: mixin.$main;
  transition: color 0.16s ease;
}

.subheader-back-link:hover {
  color: mixin.$main-hover;
  text-decoration: none;
}

.subheader-filters {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  flex: 1;
  min-width: 0;
}

.header-search,
.header-sort {
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 0 0.55rem;
  font-size: 0.82rem;
  background: #fff;
  color: #0f172a;
  box-sizing: border-box;
  height: 32px;
  line-height: 32px;
}

.header-search {
  flex: 1;
  min-width: 6rem;
  max-width: 18rem;
}

.header-search::placeholder {
  color: #94a3b8;
}

.header-sort {
  flex-shrink: 0;
  width: 6.75rem;
  padding-right: 1.5rem;
  cursor: pointer;
}

.subheader-count {
  margin: 0;
  font-size: 0.82rem;
  font-weight: 600;
  color: #64748b;
  white-space: nowrap;
  flex-shrink: 0;
}

.header-primary-btn {
  border: 1px solid rgba(255, 255, 255, 0.55);
  border-radius: 999px;
  padding: 0.35rem 0.7rem;
  font-size: 0.82rem;
  font-weight: 800;
  cursor: pointer;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.92);
  color: #172554;
  white-space: nowrap;
  flex-shrink: 0;
}

.header-primary-btn.linkish {
  box-sizing: border-box;
}

.header-primary-btn--icon-group {
  width: auto;
  min-height: 2.35rem;
  padding: 0.14rem 0.55rem;
  gap: 1.4rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: #1e293b;
}

.field input,
.field select {
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  padding: 0.62rem 0.75rem;
  font-size: 0.94rem;
  background: #fff;
}

.page-shell-fade > .board {
  flex: 1;
  min-height: 0;
}

.board {
  width: calc(100% + 2rem);
  max-width: none;
  margin: 0.55rem -1rem 0;
  display: flex;
  flex-direction: row;
  align-items: start;
  gap: 0.9rem;
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 2rem;
  margin-bottom: 0;
  flex: 1;
  min-height: 0;
  scrollbar-width: thin;
  scrollbar-color: rgba(15, 23, 42, 0.1) transparent;
}

.board::-webkit-scrollbar {
  height: 3px;
}

.board::-webkit-scrollbar-track {
  background: transparent;
}

.board::-webkit-scrollbar-thumb {
  background: rgba(15, 23, 42, 0.08);
  border-radius: 999px;
}

.board::-webkit-scrollbar-thumb:hover {
  background: rgba(15, 23, 42, 0.14);
}

.board-columns {
  display: flex;
  flex-direction: row;
  align-items: start;
  gap: 0.9rem;
  flex: 0 0 auto;
  margin-left: 1rem;
  margin-right: 1rem;
}

.board-lists-sortable {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(17rem, 1fr);
  gap: 0.9rem;
  align-items: start;
}

.board-lists-sortable .list-column {
  box-sizing: border-box;
  min-width: 0;
}

.board-lists-sortable .list-column.drag-ghost {
  border: 1px dashed #94a3b8;
  min-height: 3.5rem;
  opacity: 1;
}

.board-lists-sortable .list-column.drag-active {
  transform: none;
  opacity: 1 !important;
}

.board-list-dragging .list-drop-zone,
.board-list-dragging .composer {
  pointer-events: none;
}

.list-column {
  background: #f8fafc;
  border-radius: 14px;
  border: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  align-self: start;
  height: auto;
  max-height: calc(100dvh - var(--tm-global-header-height, 46px) - var(--tm-page-header-height, 48px) - 3rem);
  box-sizing: border-box;
  position: relative;
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  padding: 0.8rem;
  flex-shrink: 0;
  cursor: grab;
  touch-action: none;
}

.board-list-dragging .list-header {
  cursor: grabbing;
}

.list-title-field {
  flex: 1;
  min-width: 0;
  cursor: inherit;
  touch-action: auto;
}

.list-title-text,
.list-title-input {
  margin: 0;
  width: 100%;
  box-sizing: border-box;
  font-size: 1rem;
  line-height: 1.35;
  font-weight: 700;
  font-family: inherit;
  color: inherit;
  padding: 0.1rem 0.6rem;
}

.list-title-text {
  display: block;
}

.list-title-clickable {
  cursor: pointer;
}

.list-title-clickable:focus-visible {
  outline: 2px solid #2563eb;
  outline-offset: 2px;
  border-radius: 4px;
}

.list-title-input {
  display: block;
  border: none;
  background: transparent;
  border-radius: 4px;
  appearance: none;
  -webkit-appearance: none;
}

.list-title-input:focus {
  outline: 2px solid #2563eb;
  outline-offset: 2px;
}

.list-header--editing .list-title-field,
.list-header--editing .list-title-field * {
  cursor: auto;
  touch-action: auto;
  user-select: text;
}

.list-header-right {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  flex-shrink: 0;
}

.edit-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.ghost-btn.small {
  padding: 0.35rem 0.55rem;
  font-size: 0.78rem;
  border-radius: 8px;
}

.card-edit-form {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.card-title-input {
  width: 100%;
  box-sizing: border-box;
}

.list-count {
  background: #e2e8f0;
  border-radius: 999px;
  font-size: 0.8rem;
  padding: 0.12rem 0.55rem;
  color: #475569;
}

.list-drop-zone {
  padding: 0 0.75rem 0.65rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  flex: 0 1 auto;
  min-height: 0;
  max-height: calc(100dvh - var(--tm-global-header-height, 46px) - var(--tm-page-header-height, 48px) - 8.5rem);
  position: relative;
  scrollbar-width: none;
}

.list-drop-zone::-webkit-scrollbar {
  width: 0;
}

.list-drop-zone::-webkit-scrollbar-track {
  background: transparent;
}

.list-drop-zone--scrollable {
  scrollbar-width: thin;
  scrollbar-color: rgba(15, 23, 42, 0.1) transparent;
}

.list-drop-zone--scrollable::-webkit-scrollbar {
  width: 3px;
}

.list-drop-zone--scrollable::-webkit-scrollbar-thumb {
  background: rgba(15, 23, 42, 0.08);
  border-radius: 999px;
}

.list-drop-zone--scrollable::-webkit-scrollbar-thumb:hover {
  background: rgba(15, 23, 42, 0.14);
}

.list-column--empty .list-drop-zone {
  padding-top: 0;
  padding-bottom: 0.1rem;
  gap: 0;
}

/* 他リストへ移動中はソース列にプレースホルダを出さない（Trello 同様） */
.board-drag-cross-list .list-column--drag-source .sortable-ghost,
.board-drag-cross-list .list-column--drag-source .drag-ghost {
  display: none !important;
}

/* 空リスト: empty-insert-threshold の奪い合いでゴーストが隣列に出ないよう抑止 */
.board-dragging .list-drop-zone--empty > .sortable-ghost,
.board-dragging .list-drop-zone--empty > .drag-ghost:not(.drag-ghost--tail-preview) {
  display: none !important;
}

/* 末尾帯: Sortable ゴーストは全非表示、末尾スロットのみ */
.board-dragging--tail-zone .list-drop-zone .sortable-ghost,
.board-dragging--tail-zone .list-drop-zone > .drag-ghost:not(.drag-ghost--tail-preview) {
  display: none !important;
  height: 0 !important;
  min-height: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  border: none !important;
  overflow: hidden !important;
}

.list-column--tail-target .list-drop-zone {
  min-height: 2.75rem;
}

.drag-ghost--tail-preview {
  flex-shrink: 0;
  position: relative;
  z-index: 3;
  pointer-events: none;
  display: block !important;
  min-height: 0;
  box-sizing: border-box;
}

.board-dragging:not(.board-dragging--tail-zone) .list-drop-zone .sortable-ghost,
.board-dragging:not(.board-dragging--tail-zone) .list-drop-zone .drag-ghost:not(.drag-ghost--tail-preview) {
  position: relative;
  z-index: 3;
  box-sizing: border-box;
}

/* リスト内の元カードのみ非表示（body 上の sortable-fallback は表示） */
.board-dragging .list-drop-zone > .task-card.sortable-chosen,
.board-dragging .list-drop-zone > .task-card.drag-active {
  opacity: 0 !important;
}

.board-dragging,
.board-dragging *,
.board-list-dragging,
.board-list-dragging * {
  user-select: none !important;
  -webkit-user-select: none !important;
}

.task-card.sortable-fallback,
.task-card.sortable-fallback * {
  user-select: none !important;
  -webkit-user-select: none !important;
}

.board-dragging .list-column {
  overflow: visible;
}

.board-dragging .list-drop-zone {
  /* ドラッグ中もスクロール位置を維持し、composer 領域へのはみ出し描画を防ぐ */
  overflow-x: hidden;
  overflow-y: auto;
}

.board-dragging .list-drop-zone > .task-card {
  position: relative;
  z-index: 2;
}

.board-dragging .list-header {
  position: relative;
  z-index: 2;
  pointer-events: none;
}

.board-dragging .list-column > .composer {
  position: relative;
  z-index: 2;
  pointer-events: none;
}

.task-card {
  position: relative;
  min-width: 0;
  background: #fff;
  border: 1px solid #cbd5e1;
  border-radius: 12px;
  padding: 0.75rem;
  cursor: pointer;
  box-shadow: 0 1px 0 rgba(15, 23, 42, 0.06);
}

.task-card:hover {
  border-color: #2563eb;
}

.task-card--fade-in {
  animation: cardFadeIn 220ms ease-out;
}

@keyframes cardFadeIn {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.drag-chosen {
  cursor: grabbing;
}

/* リスト内の挿入位置プレースホルダ（Trello のグレースロット） */
.drag-ghost {
  opacity: 1 !important;
  background: #091e420f;
  border: none;
  border-radius: 12px;
  box-shadow: none;
  min-height: 0;
  margin: 0;
  pointer-events: none;
  box-sizing: border-box;
}

.drag-ghost * {
  visibility: hidden;
}

/* カーソル追従のドラッグ中カード（マウスについてくる浮遊カード） */
.task-card.sortable-fallback.drag-active {
  cursor: grabbing !important;
  opacity: 1 !important;
  visibility: visible !important;
  transform: rotate(3deg);
  box-shadow: 0 10px 20px rgba(15, 23, 42, 0.22);
  z-index: 10000 !important;
  pointer-events: none;
  box-sizing: border-box;
  background: #fff !important;
  border: 1px solid #cbd5e1;
  border-radius: 12px;
}

.task-card.sortable-fallback.drag-active * {
  visibility: visible !important;
}

.task-card-heading {
  margin: 0 0 0.2rem;
  font-size: 0.72rem;
  font-weight: 700;
  line-height: 1.25;
  color: #64748b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-title {
  margin: 0;
  font-weight: 700;
  line-height: 1.35;
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.task-label-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  margin-bottom: 0.4rem;
}

.task-label-strip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.18rem 0.55rem;
  border-radius: 4px;
  font-size: 0.72rem;
  font-weight: 700;
  line-height: 1.2;
  color: #fff;
  white-space: nowrap;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}

.task-card-body {
  display: flex;
  flex-direction: column;
  width: 100%;
  min-width: 0;
}

.task-card-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 0.45rem;
}

.task-card-members {
  display: flex;
  align-items: center;
}

.task-card-member {
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 999px;
  overflow: hidden;
  flex-shrink: 0;
  border: 2px solid #fff;
  box-shadow: 0 0 0 1px #e2e8f0;
  background: #e2e8f0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.task-card-member + .task-card-member {
  margin-left: -0.35rem;
}

.task-card-member-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.task-card-member-initial {
  font-size: 0.62rem;
  font-weight: 700;
  color: #475569;
  line-height: 1;
}

.task-card:focus-visible {
  outline: 2px solid #2563eb;
  outline-offset: 2px;
}

.card-menu-wrap {
  position: absolute;
  top: 0.35rem;
  right: 0.35rem;
  z-index: 2;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.12s ease;
}

.task-card:hover .card-menu-wrap,
.card-menu-wrap--open {
  opacity: 1;
  pointer-events: auto;
}

.card-menu-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: #fff;
  color: #64748b;
  line-height: 1;
  padding: 0.2rem;
  border-radius: 999px;
  cursor: pointer;
}

.card-menu-trigger:focus-visible {
  outline: 2px solid #2563eb;
  outline-offset: 2px;
}

.card-menu {
  margin: 0;
  padding: 0.25rem 0;
  list-style: none;
  min-width: 9rem;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.12);
}

.card-menu-item {
  width: 100%;
  text-align: left;
  border: none;
  background: transparent;
  padding: 0.45rem 0.75rem;
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
  color: #0f172a;
}

.card-menu-item:hover {
  background: #f8fafc;
}

.undo-toast {
  position: fixed;
  bottom: 3rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 55;
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-width: 24rem;
  max-width: min(42rem, calc(100vw - 1.5rem));
  gap: 0.7rem;
  padding: 0.7rem 1.1rem;
  background: mixin.$main;
  color: mixin.$white;
  border-radius: 10px;
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.55;
  white-space: nowrap;
  box-shadow: 0 10px 22px color-mix(in srgb, mixin.$main 28%, transparent);
}

.undo-toast-message {
  text-align: left;
  flex: 1;
  min-width: 0;
}

.undo-toast-close {
  border: none;
  background: transparent;
  color: #ffffff;
  font-size: 1.35rem;
  line-height: 1;
  cursor: pointer;
  padding: 0 0.1rem;
  flex-shrink: 0;
}

.undo-toast-close:hover {
  opacity: 0.85;
}

.composer {
  padding: 0.75rem;
  border-top: 1px solid #e2e8f0;
  flex-shrink: 0;
}

.composer-form {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.composer-input {
  border: 2px solid #388bfd;
  border-radius: 8px;
  padding: 0.55rem 0.65rem;
  font-size: 0.875rem;
  line-height: 1.4;
  background: #fff;
  box-shadow: none;
}

.composer-input:focus {
  outline: none;
  border-color: mixin.$main;
}

.composer-actions {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.composer-submit-btn {
  border: none;
  border-radius: 8px;
  padding: 0.42rem 0.72rem;
  background: mixin.$main;
  color: mixin.$white;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
}

.composer-submit-btn:hover:not(:disabled) {
  background: mixin.$main-hover;
}

.composer-submit-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.composer-close-btn {
  border: none;
  background: transparent;
  color: #626f86;
  font-size: 1.2rem;
  line-height: 1;
  padding: 0.35rem 0.45rem;
  border-radius: 6px;
  cursor: pointer;
  margin-left: auto;
}

.composer-close-btn:hover {
  background: rgba(9, 30, 66, 0.08);
  color: #44546f;
}

.add-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  border: none;
  border-radius: 10px;
  padding: 0.65rem 0.85rem;
  background: #0f172a;
  color: #fff;
  font-weight: 700;
  cursor: pointer;
}

.add-card-btn {
  width: 100%;
  text-align: left;
  background: mixin.$gray;
  color: mixin.$text;
}

.ghost-btn {
  background: transparent;
  color: #0f172a;
  border: 1px solid #94a3b8;
  font-weight: 600;
  border-radius: 10px;
  padding: 0.65rem 0.85rem;
  cursor: pointer;
}

button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.create-list-column {
  align-self: start;
  min-width: 0;
}

.list-create-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  width: 100%;
  text-align: left;
  background: rgba(15, 23, 42, 0.08);
}

.err {
  max-width: 72rem;
  margin: 0 auto 0.8rem;
  color: #b91c1c;
  font-weight: 700;
}

</style>
