<template>
  <main
    class="list-page"
    :style="listPageCssVars"
  >
    <template v-if="fatalLoadError">
      <PageLoadFatal :message="fatalLoadError" @retry="retryInitialLoad" />
    </template>
    <template v-else-if="pageReady">
      <header class="page-header">
            <div class="subheader">
              <p class="subheader-title">ワークスペース一覧</p>
              <div class="subheader-filters">
                <select v-model="labelFilterId" class="header-sort" aria-label="ラベル絞り込み">
                  <option value="">全ラベル</option>
                  <option v-for="label in orgLabels" :key="label.id" :value="String(label.id)">
                    {{ label.name }}
                  </option>
                </select>
                <select v-model="sortMode" class="header-sort" aria-label="並び順">
                  <option value="newest">ID降順</option>
                  <option value="oldest">ID昇順</option>
                  <option value="name">名前順</option>
                </select>
                <p class="subheader-count" aria-live="polite">{{ visibleWorkspaces.length }} 件</p>
                <input
                  v-model.trim="searchQuery"
                  class="header-search"
                  type="search"
                  :placeholder="'ワークスペース名で検索'"
                  aria-label="検索"
                />
              </div>
              <button
                class="primary-btn"
                type="button"
                :disabled="pending"
                @click="openWorkspaceCreateModal"
              >
                <FolderPlus :size="18" :stroke-width="2.25" aria-hidden="true" />
                新規追加
              </button>
            </div>
      </header>
      <div class="page-shell-fade">
          <!-- エラー表示 -->
          <p v-if="error" class="err">{{ error }}</p>
          <section class="table-card">
            <div class="table-wrap">
              <table class="workspace-table">
                <thead>
                  <tr>
                    <th>名前</th>
                    <th>ID</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="!visibleWorkspaces.length">
                    <td colspan="3" class="empty">該当するワークスペースがありません。</td>
                  </tr>
                  <tr
                    v-for="workspace in visibleWorkspaces"
                    :key="workspace.id"
                    :class="[
                      'clickable-row',
                      {
                        'workspace-row--fade-in': isWorkspaceJustCreated(workspace.id),
                        'workspace-row--loading': loadingWorkspaceId === workspace.id,
                      },
                    ]"
                    role="button"
                    tabindex="0"
                    :aria-busy="loadingWorkspaceId === workspace.id"
                    @pointerenter="warmWorkspaceBoard(workspace.id)"
                    @focusin="warmWorkspaceBoard(workspace.id)"
                    @click="goToWorkspace(workspace.id)"
                    @keydown.enter.prevent="goToWorkspace(workspace.id)"
                    @keydown.space.prevent="goToWorkspace(workspace.id)"
                  >
                    <td class="name-cell">
                      <p class="name-text">{{ workspace.name }}</p>
                      <div v-if="workspace.labels?.length" class="label-list">
                        <LabelStrip
                          v-for="label in workspace.labels"
                          :key="label.id"
                          :label="label"
                          size="md"
                        />
                      </div>
                    </td>
                    <td>#{{ workspace.id }}</td>
                    <td>
                      <span class="mini-btn">詳細</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
      </div>
      <!-- 作成モーダル（オーバーレイのためフェード対象外） -->
      <WorkspaceCreateModal
        v-model="workspaceCreateModalOpen"
        title="ワークスペースの作成"
        
        :labels="orgLabels"
        :loading="pending"
        @submit="createWorkspace"
      />
    </template>
  </main>
