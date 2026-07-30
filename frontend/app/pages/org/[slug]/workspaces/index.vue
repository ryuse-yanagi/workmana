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
                    <th>スペース名</th>
                    <th>説明</th>
                    <th>担当者</th>
                    <th>ステータス</th>
                    <th aria-hidden="true"></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="!visibleWorkspaces.length">
                    <td colspan="5" class="empty">該当するスペースがありません。</td>
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
                    @contextmenu.prevent="onWorkspaceContextMenu(workspace.id, $event)"
                    @keydown.enter.prevent="goToWorkspace(workspace.id)"
                    @keydown.space.prevent="goToWorkspace(workspace.id)"
                  >
                    <td colspan="5" class="workspace-card-cell">
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
                          <div class="workspace-card__description">
                            <p v-if="workspace.description" class="description-text">
                              {{ workspace.description }}
                            </p>
                          </div>
                          <div class="workspace-card__assignees">
                            <WorkspaceAssigneeSelect
                              :assignees="workspace.assignees ?? []"
                              :org-members="orgMembers"
                              :pending="updatingAssigneesWorkspaceId === workspace.id"
                              @change="assigneeIds => updateWorkspaceAssignees(workspace, assigneeIds)"
                            />
                          </div>
                          <div class="workspace-card__status">
                            <WorkspaceStatusSelect
                              :status="workspace.status"
                              :statuses="workspaceStatuses"
                              :pending="updatingStatusWorkspaceId === workspace.id"
                              @select="status => updateWorkspaceStatus(workspace, status)"
                            />
                          </div>
                          <div class="workspace-card__actions">
                            <button
                              type="button"
                              class="workspace-card__menu-btn"
                              aria-label="スペースのメニュー"
                              :aria-expanded="openMenuWorkspaceId === workspace.id"
                              @pointerdown.stop
                              @pointerup.stop
                              @click.stop="toggleWorkspaceMenu(workspace.id, $event)"
                            >
                              <Ellipsis :size="20" :stroke-width="2.25" aria-hidden="true" />
                            </button>
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
      <FloatingMenu
        :open="Boolean(openMenuWorkspace && workspaceMenuPosition)"
        :style="workspaceMenuStyle"
        :disabled="pending"
        :items="workspaceMenuItems"
        @select="onWorkspaceMenuSelect"
      />
      <!-- 作成・編集モーダル（オーバーレイのためフェード対象外） -->
      <WorkspaceCreateModal
        v-model="workspaceFormModalOpen"
        :mode="workspaceFormMode"
        :title="workspaceFormMode === 'edit' ? 'スペースの編集' : 'スペースの作成'"
        :initial-values="workspaceFormInitialValues"
        :org-slug="slug"
        :labels="orgLabels"
        :org-members="orgMembers"
        :statuses="workspaceStatuses"
        :loading="pending"
        @submit="onWorkspaceFormSubmit"
      />
      <WorkspaceDeleteModal
        ref="workspaceDeleteModalRef"
        v-model="workspaceDeleteModalOpen"
        :workspace-name="workspaceDeleteTarget?.name ?? ''"
        :loading="deletePending"
        @confirm="confirmWorkspaceDelete"
      />
    </template>
  </main>
