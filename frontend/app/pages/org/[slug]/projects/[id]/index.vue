<template>
  <main class="board-page" :style="boardPageCssVars">
    <!-- ページ別ヘッダー -->
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
          class="header-primary-btn linkish"
          :to="`/org/${slug}/projects/${projectId}/archived`"
        >
          アーカイブ済みカード
        </NuxtLink>
      </div>
    </header>

    <p v-if="error" class="err">{{ error }}</p>

    <ConfirmModal
      v-model="archiveConfirmTaskOpen"
      title="タスクカードのアーカイブ確認"
      confirm-text="アーカイブ"
      variant="danger"
      @confirm="confirmArchiveFromModal"
    />

    <div
      v-if="undoToastTask"
      class="undo-toast"
      role="status"
    >
      <span class="undo-toast-message">「{{ undoToastTask.title }}」をアーカイブしました</span>
      <button type="button" class="undo-toast-close" aria-label="通知を閉じる" @click="clearUndoTimer">×</button>
    </div>

    <section class="board">
      <article
        v-for="list in allLists"
        :key="list.key"
        class="list-column"
      >
        <header class="list-header" :class="{ 'list-header--editing': editingListKey === list.key }">
          <template v-if="editingListKey === list.key">
            <form class="list-header-edit" @submit.prevent="saveListTitle(list)">
              <input
                v-model.trim="listEditDrafts[list.key]"
                type="text"
                maxlength="255"
                class="list-title-input"
                :disabled="listRenamePending"
                @keydown.escape.prevent="cancelListEdit"
              />
              <div class="edit-actions">
                <button type="submit" class="ghost-btn small" :disabled="listRenamePending || !listEditDrafts[list.key]?.trim()">
                  {{ listRenamePending ? '保存中...' : '保存' }}
                </button>
                <button type="button" class="ghost-btn small" :disabled="listRenamePending" @click="cancelListEdit">
                  キャンセル
                </button>
              </div>
            </form>
          </template>
          <template v-else>
            <h2
              class="list-title-text list-title-clickable"
              role="button"
              tabindex="0"
              @click="startListEdit(list)"
              @keydown.enter.prevent="startListEdit(list)"
              @keydown.space.prevent="startListEdit(list)"
            >
              {{ list.title }}
            </h2>
            <div class="list-header-right">
              <span class="list-count">{{ visibleCount(list.key) }}</span>
            </div>
          </template>
        </header>

        <draggable
          v-if="visibleCount(list.key) > 0"
          :list="tasksByList[list.key]"
          item-key="id"
          class="cards"
          group="board-cards"
          ghost-class="drag-ghost"
          drag-class="drag-active"
          filter=".no-drag"
          @scroll.passive="closeCardMenu"
          @change="onListChange($event, list)"
        >
          <template #item="{ element: task }">
            <article
              v-show="isTaskVisible(task)"
              :class="['task-card', { 'task-card--fade-in': isTaskJustCreated(task.id) }]"
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
                <div class="task-card-head">
                  <p class="task-title">
                    {{ task.title }}
                  </p>
                  <div
                    class="card-menu-wrap no-drag"
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
                      ⋯
                    </button>
                  </div>
                </div>
                <p class="task-meta">#{{ task.id }} / {{ task.status }}</p>
                <div v-if="task.labels?.length" class="task-label-list">
                  <span v-for="label in task.labels" :key="label.id" class="task-label-chip">
                    <span class="task-label-dot" :style="{ backgroundColor: label.color }" />
                    {{ label.name }}
                  </span>
                </div>
              </template>
            </article>
          </template>
        </draggable>
        <div class="composer">
          <button
            v-if="activeComposerKey !== list.key"
            type="button"
            class="add-btn add-card-btn"
            @click="openComposer(list.key)"
          >
            <span>＋</span>カードの作成
          </button>
          <form v-else class="composer-form" @submit.prevent="createTask(list.key)">
            <label class="field">
              <span>カード名</span>
              <input
                v-model.trim="cardDrafts[list.key]"
                type="text"
                required
                minlength="2"
                maxlength="120"
                placeholder="カード名を入力"
              />
            </label>
            <label class="field">
              <span>ラベル（複数選択）</span>
              <div class="task-label-picker">
                <label v-for="label in orgLabels" :key="label.id" class="label-option">
                  <input
                    v-model="taskLabelDrafts[list.key]"
                    type="checkbox"
                    :value="label.id"
                  />
                  <span class="task-label-dot" :style="{ backgroundColor: label.color }" />
                  <span>{{ label.name }}</span>
                </label>
                <p v-if="!orgLabels.length" class="label-empty">ラベルは設定画面で作成できます。</p>
              </div>
            </label>
            <div class="composer-actions">
              <button type="submit" class="add-btn" :disabled="pending || !cardDrafts[list.key]">
                {{ pending ? '作成中...' : '追加' }}
              </button>
              <button type="button" class="ghost-btn" @click="closeComposer">
                キャンセル
              </button>
            </div>
          </form>
        </div>
      </article>

      <article class="create-list-column">
        <button
          v-if="!showListCreator"
          type="button"
          class="ghost-btn list-create-btn"
          @click="showListCreator = true"
        >
          <span>＋</span>リストの作成
        </button>
        <form v-else class="list-form" @submit.prevent="createList">
          <label class="field">
            <span>リスト名</span>
            <input
              v-model.trim="newListTitle"
              type="text"
              required
              minlength="2"
              maxlength="40"
              placeholder="リスト名を入力"
            />
          </label>
          <div class="composer-actions">
            <button type="submit" class="add-btn" :disabled="!newListTitle">追加</button>
            <button type="button" class="ghost-btn" @click="cancelCreateList">キャンセル</button>
          </div>
        </form>
      </article>
    </section>

    <Teleport to="body">
      <ul
        v-if="openMenuTask && cardMenuPosition"
        class="card-menu card-menu--portal"
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
            編集
          </button>
        </li>
        <li role="none">
          <button
            type="button"
            class="card-menu-item"
            role="menuitem"
            @click="openArchiveConfirm(openMenuTask)"
          >
            アーカイブ
          </button>
        </li>
      </ul>
    </Teleport>
  </main>