</template>
<script setup lang="ts">
import { FolderPlus } from 'lucide-vue-next'
import { raceWithTimeout, timeoutMessage, TM_PAGE_LOAD_TIMEOUT_MS } from '../../../../composables/raceWithTimeout'
import { withAppLoadingCursor } from '../../../../composables/useAppLoadingCursor'
import { useApi } from '../../../../composables/useApi'
import { useOrgWorkspaceIndexPageData, type OrgWorkspaceIndexPageSnapshot } from '../../../../composables/useOrgWorkspaceIndexPageData'
import { useWorkspaceBoardPageData } from '../../../../composables/useWorkspaceBoardPageData'
definePageMeta({
  name: 'org-slug-workspaces',
  key: route => route.fullPath,
  keepalive: true,
})
type Label = { id: number; name: string; color: string }
type Workspace = { id: number; name: string; labels?: Label[] }
const route = useRoute()
const slug = computed(() => route.params.slug as string)
const { api } = useApi()
const {
  fetchSnapshot: fetchOrgWorkspaceIndexSnapshot,
  getCached: getOrgWorkspaceIndexCached,
  invalidateCached: invalidateOrgWorkspaceIndexCached,
} = useOrgWorkspaceIndexPageData()
const { warmWorkspaceBoardCache, prefetch } = useWorkspaceBoardPageData()
const workspaces = ref<Workspace[]>([])
/** 初回取得成功まで UI を出さない */
const pageReady = ref(false)
/** 初回のみ：タイムアウト／API 失敗時にブロッキング表示 */
const fatalLoadError = ref<string | null>(null)
const pending = ref(false)
const error = ref<string | null>(null)
const searchQuery = ref('')
const sortMode = ref<'newest' | 'oldest' | 'name'>('newest')
const workspaceCreateModalOpen = ref(false)
const orgLabels = ref<Label[]>([])
const labelFilterId = ref('')
const justCreatedWorkspaceIds = reactive<Record<number, true>>({})
const loadingWorkspaceId = ref<number | null>(null)
const globalHeaderOffsetPx = ref(46)
const listPageCssVars = computed(() => {
  return {
    '--global-header-offset': `${globalHeaderOffsetPx.value}px`,
    // `app.vue` の `.app-shell__page { padding-top: 0.25rem; }` を打ち消して、
    // 最上部スクロール時に共通ヘッダーと画面別ヘッダーの隙間をなくす
    '--app-shell-page-pad': '0.25rem',
  } as Record<string, string>
})
const visibleWorkspaces = computed(() => {
  const query = searchQuery.value.toLowerCase()
  const filtered = query
    ? workspaces.value.filter(workspace => workspace.name.toLowerCase().includes(query))
    : [...workspaces.value]
  const labelFiltered = labelFilterId.value
    ? filtered.filter(workspace => (workspace.labels ?? []).some(l => String(l.id) === labelFilterId.value))
    : filtered
  if (sortMode.value === 'name') {
    return labelFiltered.sort((a, b) => a.name.localeCompare(b.name, 'ja'))
  }
  if (sortMode.value === 'oldest') {
    return labelFiltered.sort((a, b) => a.id - b.id)
  }
  return labelFiltered.sort((a, b) => b.id - a.id)
})
function isWorkspaceJustCreated (workspaceId: number): boolean {
  return !!justCreatedWorkspaceIds[workspaceId]
}
function markWorkspaceAsJustCreated (workspaceId: number) {
  justCreatedWorkspaceIds[workspaceId] = true
  setTimeout(() => {
    delete justCreatedWorkspaceIds[workspaceId]
  }, 260)
}
function openWorkspaceCreateModal () {
  workspaceCreateModalOpen.value = true
}
function applyOrgWorkspaceIndexSnapshot (snapshot: OrgWorkspaceIndexPageSnapshot) {
  workspaces.value = snapshot.workspaces
  orgLabels.value = snapshot.orgLabels
}
async function load (opts?: { refresh?: boolean }) {
  const refresh = opts?.refresh ?? false
  error.value = null
  if (!refresh) {
    fatalLoadError.value = null
  }
  try {
    if (!pageReady.value && !refresh) {
      const cached = getOrgWorkspaceIndexCached(slug.value)
      if (cached) {
        applyOrgWorkspaceIndexSnapshot(cached)
        pageReady.value = true
        return
      }
      await withAppLoadingCursor(async () => {
        const r = await raceWithTimeout(
          () => fetchOrgWorkspaceIndexSnapshot(slug.value),
          TM_PAGE_LOAD_TIMEOUT_MS,
        )
        if (!r.ok) {
          fatalLoadError.value = r.reason === 'timeout' ? timeoutMessage() : r.message
          return
        }
        applyOrgWorkspaceIndexSnapshot(r.value)
        pageReady.value = true
      })
    } else {
      await withAppLoadingCursor(async () => {
        const snapshot = await fetchOrgWorkspaceIndexSnapshot(slug.value)
        applyOrgWorkspaceIndexSnapshot(snapshot)
        pageReady.value = true
      })
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
    }
  }
}
function retryInitialLoad () {
  fatalLoadError.value = null
  invalidateOrgWorkspaceIndexCached(slug.value)
  pageReady.value = false
  void load()
}
async function createWorkspace (payload: { name: string; label_ids: number[] }) {
  pending.value = true
  error.value = null
  try {
    await withAppLoadingCursor(async () => {
      const createdWorkspace = await api<Workspace>(`/orgs/${slug.value}/workspaces`, {
        method: 'POST',
        body: { name: payload.name, label_ids: payload.label_ids },
      })
      workspaceCreateModalOpen.value = false
      await load({ refresh: true })
      markWorkspaceAsJustCreated(createdWorkspace.id)
    })
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : '作成に失敗しました'
  } finally {
    pending.value = false
  }
}
function warmWorkspaceBoard (workspaceId: number) {
  void warmWorkspaceBoardCache(slug.value, String(workspaceId))
}
async function goToWorkspace (workspaceId: number) {
  if (loadingWorkspaceId.value !== null) {
    return
  }
  loadingWorkspaceId.value = workspaceId
  try {
    await prefetch(slug.value, String(workspaceId))
    await navigateTo(`/org/${slug.value}/workspaces/${workspaceId}`)
  } finally {
    if (loadingWorkspaceId.value === workspaceId) {
      loadingWorkspaceId.value = null
    }
  }
}
function warmVisibleWorkspaceBoards () {
  if (!pageReady.value) {
    return
  }
  for (const workspace of visibleWorkspaces.value) {
    void warmWorkspaceBoardCache(slug.value, String(workspace.id))
  }
}
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
watch(
  () => [pageReady.value, visibleWorkspaces.value] as const,
  () => {
    warmVisibleWorkspaceBoards()
  },
  { immediate: true },
)
onBeforeMount(() => {
  const cached = getOrgWorkspaceIndexCached(slug.value)
  if (cached) {
    applyOrgWorkspaceIndexSnapshot(cached)
    pageReady.value = true
  }
})
onActivated(() => {
  const cached = getOrgWorkspaceIndexCached(slug.value)
  if (cached) {
    applyOrgWorkspaceIndexSnapshot(cached)
    pageReady.value = true
  }
})
onMounted(() => {
  if (!pageReady.value) {
    void load()
  }
  if (!import.meta.client) {
    return
  }
  nextTick(() => {
    updateStickyOffsets()
    const globalHeader = document.querySelector('.global-header') as HTMLElement | null
    if (globalHeader && 'ResizeObserver' in window) {
      globalHeaderObserver = new ResizeObserver(() => {
        updateStickyOffsets()
      })
      globalHeaderObserver.observe(globalHeader)
    }
    window.addEventListener('resize', updateStickyOffsets)
  })
})
onBeforeUnmount(() => {
  if (!import.meta.client) {
    return
  }
  window.removeEventListener('resize', updateStickyOffsets)
  globalHeaderObserver?.disconnect()
  globalHeaderObserver = null
})
</script>
<style lang="scss" scoped>
.list-page {
  min-height: calc(100dvh - var(--global-header-offset, 46px));
  padding: 0 1rem 1rem;
  margin-top: calc(-1 * var(--app-shell-page-pad, 0.25rem));
  padding-top: 0;
  font-family: system-ui, sans-serif;
  box-sizing: border-box;
}
.table-card,
.err {
  max-width: 72rem;
  margin-left: auto;
  margin-right: auto;
}
.page-header {
  position: sticky;
  top: var(--global-header-offset, 46px);
  z-index: 40;
  margin-bottom: 1rem;
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
  letter-spacing: 0.05em;
  flex-shrink: 0;
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
  border: 1px solid mixin.$border;
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
.header-search:focus,
.header-sort:focus {
  @include mixin.input-focus-ring;
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
.table-card {
  background: transparent;
  border: none;
  border-radius: 10px;
  overflow: visible;
}
.table-wrap {
  overflow-x: auto;
  background: transparent;
}
.workspace-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0 10px;
  min-width: 28rem;
}
.workspace-table th,
.workspace-table td {
  text-align: left;
  padding: 0.72rem 0.95rem;
  font-size: 0.92rem;
  color: #1e293b;
}
.workspace-table th {
  background: #f8fafd;
  color: #64748b;
  font-size: 0.8rem;
  letter-spacing: 0.02em;
}
.workspace-table tbody tr:hover {
  background: #f8fbff;
}
.workspace-table tbody tr:hover td {
  background: #f9fcff;
}
.workspace-table tbody td {
  background: #fff;
  border-top: 1px solid #edf2f7;
  border-bottom: 1px solid #edf2f7;
}
.workspace-table tbody td:first-child {
  border-left: 1px solid #edf2f7;
  border-radius: 8px 0 0 8px;
}
.workspace-table tbody td:last-child {
  border-right: 1px solid #edf2f7;
  border-radius: 0 8px 8px 0;
}
.clickable-row {
  cursor: pointer;
  transition: opacity 0.35s ease;
}
.clickable-row:hover:not(.workspace-row--loading) {
  opacity: 0.8;
}
.workspace-row--loading,
.workspace-row--loading:hover {
  opacity: 0.4;
  cursor: wait;
}
.workspace-row--fade-in {
  animation: projectRowFadeIn 220ms ease-out;
}
@keyframes projectRowFadeIn {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.clickable-row:focus-visible {
  outline: 2px solid #2563eb;
  outline-offset: -2px;
}
.name-cell {
  font-weight: 600;
}
.name-text {
  margin: 0;
}
.label-picker {
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
  background: #fff;
}
.label-empty {
  margin: 0.1rem 0 0;
  color: #64748b;
  font-size: 0.82rem;
}
.label-list {
  margin-top: 0.35rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}
.label-strip {
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
.empty {
  text-align: center;
  color: #64748b;
  padding: 1rem 0.95rem;
}
.primary-btn,
.ghost-btn,
.mini-btn {
  border: 1px solid transparent;
  border-radius: 8px;
  padding: 0.3rem 0.9rem;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  letter-spacing: 0.1em;
}
.primary-btn {
  background: mixin.$main-aqua;
  color: mixin.$white;
  border-radius: 999px;
  padding: 0.4rem 2rem;
  white-space: nowrap;
  flex-shrink: 0;
  gap: 0.35rem;
}
.ghost-btn {
  background: #fff;
  color: #334155;
  border-color: #94a3b8;
}
.mini-btn {
  background: #f1f5f9;
  color: #0f172a;
}
button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.err {
  margin-top: 0;
  margin-bottom: 0.9rem;
  color: #b91c1c;
  font-weight: 700;
}
</style>
