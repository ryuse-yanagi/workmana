<template>
  <main class="archived-page" :class="{ 'archived-page--await': !pageReady && !fatalLoadError }">
    <template v-if="fatalLoadError">
      <PageLoadFatal :message="fatalLoadError" @retry="retryArchivedLoad" />
    </template>

    <template v-else>
    <header class="page-header">
      <div class="header-top">
        <NuxtLink :to="`/org/${slug}/projects/${projectId}`" class="back-link">
          ← ボードに戻る
        </NuxtLink>
        <button class="ghost-btn" type="button" :disabled="loading" @click="reloadArchived">
          {{ loading ? '更新中...' : '再読み込み' }}
        </button>
      </div>
      <h1>アーカイブ済みカード</h1>
      <p v-if="workUnitLabel" class="subtitle">
        {{ workUnitLabel }} #{{ projectId }} — アーカイブしたカードだけが表示されます。完全削除はこの画面からのみ行えます。
      </p>
    </header>

    <div v-if="!pageReady" class="page-await-spacer" aria-busy="true" />

    <Transition v-else name="tm-fade" appear>
      <div key="archived-body" class="page-shell-fade">
    <p v-if="error" class="err">{{ error }}</p>

    <Transition name="tm-fade" mode="out-in">
      <section v-if="!tasks?.length" key="empty" class="empty-state">
        <p>アーカイブ済みのカードはありません。</p>
      </section>

      <ul v-else key="list" class="archived-list">
      <li v-for="task in tasks" :key="task.id" class="archived-row">
        <div class="archived-main">
          <p class="task-title">{{ task.title }}</p>
          <p class="task-meta">
            #{{ task.id }} / {{ task.status }}
            <span v-if="task.archived_at"> · アーカイブ: {{ formatDate(task.archived_at) }}</span>
          </p>
        </div>
        <div class="archived-actions">
          <button
            type="button"
            class="ghost-btn small"
            :disabled="pendingId === task.id"
            @click="openRestoreConfirm(task)"
          >
            {{ pendingId === task.id ? '処理中...' : 'ボードに戻す' }}
          </button>
          <button
            type="button"
            class="danger-btn small"
            :disabled="pendingId === task.id"
            @click="openDeleteConfirm(task)"
          >
            完全削除
          </button>
        </div>
      </li>
    </ul>
    </Transition>

      </div>
    </Transition>

    <ConfirmModal
      v-if="pageReady"
      v-model="restoreConfirmOpen"
      title="タスクカードの復元確認"
      confirm-text="復元"
      :loading="pendingId !== null"
      @confirm="confirmRestoreTask"
    />

    <ConfirmModal
      v-if="pageReady"
      v-model="deleteConfirmOpen"
      title="タスクカードの完全削除"
      message="完全削除は取り消せません。"
      confirm-text="完全削除"
      variant="danger"
      :loading="pendingId !== null"
      @confirm="confirmPermanentDelete"
    />
    </template>
  </main>
</template>

<script setup lang="ts">
import { raceWithTimeout, timeoutMessage, TM_PAGE_LOAD_TIMEOUT_MS } from '../../../../../composables/raceWithTimeout'
import { useApi } from '../../../../../composables/useApi'
import { useOrgTerminology, useWorkUnitLabel } from '../../../../../composables/useOrgTerminology'

definePageMeta({ name: 'org-slug-projects-id-archived' })

const route = useRoute()
const slug = computed(() => route.params.slug as string)
const projectId = computed(() => route.params.id as string)
const { api } = useApi()
const { fetchWorkUnitLabel, syncLabelState } = useOrgTerminology()
const { workUnitLabel } = useWorkUnitLabel(() => slug.value)

type Task = {
  id: number
  title: string
  status: string
  list_id: number | null
  archived_at?: string | null
}

const tasks = ref<Task[] | null>(null)
const error = ref<string | null>(null)
const loading = ref(false)
const pageReady = ref(false)
const fatalLoadError = ref<string | null>(null)
const pendingId = ref<number | null>(null)
const deleteConfirmTask = ref<Task | null>(null)
const restoreConfirmTask = ref<Task | null>(null)
const restoreConfirmOpen = computed({
  get: () => restoreConfirmTask.value !== null,
  set: (open: boolean) => {
    if (!open) restoreConfirmTask.value = null
  },
})
const deleteConfirmOpen = computed({
  get: () => deleteConfirmTask.value !== null,
  set: (open: boolean) => {
    if (!open) deleteConfirmTask.value = null
  },
})

function formatDate (iso: string) {
  try {
    return new Date(iso).toLocaleString('ja-JP')
  } catch {
    return iso
  }
}

async function fetchArchived () {
  const [res, label] = await Promise.all([
    api<{ data: Task[] }>(
      `/orgs/${slug.value}/projects/${projectId.value}/tasks/archived`,
    ),
    fetchWorkUnitLabel(slug.value),
  ])
  return { res, label }
}