</template>

<script setup lang="ts">
import draggable from 'vuedraggable'
import { useApi } from '../../../../../composables/useApi'
import { useOrgTerminology } from '../../../../../composables/useOrgTerminology'

definePageMeta({ name: 'org-slug-projects-id' })

const route = useRoute()
const slug = computed(() => route.params.slug as string)
const projectId = computed(() => route.params.id as string)
const { api } = useApi()
const { fetchWorkUnitLabel, DEFAULT_WORK_UNIT_LABEL } = useOrgTerminology()

type Label = { id: number; name: string; color: string }
type Task = { id: number; title: string; status: string; list_id: number | null; labels?: Label[] }
type ListDef = { key: string; title: string; listId: number }
type ListRowRes = { id: number; name: string; sort_order: number; created_at?: string }

const tasks = ref<Task[] | null>(null)
const tasksByList = reactive<Record<string, Task[]>>({})
const error = ref<string | null>(null)
const pending = ref(false)
const loading = ref(false)
const hasLoadedOnce = ref(false)
const searchQuery = ref('')
const showListCreator = ref(false)
const newListTitle = ref('')
const activeComposerKey = ref<string | null>(null)
const cardDrafts = reactive<Record<string, string>>({})
const taskLabelDrafts = reactive<Record<string, number[]>>({})
const lists = ref<ListDef[]>([])
const orgLabels = ref<Label[]>([])
const labelFilterId = ref('')
const editingListKey = ref<string | null>(null)
const listEditDrafts = reactive<Record<string, string>>({})
const listRenamePending = ref(false)
const editingTaskId = ref<number | null>(null)
const taskTitleDraft = ref('')
const taskRenamePending = ref(false)
const workUnitLabel = ref(DEFAULT_WORK_UNIT_LABEL)
const workUnitListLabel = computed(() => `${workUnitLabel.value}一覧`)
const justCreatedTaskIds = reactive<Record<number, true>>({})

const globalHeaderOffsetPx = ref(52)

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

function closeCardMenu () {
  openCardMenuTaskId.value = null
  cardMenuPosition.value = null
}

function toggleCardMenu (taskId: number, ev: MouseEvent) {
  ev.stopPropagation()
  if (openCardMenuTaskId.value === taskId) {
    closeCardMenu()
    return
  }
  const el = ev.currentTarget as HTMLElement | null
  if (el && import.meta.client) {
    const r = el.getBoundingClientRect()
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
  } else if (el) {
    cardMenuPosition.value = { top: 0, left: 0 }
  }
  openCardMenuTaskId.value = taskId
}

