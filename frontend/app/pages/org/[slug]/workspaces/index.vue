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
                新規作成
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
      <Teleport to="body">
        <ul
          v-if="openMenuWorkspace && workspaceMenuPosition"
          class="workspace-card-menu-dropdown"
          role="menu"
          :style="workspaceMenuStyle"
        >
          <li role="none">
            <button
              type="button"
              class="workspace-card-menu-item"
              role="menuitem"
              :disabled="pending"
              @click="openWorkspaceEditModal(openMenuWorkspace)"
            >
              編集
            </button>
          </li>
          <li role="none">
            <button
              type="button"
              class="workspace-card-menu-item workspace-card-menu-item--danger"
              role="menuitem"
              :disabled="pending"
              @click="openWorkspaceDeleteModal(openMenuWorkspace)"
            >
              削除
            </button>
          </li>
        </ul>
      </Teleport>
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
function onGlobalClick (ev: Event) {
  const t = ev.target
  if (t instanceof Node) {
    const el = t instanceof Element ? t : t.parentElement
    if (el?.closest('.workspace-card__menu-btn')) {
      return
    }
    if (el?.closest('.workspace-card-menu-dropdown')) {
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
  max-width: 1304px;
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
  --col-name-width: 536px;
  --col-assignees-width: 112px;
  --col-description-width: 476px;
  --col-status-width: 128px;
  --col-actions-width: 52px;
  width: 1304px;
  max-width: 1304px;
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
  padding: 0 16px 0 32px;
}
.workspace-table th:nth-child(2) {
  width: var(--col-description-width);
  max-width: var(--col-description-width);
}
.workspace-table th:nth-child(3) {
  width: var(--col-assignees-width);
  max-width: var(--col-assignees-width);
  text-align: center;
}
.workspace-table th:nth-child(4) {
  width: var(--col-status-width);
  max-width: var(--col-status-width);
  text-align: center;
}
.workspace-table th:nth-child(5) {
  width: var(--col-actions-width);
  max-width: var(--col-actions-width);
  padding: 0 16px 0 0;
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
  z-index: 1;
  box-sizing: border-box;
  width: var(--col-name-width);
  max-width: var(--col-name-width);
  padding: 0 16px 0 32px;
  min-width: 0;
  pointer-events: none;
}
.workspace-card__body {
  height: 100%;
  display: flex;
  align-items: center;
  min-width: 1304px;
}
.workspace-card__name {
  width: var(--col-name-width);
  max-width: var(--col-name-width);
  box-sizing: border-box;
  padding: 0 16px 0 32px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  min-width: 0;
  flex-shrink: 0;
  font-weight: 600;
  font-size: 16px;
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
.workspace-card__actions {
  width: var(--col-actions-width);
  max-width: var(--col-actions-width);
  box-sizing: border-box;
  padding: 0 16px 0 0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.workspace-card__menu-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: 36px;
  height: 36px;
  padding: 0;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: #64748b;
  cursor: pointer;
}
.workspace-card__menu-btn:focus-visible {
  outline: 2px solid #2563eb;
  outline-offset: 2px;
}
.workspace-card-menu-dropdown {
  margin: 0;
  padding: 4.9px 0;
  list-style: none;
  background: #fff;
  border: 1px solid mixin.$border;
  border-radius: 10px;
  box-shadow: 0 10px 28px rgba(15, 23, 42, 0.14);
}
.workspace-card-menu-item {
  display: block;
  width: 100%;
  border: none;
  background: transparent;
  padding: 7.7px 11.9px;
  text-align: left;
  font-size: 14px;
  font-weight: 600;
  color: mixin.$text;
  cursor: pointer;
  &:disabled {
    opacity: 0.55;
    cursor: default;
  }
}
.workspace-card-menu-item--danger {
  color: mixin.$danger;
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
  background: mixin.$main;
  color: mixin.$white;
  border-radius: 999px;
  padding: 6px 28px;
  font-size: 14px;
  font-weight: bold;
  white-space: nowrap;
  flex-shrink: 0;
  gap: 6px;
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
  color: mixin.$danger;
  font-weight: 700;
}
</style>
