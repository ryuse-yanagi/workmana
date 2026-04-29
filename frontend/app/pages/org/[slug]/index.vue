<template>
  <main class="board-page">
    <header class="board-header">
      <div class="header-top">
        <NuxtLink to="/" class="back-link">← ホーム</NuxtLink>
        <button class="ghost-btn" type="button" :disabled="loading" @click="load">
          {{ loading ? '更新中...' : '再読み込み' }}
        </button>
      </div>
      <h1>{{ slug }} のプロジェクトボード</h1>
      <p class="subtitle">
        Trello 風のボードでプロジェクトを管理できます。カードをクリックすると詳細画面へ移動します。
      </p>
    </header>

    <section class="toolbar">
      <label class="field search-field">
        <span>検索</span>
        <input
          v-model.trim="searchQuery"
          type="search"
          placeholder="プロジェクト名で絞り込み"
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
        v-for="lane in lanes"
        :key="lane.key"
        :class="['lane', { 'lane-custom': isCustomLane(lane.key) }]"
      >
        <header class="lane-header">
          <h2>{{ lane.title }}</h2>
          <span class="count">{{ visibleCount(lane.key) }}</span>
        </header>

        <draggable
          :list="laneProjects[lane.key]"
          item-key="id"
          :class="['cards', { 'cards-has-items': visibleCount(lane.key) > 0 }]"
          group="project-board"
          ghost-class="drag-ghost"
          drag-class="drag-active"
          @end="onCardDragEnd"
        >
          <template #item="{ element: p }">
            <NuxtLink
              v-show="isProjectVisible(p)"
              :to="`/org/${slug}/projects/${p.id}`"
              class="project-card"
            >
              <h3>{{ p.name }}</h3>
              <p>#{{ p.id }}</p>
            </NuxtLink>
          </template>
        </draggable>

        <div class="cards-empty">
          <p v-if="loading && !visibleCount(lane.key)" class="empty">読み込み中...</p>
        </div>

        <div class="lane-footer">
          <button
            v-if="activeComposerKey !== lane.key"
            class="add-card-btn"
            type="button"
            @click="openComposer(lane.key)"
          >
          <span>＋</span>カードの作成
          </button>
          <form v-else class="create-form" @submit.prevent="createProject(lane.key)">
            <label class="field">
              <span>カード名</span>
              <input
                v-model.trim="cardDrafts[lane.key]"
                type="text"
                required
                minlength="2"
                maxlength="80"
                placeholder="例: 顧客向けダッシュボード刷新"
              />
            </label>
            <div class="form-actions">
              <button type="submit" :disabled="pending || !cardDrafts[lane.key]">
                {{ pending ? '作成中...' : '追加' }}
              </button>
              <button type="button" class="ghost-btn" @click="closeComposer">
                キャンセル
              </button>
            </div>
          </form>
        </div>
      </article>

      <article class="list-creator">
        <button
          v-if="!showListCreator"
          class="ghost-btn list-create-btn"
          type="button"
          @click="showListCreator = true"
        >
        <span>＋</span>リストの作成
        </button>
        <form v-else class="create-form" @submit.prevent="createList">
          <label class="field">
            <span>リスト名</span>
            <input
              v-model.trim="newLaneTitle"
              type="text"
              required
              minlength="2"
              maxlength="32"
              placeholder="例: 保留中"
            />
          </label>
          <div class="form-actions">
            <button type="submit" :disabled="!newLaneTitle">追加</button>
            <button type="button" class="ghost-btn" @click="cancelCreateList">キャンセル</button>
          </div>
        </form>
      </article>
    </section>
  </main>
</template>

<script setup lang="ts">
import draggable from 'vuedraggable'
import { useApi } from '../../../composables/useApi'

const route = useRoute()
const slug = computed(() => route.params.slug as string)
const { api } = useApi()

const projects = ref<{ id: number; name: string }[] | null>(null)
const error = ref<string | null>(null)
const pending = ref(false)
const loading = ref(false)
const searchQuery = ref('')
const sortMode = ref<'newest' | 'oldest' | 'name'>('newest')
const activeComposerKey = ref<string | null>(null)
const cardDrafts = reactive<Record<string, string>>({})
const showListCreator = ref(false)
const newLaneTitle = ref('')
const laneStates = ref<{ key: string; title: string; projectIds: number[] }[]>([])

type BoardLane = {
  key: string
  title: string
  projects: { id: number; name: string }[]
}
type PersistedLane = { key: string; title: string; projectIds: number[] }
type BoardProject = { id: number; name: string }