</template>
<script setup lang="ts">
import { Ellipsis, FolderPlus } from 'lucide-vue-next'
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
import { prefetchWorkspaceDetail, warmWorkspaceDetailCache } from '../../../../composables/useWorkspaceDetailMeta'
import { DEFAULT_WORKSPACE_STATUS_ITEMS } from '../../../../components/settings/types'
import { resolveStandardColors } from '../../../../utils/colorPresetResolution'
import {
  getTopmostModalOverlay,
  isKeyboardShortcutBlockedTarget,
} from '../../../../utils/uiInteraction'
import WorkspaceCreateModal from '../../../../components/modals/WorkspaceCreateModal.vue'
import WorkspaceDeleteModal from '../../../../components/modals/WorkspaceDeleteModal.vue'
import WorkspaceAssigneeSelect from '../../../../components/workspace/WorkspaceAssigneeSelect.vue'
import WorkspaceStatusSelect from '../../../../components/workspace/WorkspaceStatusSelect.vue'
import FloatingMenu, { type FloatingMenuItem } from '../../../../components/ui/FloatingMenu.vue'
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
  patchCachedWorkspaceAssignees,
} = useOrgWorkspaceIndexPageData()
const { warmWorkspaceBoardCache, prefetch, invalidateCached: invalidateWorkspaceBoardCached } = useWorkspaceBoardPageData()
const workspaces = ref<Workspace[]>([])
/** 初回取得成功まで UI を出さない */
const pageReady = ref(false)
/** 初回のみ：タイムアウト／API 失敗時にブロッキング表示 */
const fatalLoadError = ref<string | null>(null)
const pending = ref(false)
const error = ref<string | null>(null)
const searchQuery = ref('')
const sortMode = ref<'newest' | 'oldest' | 'name'>('newest')
const workspaceFormModalOpen = ref(false)
const workspaceFormMode = ref<'create' | 'edit'>('create')
const workspaceEditTarget = ref<Workspace | null>(null)
const workspaceDeleteModalOpen = ref(false)
const workspaceDeleteTarget = ref<Workspace | null>(null)
const workspaceDeleteModalRef = ref<{ setSubmitError: (message: string) => void } | null>(null)
const deletePending = ref(false)
const openMenuWorkspaceId = ref<number | null>(null)
const workspaceMenuPosition = ref<{ top: number; left: number } | null>(null)
const WORKSPACE_MENU_MIN_WIDTH = 160
const orgLabels = ref<Label[]>([])
const orgMembers = ref<TaskFormMember[]>([])
const workspaceStatuses = ref<WorkspaceStatus[]>([])
const labelFilterId = ref('')
const justCreatedWorkspaceIds = reactive<Record<number, true>>({})
const loadingWorkspaceId = ref<number | null>(null)
const updatingStatusWorkspaceId = ref<number | null>(null)
const updatingAssigneesWorkspaceId = ref<number | null>(null)
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
const openMenuWorkspace = computed(() => {
  const id = openMenuWorkspaceId.value
  if (id == null) return null
  return workspaces.value.find(workspace => workspace.id === id) ?? null
})
const workspaceMenuStyle = computed(() => {
  if (!workspaceMenuPosition.value) {
    return undefined
  }
  const { top, left } = workspaceMenuPosition.value
  return {
    position: 'fixed' as const,
    top: `${top}px`,
    left: `${left}px`,
    minWidth: `${WORKSPACE_MENU_MIN_WIDTH}px`,
    zIndex: 80,
  }
})
const workspaceFormInitialValues = computed(() => {
  if (workspaceFormMode.value !== 'edit' || !workspaceEditTarget.value) {
    return null
  }
  const target = workspaceEditTarget.value
  const status = target.status
    ? {
        name: target.status.name,
        color: target.status.color ?? '',
      }
    : null
  return {
    name: target.name,
    description: target.description ?? null,
    labels: target.labels ?? [],
    assignees: target.assignees ?? [],
    status,
  }
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
function closeWorkspaceMenu () {
  openMenuWorkspaceId.value = null
  workspaceMenuPosition.value = null
}
function positionWorkspaceMenu (anchor: HTMLElement) {
  if (!import.meta.client) {
    workspaceMenuPosition.value = null
    return
  }
  const rect = anchor.getBoundingClientRect()
  const pad = 8
  const gap = 4
  const menuWidth = WORKSPACE_MENU_MIN_WIDTH
  let left = rect.right + gap
  if (left + menuWidth > window.innerWidth - pad) {
    left = Math.max(pad, rect.left - gap - menuWidth)
  }
  workspaceMenuPosition.value = {
    top: rect.top,
    left,
  }
}
function openWorkspaceMenu (workspaceId: number, anchor: HTMLElement) {
  if (openMenuWorkspaceId.value === workspaceId) {
    closeWorkspaceMenu()
    return
  }
  positionWorkspaceMenu(anchor)
  openMenuWorkspaceId.value = workspaceId
}
function toggleWorkspaceMenu (workspaceId: number, event: MouseEvent) {
  const el = event.currentTarget
  if (!(el instanceof HTMLElement)) {
    return
  }
  openWorkspaceMenu(workspaceId, el)
}
function onWorkspaceContextMenu (workspaceId: number, event: MouseEvent) {
  pointerPressState.value = null
  const row = event.currentTarget
  if (!(row instanceof HTMLElement)) {
    return
  }
  const trigger = row.querySelector('.workspace-card__menu-btn')
  if (!(trigger instanceof HTMLElement)) {
    return
  }
  openWorkspaceMenu(workspaceId, trigger)
}
function openWorkspaceCreateModal () {
  closeWorkspaceMenu()
  workspaceFormMode.value = 'create'
  workspaceEditTarget.value = null
  workspaceFormModalOpen.value = true
}
function canUseWorkspaceListKeyboardShortcut (): boolean {
  if (!pageReady.value || fatalLoadError.value) {
    return false
  }
  if (getTopmostModalOverlay()) {
    return false
  }
  if (
    workspaceFormModalOpen.value
    || workspaceDeleteModalOpen.value
    || openMenuWorkspaceId.value !== null
    || pending.value
    || deletePending.value
  ) {
    return false
  }
  return true
}
function onWorkspaceListKeydown (event: KeyboardEvent) {
  const key = event.key
  if (key !== 'n' && key !== 'N') {
    return
  }
  if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) {
    return
  }
  if (isKeyboardShortcutBlockedTarget(event.target)) {
    return
  }
  if (!canUseWorkspaceListKeyboardShortcut()) {
    return
  }
  event.preventDefault()
  openWorkspaceCreateModal()
}
function openWorkspaceEditModal (workspace: Workspace) {
  closeWorkspaceMenu()
  workspaceFormMode.value = 'edit'
  workspaceEditTarget.value = workspace
  workspaceFormModalOpen.value = true
}
function openWorkspaceDeleteModal (workspace: Workspace) {
  closeWorkspaceMenu()
  workspaceDeleteTarget.value = workspace
  workspaceDeleteModalOpen.value = true
}
const workspaceMenuItems: FloatingMenuItem[] = [
  { key: 'edit', label: '編集' },
  { key: 'delete', label: '削除', danger: true },
]
function onWorkspaceMenuSelect (item: FloatingMenuItem) {
  const workspace = openMenuWorkspace.value
  if (!workspace) return
  if (item.key === 'edit') {
    openWorkspaceEditModal(workspace)
    return
  }
  if (item.key === 'delete') {
    openWorkspaceDeleteModal(workspace)
  }
}
function onGlobalClick (ev: Event) {
  const t = ev.target
  if (t instanceof Node) {
    const el = t instanceof Element ? t : t.parentElement
    if (el?.closest('.workspace-card__menu-btn')) {
      return
    }
    if (el?.closest('[data-floating-menu]')) {
      return
    }
  }
  closeWorkspaceMenu()
}
function onWindowResize () {
  closeWorkspaceMenu()
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
function applyWorkspaceAssigneesLocally (workspaceId: number, assignees: TaskFormMember[]) {
  workspaces.value = workspaces.value.map(workspace => (
    workspace.id === workspaceId
      ? { ...workspace, assignees }
      : workspace
  ))
  patchCachedWorkspaceAssignees(slug.value, workspaceId, assignees)
}
function resolveAssigneesFromIds (assigneeIds: number[]): TaskFormMember[] {
  const memberById = new Map(orgMembers.value.map(member => [member.id, member]))
  return assigneeIds
    .map(id => memberById.get(id))
    .filter((member): member is TaskFormMember => member != null)
}
async function updateWorkspaceAssignees (workspace: Workspace, assigneeIds: number[]) {
  const currentIds = (workspace.assignees ?? []).map(member => member.id)
  if (
    JSON.stringify(currentIds) === JSON.stringify(assigneeIds)
    || updatingAssigneesWorkspaceId.value !== null
  ) {
    return
  }
  const previousAssignees = workspace.assignees ?? []
  const nextAssignees = resolveAssigneesFromIds(assigneeIds)
  updatingAssigneesWorkspaceId.value = workspace.id
  error.value = null
  applyWorkspaceAssigneesLocally(workspace.id, nextAssignees)
  try {
    const updated = await api<Workspace>(`/orgs/${slug.value}/workspaces/${workspace.id}`, {
      method: 'PATCH',
      body: { assignee_ids: assigneeIds },
    })
    applyWorkspaceAssigneesLocally(workspace.id, updated.assignees ?? nextAssignees)
  } catch (e: unknown) {
    applyWorkspaceAssigneesLocally(workspace.id, previousAssignees)
    error.value = e instanceof Error ? e.message : '担当者の更新に失敗しました'
  } finally {
    if (updatingAssigneesWorkspaceId.value === workspace.id) {
      updatingAssigneesWorkspaceId.value = null
    }
  }
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
  status: string | null
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
          status: payload.status,
          label_ids: payload.label_ids,
          assignee_ids: payload.assignee_ids,
        },
      })
      workspaceFormModalOpen.value = false
      await load({ refresh: true })
      markWorkspaceAsJustCreated(createdWorkspace.id)
    })
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : '作成に失敗しました'
  } finally {
    pending.value = false
  }
}
async function updateWorkspace (payload: {
  name: string
  description: string | null
  status: string | null
  label_ids: number[]
  assignee_ids: number[]
}) {
  const target = workspaceEditTarget.value
  if (!target) return
  pending.value = true
  error.value = null
  try {
    await withAppLoadingCursor(async () => {
      await api<Workspace>(`/orgs/${slug.value}/workspaces/${target.id}`, {
        method: 'PATCH',
        body: {
          name: payload.name,
          description: payload.description,
          status: payload.status,
          label_ids: payload.label_ids,
          assignee_ids: payload.assignee_ids,
        },
      })
      workspaceFormModalOpen.value = false
      workspaceEditTarget.value = null
      invalidateOrgWorkspaceIndexCached(slug.value)
      invalidateWorkspaceBoardCached(slug.value, String(target.id))
      await load({ refresh: true })
    })
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : '更新に失敗しました'
  } finally {
    pending.value = false
  }
}
async function onWorkspaceFormSubmit (payload: {
  name: string
  description: string | null
  status: string | null
  label_ids: number[]
  assignee_ids: number[]
}) {
  if (workspaceFormMode.value === 'edit') {
    await updateWorkspace(payload)
    return
  }
  await createWorkspace(payload)
}
async function confirmWorkspaceDelete () {
  const target = workspaceDeleteTarget.value
  if (!target || deletePending.value) return
  deletePending.value = true
  error.value = null
  try {
    await withAppLoadingCursor(async () => {
      await api(`/orgs/${slug.value}/workspaces/${target.id}`, {
        method: 'DELETE',
      })
      workspaceDeleteModalOpen.value = false
      workspaceDeleteTarget.value = null
      workspaces.value = workspaces.value.filter(workspace => workspace.id !== target.id)
      invalidateOrgWorkspaceIndexCached(slug.value)
      invalidateWorkspaceBoardCached(slug.value, String(target.id))
      await load({ refresh: true })
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : '削除に失敗しました'
    workspaceDeleteModalRef.value?.setSubmitError(message)
    error.value = message
  } finally {
    deletePending.value = false
  }
}
function warmWorkspaceBoard (workspaceId: number) {
  void warmWorkspaceBoardCache(slug.value, String(workspaceId))
  warmWorkspaceDetailCache(slug.value, workspaceId)
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
    await Promise.all([
      prefetch(slug.value, String(workspaceId)),
      prefetchWorkspaceDetail(slug.value, workspaceId),
    ])
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
  if (import.meta.client) {
    document.addEventListener('keydown', onWorkspaceListKeydown)
  }
})
onDeactivated(() => {
  closeWorkspaceMenu()
  if (import.meta.client) {
    document.removeEventListener('keydown', onWorkspaceListKeydown)
  }
})
onMounted(() => {
  if (!pageReady.value) {
    void load()
  }
  if (!import.meta.client) {
    return
  }
  document.addEventListener('click', onGlobalClick)
  document.addEventListener('keydown', onWorkspaceListKeydown)
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
    window.addEventListener('resize', updateStickyOffsets)
  })
})
onBeforeUnmount(() => {
  if (!import.meta.client) {
    return
  }
  document.removeEventListener('click', onGlobalClick)
  document.removeEventListener('keydown', onWorkspaceListKeydown)
  window.removeEventListener('resize', onWindowResize)
  window.removeEventListener('resize', updateStickyOffsets)
  globalHeaderObserver?.disconnect()
  globalHeaderObserver = null
  closeWorkspaceMenu()
})
</script>
<style lang="scss" scoped src="~/assets/styles/pages/org/slug/workspaces/index.scss"></style>
