<template>
  <main class="board-page">
    <header class="board-header">
      <div class="header-top">
        <NuxtLink :to="`/org/${slug}`" class="back-link">← プロジェクト一覧</NuxtLink>
        <button class="ghost-btn" type="button" :disabled="loading" @click="load">
          {{ loading ? '更新中...' : '再読み込み' }}
        </button>
      </div>
      <h1>プロジェクト #{{ projectId }} ボード</h1>
      <p class="subtitle">
        Trello 風のボードでタスクを管理できます。ドラッグ&ドロップでリスト間を移動できます。
      </p>
    </header>

    <section class="toolbar">
      <label class="field search-field">
        <span>検索</span>
        <input
          v-model.trim="searchQuery"
          type="search"
          placeholder="カード名で絞り込み"
        />
      </label>

      <label class="field sort-field">
        <span>並び順</span>
        <select v-model="sortMode">
          <option value="newest">新しい順</option>
          <option value="oldest">古い順</option>
          <option value="name">名前順</option>
        </select>
      </label>
    </section>

    <p v-if="error" class="err">{{ error }}</p>

    <section class="board">
      <article
        v-for="list in allLists"
        :key="list.key"
        class="list-column"
      >
        <header class="list-header">
          <h2>{{ list.title }}</h2>
          <span class="list-count">{{ visibleCount(list.key) }}</span>
        </header>

        <draggable
          :list="tasksByList[list.key]"
          item-key="id"
          :class="['cards', { 'cards-has-items': visibleCount(list.key) > 0 }]"
          group="board-cards"
          ghost-class="drag-ghost"
          drag-class="drag-active"
          @change="onListChange($event, list)"
        >
          <template #item="{ element: task }">
            <article v-show="isTaskVisible(task)" class="task-card">
              <p class="task-title">{{ task.title }}</p>
              <p class="task-meta">#{{ task.id }} / {{ task.status }}</p>
            </article>
          </template>
        </draggable>
        <div class="cards-empty">
          <p v-if="loading && !visibleCount(list.key)" class="empty">読み込み中...</p>
        </div>

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
  </main>
</template>

<script setup lang="ts">
import draggable from 'vuedraggable'
import { useApi } from '../../../../composables/useApi'

const route = useRoute()
const slug = computed(() => route.params.slug as string)
const projectId = computed(() => route.params.id as string)
const { api } = useApi()

type Task = { id: number; title: string; status: string; list_id: number | null }
type ListDef = { key: string; title: string; listId: number }
type ListRowRes = { id: number; name: string; sort_order: number; created_at?: string }

const tasks = ref<Task[] | null>(null)
const tasksByList = reactive<Record<string, Task[]>>({})
const error = ref<string | null>(null)
const pending = ref(false)
const loading = ref(false)
const searchQuery = ref('')
const sortMode = ref<'newest' | 'oldest' | 'name'>('newest')
const showListCreator = ref(false)
const newListTitle = ref('')
const activeComposerKey = ref<string | null>(null)
const cardDrafts = reactive<Record<string, string>>({})
const lists = ref<ListDef[]>([])

const allLists = computed(() => lists.value)
const filteredTaskIds = computed<Set<number> | null>(() => {
  const query = searchQuery.value.toLowerCase()
  if (!query) return null
  const ids = new Set<number>()
  for (const task of tasks.value ?? []) {
    if (task.title.toLowerCase().includes(query)) ids.add(task.id)
  }
  return ids
})

function taskComparator (a: Task, b: Task) {
  if (sortMode.value === 'name') return a.title.localeCompare(b.title, 'ja')
  if (sortMode.value === 'newest') return b.id - a.id
  return a.id - b.id
}

function isTaskVisible (task: Task) {
  const ids = filteredTaskIds.value
  return !ids || ids.has(task.id)
}

function visibleCount (listKey: string) {
  const cards = tasksByList[listKey] ?? []
  return cards.filter(isTaskVisible).length
}

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
  applySortToAllLists()
}

function applySortToAllLists () {
  for (const key of Object.keys(tasksByList)) {
    tasksByList[key] = [...(tasksByList[key] ?? [])].sort(taskComparator)
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
    const [listsRes, tasksRes] = await Promise.all([
      api<{ data: ListRowRes[] }>(
        `/orgs/${slug.value}/projects/${projectId.value}/lists`,
      ),
      api<{ data: Task[] }>(
        `/orgs/${slug.value}/projects/${projectId.value}/tasks`,
      ),
    ])

    const sortedLists = [...listsRes.data].sort((a, b) => a.sort_order - b.sort_order)
    lists.value = sortedLists.map(row => ({
      key: `list_${row.id}`,
      title: row.name,
      listId: row.id,
    }))
    for (const list of lists.value) {
      if (!(list.key in cardDrafts)) cardDrafts[list.key] = ''
      if (!(list.key in tasksByList)) tasksByList[list.key] = []
    }

    tasks.value = tasksRes.data
    rebuildBoardFromTasks()
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : '読み込みに失敗しました'
  } finally {
    loading.value = false
  }
}

function openComposer (key: string) {
  activeComposerKey.value = key
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

async function createTask (status: string) {
  const title = (cardDrafts[status] || '').trim()
  if (!title) return
  const list = allLists.value.find(item => item.key === status)
  if (!list) return
  pending.value = true
  try {
    await api(`/orgs/${slug.value}/projects/${projectId.value}/tasks`, {
      method: 'POST',
      body: { title, status: 'todo', list_id: list.listId },
    })
    cardDrafts[status] = ''
    activeComposerKey.value = null
    await load()
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : '作成に失敗しました'
  } finally {
    pending.value = false
  }
}

onMounted(load)

watch(sortMode, () => {
  applySortToAllLists()
})
</script>

<style scoped>
.board-page {
  min-height: 100vh;
  padding: 1.5rem 1rem 2rem;
  font-family: system-ui, sans-serif;
  background: linear-gradient(160deg, #eef2ff 0%, #dbeafe 35%, #f8fafc 100%);
}

.board-header {
  max-width: 72rem;
  margin: 0 auto 1rem;
}

.header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

h1 {
  margin: 0.75rem 0 0.25rem;
  font-size: 1.8rem;
}

.subtitle {
  margin: 0;
  color: #475569;
}

.back-link {
  color: #0f172a;
  text-decoration: none;
  font-weight: 600;
}

.back-link:hover {
  text-decoration: underline;
}

.toolbar {
  max-width: 72rem;
  margin: 0 auto 1rem;
  display: grid;
  grid-template-columns: minmax(18rem, 1fr) minmax(12rem, 16rem);
  gap: 0.75rem;
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
  max-width: 72rem;
  margin: 0 auto;
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(17rem, 1fr);
  gap: 0.9rem;
  align-items: start;
  overflow-x: auto;
  padding-bottom: 0.5rem;
}

.list-column {
  background: #f8fafc;
  border-radius: 14px;
  border: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  max-height: 72vh;
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
}

.list-header h2 {
  margin: 0;
  font-size: 1rem;
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
  flex: 1;
}

.cards-has-items {
  padding-bottom: 0.65rem;
}

.cards-empty {
  padding: 0 0.75rem 0.65rem;
}

.cards-empty:empty {
  display: none;
}

.task-card {
  background: #fff;
  border: 1px solid #cbd5e1;
  border-radius: 12px;
  padding: 0.75rem;
  cursor: grab;
  box-shadow: 0 1px 0 rgba(15, 23, 42, 0.06);
}

.task-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.1);
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

@media (max-width: 820px) {
  .toolbar {
    grid-template-columns: 1fr;
  }
}
</style>
