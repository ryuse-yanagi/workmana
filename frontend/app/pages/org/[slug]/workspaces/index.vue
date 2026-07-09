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
              <p class="subheader-title">Workspaces</p>
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
                  :placeholder="'スペース名で検索'"
                  aria-label="検索"
                />
              </div>
              <button
                class="primary-btn"
                type="button"
                :disabled="pending"
                @click="openWorkspaceCreateModal"
              >
                <FolderPlus :size="20" :stroke-width="2.25" aria-hidden="true" />
                スペース作成
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
                    <th>担当者</th>
                    <th>説明</th>
                    <th>ステータス</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="!visibleWorkspaces.length">
                    <td colspan="4" class="empty">該当するスペースがありません。</td>
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
                    @pointerdown="onWorkspacePointerDown($event, workspace.id)"
                    @pointermove="onWorkspacePointerMove($event, workspace.id)"
                    @pointerup="onWorkspacePointerUp($event, workspace.id)"
                    @pointercancel="onWorkspacePointerCancel"
                    @keydown.enter.prevent="goToWorkspace(workspace.id)"
                    @keydown.space.prevent="goToWorkspace(workspace.id)"
                  >
                    <td colspan="4" class="workspace-card-cell">
                      <div class="workspace-card">
                        <div
                          v-if="workspace.labels?.length"
                          class="workspace-card__labels"
                        >
                          <OverflowFlexRow :watch-key="workspace.labels.length">
                            <LabelStrip
                              v-for="label in workspace.labels"
                              :key="label.id"
                              :label="label"
                              size="md"
                            />
                          </OverflowFlexRow>
                        </div>
                        <div class="workspace-card__body">
                          <div class="workspace-card__name">
                            <p class="name-text">{{ workspace.name }}</p>
                          </div>
                          <div class="workspace-card__assignees">
                            <WorkspaceAssigneeCountButton
                              v-if="workspace.assignees?.length"
                              :assignees="workspace.assignees"
                            />
                          </div>
                          <div class="workspace-card__description">
                            <p v-if="workspace.description" class="description-text">
                              {{ workspace.description }}
                            </p>
                          </div>
                          <div class="workspace-card__status">
                            <WorkspaceStatusSelect
                              :status="workspace.status"
                              :statuses="workspaceStatuses"
                              :pending="updatingStatusWorkspaceId === workspace.id"
                              @select="status => updateWorkspaceStatus(workspace, status)"
                            />
                          </div>
                        </div>
                      </div>
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
        title="スペースの作成"
        :org-slug="slug"
        :labels="orgLabels"
        :org-members="orgMembers"
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
import {
  useOrgWorkspaceIndexPageData,
  type OrgWorkspaceIndexPageSnapshot,
  type OrgWorkspaceStatus,
} from '../../../../composables/useOrgWorkspaceIndexPageData'
import type { TaskFormMember } from '../../../../composables/useTaskFormHelpers'
import { useWorkspaceBoardPageData } from '../../../../composables/useWorkspaceBoardPageData'
import { DEFAULT_WORKSPACE_STATUS_ITEMS } from '../../../../components/settings/types'
import { resolveStandardColors } from '../../../../utils/colorPresetResolution'
import WorkspaceStatusSelect from '../../../../components/workspace/WorkspaceStatusSelect.vue'
definePageMeta({
  name: 'org-slug-workspaces',
  key: route => route.fullPath,
  keepalive: true,
})
type Label = { id: number; name: string; color: string }
type WorkspaceStatus = OrgWorkspaceStatus
type Workspace = {
  id: number
  name: string
  description?: string | null
  status?: WorkspaceStatus | null
  labels?: Label[]
  assignees?: TaskFormMember[]
}
const route = useRoute()
const slug = computed(() => route.params.slug as string)
const { api } = useApi()
const {
  fetchSnapshot: fetchOrgWorkspaceIndexSnapshot,
  getCached: getOrgWorkspaceIndexCached,
  invalidateCached: invalidateOrgWorkspaceIndexCached,
  patchCachedWorkspaceStatus,
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
const orgMembers = ref<TaskFormMember[]>([])
const workspaceStatuses = ref<WorkspaceStatus[]>([])
const labelFilterId = ref('')
const justCreatedWorkspaceIds = reactive<Record<number, true>>({})
const loadingWorkspaceId = ref<number | null>(null)
const updatingStatusWorkspaceId = ref<number | null>(null)
const CLICK_MOVE_TOLERANCE_PX = 6
const pointerPressState = ref<{
  workspaceId: number
  pointerId: number
  startX: number
  startY: number
  moved: boolean
} | null>(null)
const globalHeaderOffsetPx = ref(46)
const listPageCssVars = computed(() => {
  return {
    '--global-header-offset': `${globalHeaderOffsetPx.value}px`,
    // `app.vue` の `.app-shell__page { padding-top: 4px; }` を打ち消して、
    // 最上部スクロール時に共通ヘッダーと画面別ヘッダーの隙間をなくす
    '--app-shell-page-pad': '3.5px',
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
  orgMembers.value = snapshot.orgMembers ?? []
  workspaceStatuses.value = snapshot.workspaceStatuses ?? resolveStandardColors(DEFAULT_WORKSPACE_STATUS_ITEMS)
}
function applyWorkspaceStatusLocally (workspaceId: number, status: WorkspaceStatus | null) {
  workspaces.value = workspaces.value.map(workspace => (
    workspace.id === workspaceId
      ? { ...workspace, status }
      : workspace
  ))
  patchCachedWorkspaceStatus(slug.value, workspaceId, status)
}
async function updateWorkspaceStatus (workspace: Workspace, status: WorkspaceStatus) {
  if (workspace.status?.name === status.name || updatingStatusWorkspaceId.value !== null) {
    return
  }
  const previousStatus = workspace.status ?? null
  updatingStatusWorkspaceId.value = workspace.id
  error.value = null
  applyWorkspaceStatusLocally(workspace.id, status)
  try {
    const updated = await api<Workspace>(`/orgs/${slug.value}/workspaces/${workspace.id}`, {
      method: 'PATCH',
      body: { status: status.name },
    })
    const nextStatus = updated.status
      ? resolveStandardColors([updated.status])[0] ?? updated.status
      : status
    applyWorkspaceStatusLocally(workspace.id, nextStatus)
  } catch (e: unknown) {
    applyWorkspaceStatusLocally(workspace.id, previousStatus)
    error.value = e instanceof Error ? e.message : 'ステータスの更新に失敗しました'
  } finally {
    if (updatingStatusWorkspaceId.value === workspace.id) {
      updatingStatusWorkspaceId.value = null
    }
  }
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
async function createWorkspace (payload: {
  name: string
  description: string | null
  label_ids: number[]
  assignee_ids: number[]
}) {
  pending.value = true
  error.value = null
  try {
    await withAppLoadingCursor(async () => {
      const createdWorkspace = await api<Workspace>(`/orgs/${slug.value}/workspaces`, {
        method: 'POST',
        body: {
          name: payload.name,
          description: payload.description,
          label_ids: payload.label_ids,
          assignee_ids: payload.assignee_ids,
        },
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
function onWorkspacePointerDown (event: PointerEvent, workspaceId: number) {
  if (event.button !== 0 || loadingWorkspaceId.value !== null) {
    pointerPressState.value = null
    return
  }
  pointerPressState.value = {
    workspaceId,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    moved: false,
  }
}
function onWorkspacePointerMove (event: PointerEvent, workspaceId: number) {
  const state = pointerPressState.value
  if (!state || state.workspaceId !== workspaceId || state.pointerId !== event.pointerId) {
    return
  }
  if (state.moved) return
  const movedX = Math.abs(event.clientX - state.startX)
  const movedY = Math.abs(event.clientY - state.startY)
  if (movedX > CLICK_MOVE_TOLERANCE_PX || movedY > CLICK_MOVE_TOLERANCE_PX) {
    state.moved = true
  }
}
function onWorkspacePointerCancel () {
  pointerPressState.value = null
}
function onWorkspacePointerUp (event: PointerEvent, workspaceId: number) {
  const state = pointerPressState.value
  pointerPressState.value = null
  if (!state || state.workspaceId !== workspaceId || state.pointerId !== event.pointerId) {
    return
  }
  if (state.moved) {
    return
  }
  void goToWorkspace(workspaceId)
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
  min-height: calc(100dvh - var(--global-header-offset, 56px));
  padding: 0 14px 14px;
  margin-top: calc(-1 * var(--app-shell-page-pad, 3.5px));
  padding-top: 0;
  box-sizing: border-box;
}
.table-card,
.err {
  max-width: 1248px;
  margin-left: auto;
  margin-right: auto;
}
.page-header {
  position: sticky;
  top: var(--global-header-offset, 56px);
  z-index: 40;
  width: calc(100% + 28px);
  margin-left: -14px;
  margin-right: -14px;
  @include mixin.page-header-shell;
  padding: 0 14px;
}
.page-header > * {
  width: 100%;
  height: 100%;
}
.subheader {
  display: flex;
  align-items: center;
  gap: 7px;
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
  @include mixin.page-header-title;
  letter-spacing: 0.05em;
}
.subheader-filters {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
}
.header-search,
.header-sort {
  border: 1px solid mixin.$border;
  border-radius: 8px;
  padding: 0 8px;
  font-size: 11.48px;
  background: #fff;
  color: #0f172a;
  box-sizing: border-box;
  height: 32px;
  line-height: 32px;
}
.header-search {
  flex: 1;
  min-width: 84px;
  max-width: 252px;
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
  width: 94.5px;
  padding-right: 21px;
  cursor: pointer;
}
.subheader-count {
  margin: 0;
  font-size: 12px;
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
  margin-top: 8px;
}
.table-wrap {
  overflow-x: auto;
  background: transparent;
}
.workspace-table {
  --col-name-width: 480px;
  --col-assignees-width: 112px;
  --col-description-width: 528px;
  --col-status-width: 128px;
  width: 1248px;
  max-width: 1248px;
  table-layout: fixed;
  border-collapse: separate;
  border-spacing: 0 8px;
}
.workspace-table th,
.workspace-table td {
  text-align: left;
  padding: 0;
  color: #1e293b;
}
.workspace-table tbody tr {
  height: 80px;
}
.workspace-table th {
  height: 24px;
  box-sizing: border-box;
  background: none;
  color: #64748b;
  font-size: 14px;
  letter-spacing: 0.02em;
  vertical-align: middle;
  text-align: left;
  padding: 0 16px;
}
.workspace-table th:nth-child(1) {
  width: var(--col-name-width);
  max-width: var(--col-name-width);
}
.workspace-table th:nth-child(2) {
  width: var(--col-assignees-width);
  max-width: var(--col-assignees-width);
  text-align: center;
}
.workspace-table th:nth-child(3) {
  width: var(--col-description-width);
  max-width: var(--col-description-width);
}
.workspace-table th:nth-child(4) {
  width: var(--col-status-width);
  max-width: var(--col-status-width);
  text-align: center;
}
.workspace-card-cell {
  height: 80px;
  box-sizing: border-box;
  vertical-align: middle;
  padding: 0;
  background: transparent;
  border: none;
  box-shadow: none;
}
.workspace-card {
  position: relative;
  height: 80px;
  box-sizing: border-box;
  background: #fff;
  border: 1px solid #edf2f7;
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  overflow: hidden;
}
.workspace-card__labels {
  position: absolute;
  top: 6px;
  left: 0;
  right: 0;
  z-index: 1;
  padding: 0 16px;
  min-width: 0;
  pointer-events: none;
}
.workspace-card__body {
  height: 100%;
  display: flex;
  align-items: center;
  min-width: 1248px;
}
.workspace-card__name {
  width: var(--col-name-width);
  max-width: var(--col-name-width);
  box-sizing: border-box;
  padding: 0 16px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  min-width: 0;
  flex-shrink: 0;
  font-weight: 600;
  font-size: 14px;
}
.workspace-card__assignees {
  width: var(--col-assignees-width);
  max-width: var(--col-assignees-width);
  box-sizing: border-box;
  padding: 0 16px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  flex-shrink: 0;
}
.workspace-card__description {
  width: var(--col-description-width);
  max-width: var(--col-description-width);
  box-sizing: border-box;
  padding: 0 16px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  min-width: 0;
  flex-shrink: 0;
  font-size: 14px;
}
.workspace-card__status {
  width: var(--col-status-width);
  max-width: var(--col-status-width);
  box-sizing: border-box;
  padding: 0 16px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  min-width: 0;
  font-size: 14px;
  flex-shrink: 0;
}
.clickable-row {
  cursor: pointer;
}
.clickable-row:hover:not(.workspace-row--loading) {
  opacity: 0.8;
}
.workspace-row--loading,
.workspace-row--loading:hover {
  opacity: 0.6;
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
.name-text {
  margin: 0;
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.description-text {
  margin: 0;
  width: 100%;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.4;
  max-height: calc(1.4em * 2);
  color: #475569;
  word-break: break-word;
}
.empty {
  text-align: center;
  color: #64748b;
  padding: 14px;
}
.primary-btn,
.ghost-btn {
  border: 1px solid transparent;
  border-radius: 8px;
  padding: 4px 12px;
  font-size: 12px;
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
  padding: 6px 28px;
  font-size: 14px;
  white-space: nowrap;
  flex-shrink: 0;
  gap: 4.9px;
}
.ghost-btn {
  background: #fff;
  color: #334155;
  border-color: #94a3b8;
}
button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.err {
  margin-top: 0;
  margin-bottom: 12px;
  color: #b91c1c;
  font-weight: 700;
}
</style>