async function load (opts?: { refresh?: boolean }) {
  const refresh = opts?.refresh ?? false
  error.value = null
  if (!refresh) {
    fatalLoadError.value = null
  }
  loading.value = true

  try {
    if (!pageReady.value && !refresh) {
      const r = await raceWithTimeout(() => fetchArchived(), TM_PAGE_LOAD_TIMEOUT_MS)
      if (!r.ok) {
        fatalLoadError.value = r.reason === 'timeout' ? timeoutMessage() : r.message
        return
      }
      tasks.value = r.value.res.data
      syncLabelState(slug.value, r.value.label)
      pageReady.value = true
    } else {
      const data = await fetchArchived()
      tasks.value = data.res.data
      syncLabelState(slug.value, data.label)
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
    loading.value = false
  }
}

function reloadArchived () {
  void load({ refresh: true })
}

function retryArchivedLoad () {
  fatalLoadError.value = null
  void load()
}

async function restoreTask (task: Task) {
  pendingId.value = task.id
  error.value = null
  try {
    await api(
      `/orgs/${slug.value}/projects/${projectId.value}/tasks/${task.id}/unarchive`,
      { method: 'POST' },
    )
    tasks.value = (tasks.value ?? []).filter(t => t.id !== task.id)
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : '復元に失敗しました'
  } finally {
    pendingId.value = null
  }
}

function openRestoreConfirm (task: Task) {
  restoreConfirmTask.value = task
}

async function confirmRestoreTask () {
  const task = restoreConfirmTask.value
  if (!task) return
  restoreConfirmTask.value = null
  await restoreTask(task)
}

function openDeleteConfirm (task: Task) {
  deleteConfirmTask.value = task
}

async function confirmPermanentDelete () {
  const task = deleteConfirmTask.value
  if (!task) return
  pendingId.value = task.id
  error.value = null
  try {
    await api(
      `/orgs/${slug.value}/projects/${projectId.value}/tasks/${task.id}`,
      { method: 'DELETE' },
    )
    deleteConfirmTask.value = null
    tasks.value = (tasks.value ?? []).filter(t => t.id !== task.id)
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : '削除に失敗しました'
  } finally {
    pendingId.value = null
  }
}

function ensureArchivedTasks () {
  if (!tasks.value) {
    tasks.value = []
  }
}

function addArchivedTaskFromRealtime (task: {
  id: number
  title: string
  status: string
  list_id: number | null
  archived_at?: string | null
}) {
  ensureArchivedTasks()
  if (tasks.value!.some(t => t.id === task.id)) {
    return
  }
  tasks.value!.push({
    id: task.id,
    title: task.title,
    status: task.status,
    list_id: task.list_id,
    archived_at: task.archived_at ?? null,
  })
}

function removeArchivedTaskFromRealtime (taskId: number) {
  if (!tasks.value) {
    return
  }
  tasks.value = tasks.value.filter(t => t.id !== taskId)
}

useProjectRealtimeChannel(projectId, {
  onTaskArchived ({ task }) {
    if (task) {
      addArchivedTaskFromRealtime(task)
    }
  },
  onTaskRestored (task) {
    removeArchivedTaskFromRealtime(task.id)
  },
  onTaskDeleted (taskId) {
    removeArchivedTaskFromRealtime(taskId)
  },
})

onMounted(() => {
  void load()
})
</script>

<style scoped>
.archived-page {
  min-height: 100vh;
  padding: 1.5rem 1rem 2rem;
  font-family: system-ui, sans-serif;
}

.page-header {
  max-width: 42rem;
  margin: 0 auto 1.25rem;
}

.header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

h1 {
  margin: 0.75rem 0 0.25rem;
  font-size: 1.6rem;
}

.subtitle {
  margin: 0;
  color: #475569;
  font-size: 0.95rem;
  line-height: 1.5;
}

.back-link {
  color: #0f172a;
  text-decoration: none;
  font-weight: 600;
}

.back-link:hover {
  text-decoration: underline;
}

.empty-state {
  max-width: 42rem;
  margin: 0 auto;
  color: #64748b;
}

.archived-list {
  max-width: 42rem;
  margin: 0 auto;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.archived-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.85rem 1rem;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  box-shadow: 0 1px 0 rgba(15, 23, 42, 0.06);
}

.archived-main {
  flex: 1;
  min-width: 12rem;
}

.task-title {
  margin: 0;
  font-weight: 700;
  font-size: 1rem;
}

.task-meta {
  margin: 0.35rem 0 0;
  color: #64748b;
  font-size: 0.8rem;
}

.archived-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  align-items: center;
}

.ghost-btn {
  background: transparent;
  color: #0f172a;
  border: 1px solid #94a3b8;
  font-weight: 600;
  border-radius: 10px;
  padding: 0.55rem 0.75rem;
  cursor: pointer;
  font-size: 0.88rem;
}

.ghost-btn.small {
  padding: 0.4rem 0.6rem;
  font-size: 0.82rem;
  border-radius: 8px;
}

.danger-btn {
  border: none;
  border-radius: 10px;
  padding: 0.55rem 0.75rem;
  background: #ff0000;
  color: #fff;
  font-weight: 700;
  cursor: pointer;
  font-size: 0.88rem;
}

.danger-btn.small {
  padding: 0.4rem 0.6rem;
  font-size: 0.82rem;
  border-radius: 8px;
}

button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.err {
  max-width: 42rem;
  margin: 0 auto 0.8rem;
  color: #b91c1c;
  font-weight: 700;
}

</style>