const STORAGE_PREFIX = 'task-manager:org-board:'
const defaultLanes: PersistedLane[] = [
  { key: 'todo', title: 'To Do', projectIds: [] },
  { key: 'doing', title: '進行中', projectIds: [] },
  { key: 'done', title: '完了', projectIds: [] },
]
const defaultLaneKeys = new Set(defaultLanes.map(lane => lane.key))

const storageKey = computed(() => `${STORAGE_PREFIX}${slug.value}`)
const laneProjects = reactive<Record<string, BoardProject[]>>({})

const projectMap = computed(() => {
  const map = new Map<number, { id: number; name: string }>()
  for (const project of projects.value ?? []) {
    map.set(project.id, project)
  }
  return map
})

function projectComparator (a: BoardProject, b: BoardProject) {
  if (sortMode.value === 'name') return a.name.localeCompare(b.name, 'ja')
  if (sortMode.value === 'newest') return b.id - a.id
  return a.id - b.id
}

const filteredProjectIds = computed<Set<number> | null>(() => {
  const query = searchQuery.value.toLowerCase()
  if (!query) return null
  const ids = new Set<number>()
  for (const project of projects.value ?? []) {
    if (project.name.toLowerCase().includes(query)) ids.add(project.id)
  }
  return ids
})

const lanes = computed<BoardLane[]>(() => {
  return laneStates.value.map(lane => {
    return { key: lane.key, title: lane.title, projects: laneProjects[lane.key] ?? [] }
  })
})

function saveLaneState () {
  if (!import.meta.client) return
  localStorage.setItem(storageKey.value, JSON.stringify(laneStates.value))
}

function readLaneState (): PersistedLane[] | null {
  if (!import.meta.client) return null
  const raw = localStorage.getItem(storageKey.value)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return null
    const valid = parsed.filter((lane): lane is PersistedLane => {
      if (typeof lane !== 'object' || lane === null) return false
      const candidate = lane as Partial<PersistedLane>
      return typeof candidate.key === 'string' &&
        typeof candidate.title === 'string' &&
        Array.isArray(candidate.projectIds)
    })
    return valid.length ? valid : null
  } catch {
    return null
  }
}

function normalizeLanesWithProjects () {
  const knownProjectIds = new Set(projectMap.value.keys())
  const assigned = new Set<number>()

  laneStates.value = laneStates.value.map((lane) => {
    const uniq = new Set<number>()
    const ids = lane.projectIds.filter((id) => {
      if (!knownProjectIds.has(id)) return false
      if (assigned.has(id) || uniq.has(id)) return false
      uniq.add(id)
      assigned.add(id)
      return true
    })
    return { ...lane, projectIds: ids }
  })

  if (!laneStates.value.length) {
    laneStates.value = defaultLanes.map(lane => ({ ...lane }))
  }

  const fallback = laneStates.value[0]
  for (const id of knownProjectIds) {
    if (!assigned.has(id) && fallback) fallback.projectIds.unshift(id)
  }
}

function syncLaneProjectsFromState () {
  for (const lane of laneStates.value) {
    laneProjects[lane.key] = lane.projectIds
      .map(id => projectMap.value.get(id))
      .filter((project): project is BoardProject => Boolean(project))
  }
}

function saveLaneOrderFromProjects () {
  for (const lane of laneStates.value) {
    lane.projectIds = (laneProjects[lane.key] ?? []).map(project => project.id)
  }
  saveLaneState()
}

function applySortToAllLanes () {
  for (const lane of laneStates.value) {
    laneProjects[lane.key] = [...(laneProjects[lane.key] ?? [])].sort(projectComparator)
  }
  saveLaneOrderFromProjects()
}

function isProjectVisible (project: BoardProject) {
  const ids = filteredProjectIds.value
  return !ids || ids.has(project.id)
}

function visibleCount (laneKey: string) {
  const cards = laneProjects[laneKey] ?? []
  return cards.filter(isProjectVisible).length
}

function isCustomLane (laneKey: string) {
  return !defaultLaneKeys.has(laneKey)
}

function openComposer (laneKey: string) {
  activeComposerKey.value = laneKey
}

function closeComposer () {
  activeComposerKey.value = null
}

function createList () {
  const title = newLaneTitle.value.trim()
  if (!title) return
  const baseKey = title.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  const key = `${baseKey || 'lane'}_${Date.now()}`
  const alreadyExists = laneStates.value.some(lane => lane.key === key)
  if (!alreadyExists) {
    laneStates.value.push({ key, title, projectIds: [] })
    laneProjects[key] = []
    cardDrafts[key] = ''
    saveLaneState()
  }
  newLaneTitle.value = ''
  showListCreator.value = false
}