function onGlobalClick (ev: Event) {
  const t = ev.target
  if (t instanceof Node) {
    const el = t instanceof Element ? t : t.parentElement
    if (el && el.closest('.card-menu-wrap')) {
      return
    }
    if (el && el.closest('.card-menu--portal')) {
      return
    }
  }
  closeCardMenu()
}

function onWindowResize () {
  closeCardMenu()
  updateStickyOffsets()
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

async function onListChange (
  event: {
    added?: { element: Task }
    moved?: { element: Task }
    removed?: { element: Task }
  },
  toList: ListDef,
) {
  if (event.moved || event.removed) {
    return
  }
  if (!event.added) {
    return
  }

  const movedTask = event.added.element
  const prevListId = movedTask.list_id
  movedTask.list_id = toList.listId

  try {
    await updateTaskList(movedTask.id, toList.listId)
  } catch (e: unknown) {
    movedTask.list_id = prevListId
    error.value = e instanceof Error ? e.message : '移動の保存に失敗しました'
    await load()
  }
}

async function load () {
  error.value = null
  loading.value = true
  try {
    const [listsRes, tasksRes, labelsRes, label] = await Promise.all([
      api<{ data: ListRowRes[] }>(
        `/orgs/${slug.value}/projects/${projectId.value}/lists`,
      ),
      api<{ data: Task[] }>(
        `/orgs/${slug.value}/projects/${projectId.value}/tasks`,
      ),
      api<{ data: Label[] }>(
        `/orgs/${slug.value}/task-labels`,
      ),
      fetchWorkUnitLabel(slug.value),
    ])

    const sortedLists = [...listsRes.data].sort((a, b) => a.sort_order - b.sort_order)
    lists.value = sortedLists.map(row => ({
      key: `list_${row.id}`,
      title: row.name,
      listId: row.id,
    }))
    for (const list of lists.value) {
      if (!(list.key in cardDrafts)) cardDrafts[list.key] = ''
      if (!(list.key in taskLabelDrafts)) taskLabelDrafts[list.key] = []
      if (!(list.key in tasksByList)) tasksByList[list.key] = []
    }

    tasks.value = tasksRes.data
    orgLabels.value = labelsRes.data
    workUnitLabel.value = label
    rebuildBoardFromTasks()
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : '読み込みに失敗しました'
  } finally {
    loading.value = false
    hasLoadedOnce.value = true
    if (import.meta.client) {
      await nextTick()
      updateStickyOffsets()
    }
  }
}

function openComposer (key: string) {
  activeComposerKey.value = key
  if (!(key in taskLabelDrafts)) {
    taskLabelDrafts[key] = []
  }
}

function closeComposer () {
  activeComposerKey.value = null
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
    await load()
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

function startListEdit (list: ListDef) {
  editingTaskId.value = null
  editingListKey.value = list.key
  listEditDrafts[list.key] = list.title
}

function cancelListEdit () {
  editingListKey.value = null
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
    const labelIds = (taskLabelDrafts[status] ?? []).map(id => Number(id))
    const created = await api<Task>(`/orgs/${slug.value}/projects/${projectId.value}/tasks`, {
      method: 'POST',
      body: { title, status: 'todo', list_id: list.listId, label_ids: labelIds },
    })
    cardDrafts[status] = ''
    taskLabelDrafts[status] = []
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

onMounted(() => {
  void load()

  if (!import.meta.client) {
    return
  }

  window.addEventListener('click', onGlobalClick)
  window.addEventListener('resize', onWindowResize)

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
  }
  globalHeaderObserver?.disconnect()
  globalHeaderObserver = null
  clearUndoTimer()
})

</script>

<style scoped>
.board-page {
  height: calc(100dvh - var(--global-header-offset, 52px));
  padding: 0 1rem 0;
  margin-top: calc(-1 * var(--app-shell-page-pad, 0.25rem));
  padding-top: 0;
  font-family: system-ui, sans-serif;
  display: flex;
  flex-direction: column;
}

.page-header {
  position: sticky;
  top: var(--global-header-offset, 52px);
  z-index: 40;
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
  font-size: 1.1rem;
  font-weight: 900;
  color: #2b2e2f;
  line-height: 1.1;
  flex-shrink: 0;
}

.subheader-back-link {
  text-decoration: none;
  color: #06b6d4;
  transition: color 0.16s ease;
}

.subheader-back-link:hover {
  color: #67e8f9;
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

.board {
  width: calc(100% + 2rem);
  max-width: none;
  margin: 0.55rem -1rem 0;
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(17rem, 1fr);
  gap: 0.9rem;
  align-items: start;
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 0;
  margin-bottom: 0.8rem;
  flex: 1;
  min-height: 0;
}

.board > :first-child {
  margin-left: 1rem;
}

.board > :last-child {
  margin-right: 1rem;
}

.list-column {
  background: #f8fafc;
  border-radius: 14px;
  border: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  /* Trello のように内容に応じて伸びる（上限到達後は cards 側でスクロール） */
  height: auto;
  max-height: calc((100dvh - var(--tm-global-header-height, 52px) - var(--tm-page-header-height, 48px)) * 0.82);
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
}

.list-header--editing {
  flex-direction: column;
  align-items: stretch;
}

.list-title-text {
  margin: 0;
  font-size: 1rem;
  flex: 1;
  min-width: 0;
  line-height: 1.35;
}

.list-title-clickable {
  cursor: pointer;
}

.list-title-clickable:focus-visible {
  outline: 2px solid #2563eb;
  outline-offset: 2px;
  border-radius: 4px;
}

.list-header-right {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  flex-shrink: 0;
}

.list-header-edit {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  width: 100%;
}

.list-title-input {
  width: 100%;
  box-sizing: border-box;
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

.cards {
  padding: 0 0.75rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  flex: 0 1 auto;
  min-height: 0;
  max-height: calc((100dvh - var(--tm-global-header-height, 52px) - var(--tm-page-header-height, 48px)) * 0.82 - 8.5rem);
  padding-bottom: 0.65rem;
}

.task-card {
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

.drag-ghost {
  opacity: 0.4;
}

.drag-active {
  cursor: grabbing;
}

.task-title {
  margin: 0;
  font-weight: 700;
}

.task-meta {
  margin: 0.4rem 0 0;
  color: #64748b;
  font-size: 0.8rem;
}

.task-label-list {
  margin-top: 0.35rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.task-label-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.22rem;
  border-radius: 999px;
  padding: 0.15rem 0.4rem;
  font-size: 0.73rem;
  color: #334155;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}

.task-label-dot {
  width: 0.52rem;
  height: 0.52rem;
  border-radius: 999px;
}

.task-label-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.label-option {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  border: 1px solid #dbe3ee;
  border-radius: 999px;
  padding: 0.2rem 0.5rem;
  font-size: 0.82rem;
  font-weight: 600;
  color: #334155;
  background: #fff;
}

.label-empty {
  margin: 0.15rem 0 0;
  color: #64748b;
  font-size: 0.82rem;
}

.task-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.45rem;
}

.task-card-head .task-title {
  flex: 1;
  min-width: 0;
}

.card-menu-wrap {
  position: relative;
  flex-shrink: 0;
}

.card-menu-trigger {
  border: none;
  background: transparent;
  color: #64748b;
  font-size: 1.15rem;
  line-height: 1;
  padding: 0.15rem 0.35rem;
  border-radius: 6px;
  cursor: pointer;
}

.card-menu-trigger:hover,
.card-menu-trigger:focus-visible {
  background: #f1f5f9;
  color: #0f172a;
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
  background: #45c3cf;
  color: #ffffff;
  border-radius: 10px;
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.55;
  white-space: nowrap;
  box-shadow: 0 10px 22px rgba(14, 116, 144, 0.28);
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
}

.composer-form,
.list-form {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

input {
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  padding: 0.62rem 0.75rem;
  font-size: 0.94rem;
}

.composer-actions {
  display: flex;
  gap: 0.5rem;
}

.add-btn {
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
  background: #e2e8f0;
  color: #0f172a;
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
  min-width: 14rem;
  align-self: start;
}

.list-create-btn {
  width: 100%;
  text-align: left;
  background: rgba(15, 23, 42, 0.08);
}

.empty {
  margin: 0;
  border: 1px dashed #cbd5e1;
  border-radius: 10px;
  color: #64748b;
  padding: 0.65rem;
  background: #fff;
}

.err {
  max-width: 72rem;
  margin: 0 auto 0.8rem;
  color: #b91c1c;
  font-weight: 700;
}

</style>