function cancelCreateList () {
  newLaneTitle.value = ''
  showListCreator.value = false
}

async function load () {
  error.value = null
  loading.value = true
  try {
    const res = await api<{ data: { id: number; name: string }[] }>(`/orgs/${slug.value}/projects`)
    projects.value = res.data
    normalizeLanesWithProjects()
    syncLaneProjectsFromState()
    saveLaneState()
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : '読み込みに失敗しました'
  } finally {
    loading.value = false
  }
}

async function createProject (laneKey: string) {
  const projectName = (cardDrafts[laneKey] || '').trim()
  if (!projectName) return
  const lane = laneStates.value.find(item => item.key === laneKey)
  if (!lane) return
  const beforeIds = new Set((projects.value ?? []).map(project => project.id))
  pending.value = true
  try {
    const created = await api<{ id?: number; data?: { id?: number } }>(`/orgs/${slug.value}/projects`, {
      method: 'POST',
      body: { name: projectName },
    })
    const createdId = created.id ?? created.data?.id
    if (typeof createdId === 'number' && !lane.projectIds.includes(createdId)) {
      lane.projectIds.unshift(createdId)
    }
    cardDrafts[laneKey] = ''
    activeComposerKey.value = null
    await load()
    if (typeof createdId !== 'number') {
      const newProject = (projects.value ?? []).find(project => !beforeIds.has(project.id))
      if (newProject && !lane.projectIds.includes(newProject.id)) {
        lane.projectIds.unshift(newProject.id)
        syncLaneProjectsFromState()
        saveLaneState()
      }
    }
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : '作成に失敗しました'
  } finally {
    pending.value = false
  }
}

function onCardDragEnd () {
  saveLaneOrderFromProjects()
}

onMounted(async () => {
  laneStates.value = readLaneState() ?? defaultLanes.map(lane => ({ ...lane }))
  for (const lane of laneStates.value) {
    laneProjects[lane.key] = []
    if (!(lane.key in cardDrafts)) cardDrafts[lane.key] = ''
  }
  await load()
})

watch(sortMode, () => {
  applySortToAllLanes()
})
</script>

<style scoped>
.board-page {
  min-height: 100vh;
  padding: 1.5rem 1rem 2rem;
  background: linear-gradient(160deg, #eef2ff 0%, #dbeafe 35%, #f8fafc 100%);
  font-family: system-ui, sans-serif;
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
  overflow-x: auto;
  padding-bottom: 0.5rem;
  align-items: start;
}

.lane {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  display: flex;
  flex-direction: column;
  max-height: 72vh;
}

.lane-custom {
  max-height: 86vh;
}

.lane-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
}

.lane-header h2 {
  margin: 0;
  font-size: 1rem;
}

.count {
  color: #475569;
  font-size: 0.85rem;
  background: #e2e8f0;
  border-radius: 999px;
  padding: 0.15rem 0.55rem;
}

.cards {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  padding: 0 0.75rem;
  overflow-y: auto;
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

.project-card {
  display: block;
  text-decoration: none;
  color: #0f172a;
  background: #fff;
  border: 1px solid #cbd5e1;
  border-radius: 12px;
  padding: 0.75rem;
  box-shadow: 0 1px 0 rgba(15, 23, 42, 0.06);
}

.project-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.1);
}

.drag-ghost {
  opacity: 0.4;
}

.drag-active {
  cursor: grabbing;
}

.project-card h3 {
  margin: 0;
  font-size: 0.95rem;
}

.project-card p {
  margin: 0.4rem 0 0;
  color: #64748b;
  font-size: 0.8rem;
}

.create-form {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.lane-footer {
  border-top: 1px solid #e2e8f0;
  padding: 0.75rem;
}

.add-card-btn {
  width: 100%;
  text-align: left;
  background: #e2e8f0;
  color: #0f172a;
}

.form-actions {
  display: flex;
  gap: 0.5rem;
}

.list-creator {
  min-width: 14rem;
  align-self: start;
}

.list-create-btn {
  width: 100%;
  text-align: left;
  background: rgba(15, 23, 42, 0.08);
}

button {
  border: none;
  border-radius: 10px;
  padding: 0.65rem 0.85rem;
  background: #0f172a;
  color: #fff;
  font-weight: 700;
  cursor: pointer;
}

button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.ghost-btn {
  background: transparent;
  color: #0f172a;
  border: 1px solid #94a3b8;
  font-weight: 600;
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
