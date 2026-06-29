<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      ref="overlayRef"
      class="modal-overlay"
      :class="{ 'modal-overlay--popover-open': anyPopoverOpen }"
      role="presentation"
      @mousedown="onOverlayMouseDown"
    >
        <section
          class="modal-card"
          role="dialog"
          aria-modal="true"
          aria-label="タスク追加"
        >
          <header class="modal-header">
            <h3>タスク追加</h3>
            <button
              type="button"
              class="icon-close"
              :disabled="submitting"
              aria-label="閉じる"
              @click="close"
            >✕</button>
          </header>
          <div class="modal-body">
            <section class="parent-section">
              <div
                class="parent-toggle-card"
              >
                <div class="parent-toggle-card__head">
                  <div class="parent-toggle-card__label-wrap">
                    <ListTree
                      :size="18"
                      :stroke-width="2"
                      class="parent-toggle-card__icon"
                      aria-hidden="true"
                    />
                    <span class="parent-toggle-card__label">親タスクとして新規追加する</span>
                  </div>
                  <button
                    type="button"
                    class="toggle-switch"
                    role="switch"
                    :aria-checked="createAsParent"
                    :disabled="submitting"
                    @click="toggleCreateAsParent"
                  >
                    <span class="toggle-switch__track" aria-hidden="true">
                      <span class="toggle-switch__thumb" />
                    </span>
                  </button>
                </div>
                <p class="parent-toggle-card__hint">
                  OFFの場合、既存の親タスクに紐づく子タスクとして作成されます
                </p>
              </div>
              <div
                v-if="!createAsParent"
                ref="parentPickerRootRef"
                class="parent-picker-block"
              >
                <div class="parent-select-wrap">
                  <button
                    type="button"
                    class="action-btn"
                    :class="{ 'action-btn--active': parentPickerOpen }"
                    :disabled="submitting || parentTasksLoading || parentTaskDefaultsLoading"
                    :aria-expanded="parentPickerOpen"
                    aria-haspopup="dialog"
                    aria-label="親タスク"
                    @click.stop="toggleParentPicker($event)"
                  >
                    <span class="action-btn-icon" aria-hidden="true">
                      <ListTree :size="16" :stroke-width="2.25" />
                    </span>
                    親タスク
                  </button>
                </div>
                <div
                  v-if="parentTaskId !== null"
                  class="detail-meta-row"
                >
                  <section class="detail-item detail-item--parent">
                    <span class="detail-item-label">親タスク</span>
                    <button
                      type="button"
                      class="detail-value-btn"
                      :class="{ 'detail-value-btn--editing': parentPickerOpen }"
                      :disabled="submitting || parentTasksLoading || parentTaskDefaultsLoading"
                      @click.stop="toggleParentPicker($event)"
                    >
                      {{ selectedParentTaskTitle }}
                    </button>
                  </section>
                </div>
              </div>
            </section>
            <div class="task-form-section">
              <TaskFormPane
                ref="taskFormPaneRef"
                v-model="draft"
                :org-slug="orgSlug"
                :org-labels="orgLabels"
                :workspace-members="workspaceMembers"
                :disabled="submitting"
                relaxed-title-padding
                auto-focus-title
              />
            </div>
            <p v-if="submitError" class="err">{{ submitError }}</p>
            <footer class="modal-footer">
              <button
                type="button"
                class="ghost-btn"
                :disabled="submitting"
                @click="close"
              >
                キャンセル
              </button>
              <button
                type="button"
                class="primary-btn"
                :disabled="!canSubmit"
                @click="submit"
              >
                {{ submitting ? '追加中...' : '新規追加' }}
              </button>
            </footer>
          </div>
        </section>
    </div>
  </Teleport>
  <Teleport to="body">
    <Transition name="popover-fade" @after-enter="updateParentPickerPosition">
      <div
        v-if="modelValue && parentPickerOpen"
        class="popover-layer popover-layer--portal"
      >
        <PopoverShell
          ref="parentPickerPopoverRef"
          shell-class="popover popover--parent-task"
          :style="parentPickerStyle"
          title="親タスク"
          aria-label="親タスク"
          :close-disabled="submitting || parentTaskDefaultsLoading"
          @close="closeParentPicker"
        >
          <ParentTaskPickerPanel
            :loading="parentTasksLoading"
            :parents="parentTasks"
            :selected-parent-id="parentTaskId"
            :clear-disabled="submitting || parentTaskDefaultsLoading"
            :error="parentPickerError"
            @select="selectParentTask"
            @clear="clearParentTask"
          />
        </PopoverShell>
      </div>
    </Transition>
  </Teleport>
</template>
<script setup lang="ts">
import { ListTree } from 'lucide-vue-next'
import ParentTaskPickerPanel from '../task/ParentTaskPickerPanel.vue'
import TaskFormPane from '../task/TaskFormPane.vue'
import PopoverShell from '../ui/PopoverShell.vue'
import { useApi } from '../../composables/useApi'
import {
  applyTaskDefaultsToDraft,
  buildTaskCreateBody,
  clearTaskDraftDefaults,
  createEmptyTaskFormDraft,
  type TaskFormDraft,
  type TaskFormLabel,
  type TaskFormMember,
} from '../../composables/useTaskFormHelpers'
import type { TaskFormPopoverType } from '../../composables/useTaskFormPane'
import { useOrgEffortSettings } from '../../composables/useOrgEffortSettings'
import { createOverlayBackdropClose, dismissPopoverFromOutsidePointer, getTopmostModalOverlay, isCtrlEnterKeydown } from '../../utils/uiInteraction'
type ParentTaskOption = {
  id: number
  title: string
}
type ParentTaskDetail = {
  start_date: string | null
  due_date: string | null
  effort_hours: number | string | null
  effort_value: number | string | null
  effort_unit: string | null
  assignees: TaskFormMember[]
  labels: TaskFormLabel[]
}
export type CreatedTask = {
  id: number
  list_id: number | null
  sort_order?: number
  is_parent_task?: boolean
  parent_task_id?: number | null
  title: string
  description: string | null
  status: string
  priority?: string
  start_date?: string | null
  due_date?: string | null
  effort_hours?: number | string | null
  effort_value?: number | string | null
  effort_unit?: string | null
  assignee_id?: number | null
  assignees?: TaskFormMember[]
  labels?: TaskFormLabel[]
  created_at?: string
  updated_at?: string
}
type TaskFormPaneExpose = {
  resetPaneState: () => void
  focusTitleInput: () => void
  activePopover?: TaskFormPopoverType | null
  closePopover?: () => void | Promise<void>
}
const props = defineProps<{
  modelValue: boolean
  orgSlug: string
  workspaceId: string
  listId: number | null
  orgLabels: TaskFormLabel[]
  workspaceMembers: TaskFormMember[]
}>()
const emit = defineEmits<{
  'update:modelValue': [boolean]
  created: [CreatedTask]
}>()
const { api } = useApi()
const {
  ensureOrgEffortSettings,
  getOrgEffortUnit,
} = useOrgEffortSettings()
const draft = ref<TaskFormDraft>(createEmptyTaskFormDraft())
const createAsParent = ref(false)
const parentTaskId = ref<number | null>(null)
const parentTasks = ref<ParentTaskOption[]>([])
const parentTasksLoading = ref(false)
const parentTaskDefaultsLoading = ref(false)
const submitting = ref(false)
const submitError = ref<string | null>(null)
const parentPickerOpen = ref(false)
const parentPickerRootRef = ref<HTMLElement | null>(null)
const parentPickerAnchorEl = ref<HTMLElement | null>(null)
const parentPickerPopoverRef = ref<{ rootRef: HTMLElement | null } | null>(null)
const parentPickerStyle = ref<Record<string, string>>({})
const parentPickerError = ref<string | null>(null)
const taskFormPaneRef = ref<TaskFormPaneExpose | null>(null)
const overlayRef = ref<HTMLElement | null>(null)
let parentDefaultsRequestId = 0
let removeParentPickerResizeListener: (() => void) | null = null
const POPOVER_VIEWPORT_PAD = 12
const POPOVER_ANCHOR_GAP = 6
const POPOVER_MIN_HEIGHT = 120
const POPOVER_DEFAULT_WIDTH_PX = 312
const selectedParentTaskTitle = computed(() => {
  if (parentTaskId.value === null) return ''
  const parent = parentTasks.value.find(item => item.id === parentTaskId.value)
  return parent?.title ?? ''
})
const panePopoverOpen = computed(() => taskFormPaneRef.value?.activePopover != null)
const anyPopoverOpen = computed(() => panePopoverOpen.value || parentPickerOpen.value)
const canSubmit = computed(() =>
  draft.value.title.trim() !== ''
  && !submitting.value
  && props.listId !== null,
)
function toggleCreateAsParent () {
  if (submitting.value) return
  createAsParent.value = !createAsParent.value
}
function close () {
  if (submitting.value) return
  emit('update:modelValue', false)
}
function resolveParentPickerPopoverElement (): HTMLElement | null {
  return parentPickerPopoverRef.value?.rootRef ?? null
}
function captureParentPickerAnchor (event?: Event): HTMLElement | null {
  const fromEvent = event?.currentTarget
  if (fromEvent instanceof HTMLElement) return fromEvent
  return parentPickerRootRef.value?.querySelector('.action-btn') ?? null
}
function updateParentPickerPosition () {
  nextTick(() => {
    requestAnimationFrame(() => {
      positionParentPicker()
      if (!parentPickerPopoverRef.value) {
        requestAnimationFrame(() => positionParentPicker())
      }
    })
  })
}
function positionParentPicker () {
  const anchor = parentPickerAnchorEl.value
  const popover = resolveParentPickerPopoverElement()
  if (!anchor || !popover) return
  const pad = POPOVER_VIEWPORT_PAD
  const gap = POPOVER_ANCHOR_GAP
  const anchorRect = anchor.getBoundingClientRect()
  const measuredWidth = popover.offsetWidth || popover.getBoundingClientRect().width
  const popoverWidth = measuredWidth > 0 ? measuredWidth : POPOVER_DEFAULT_WIDTH_PX
  let left = anchorRect.left
  if (left + popoverWidth > window.innerWidth - pad) {
    left = anchorRect.right - popoverWidth
  }
  const spaceBelow = window.innerHeight - anchorRect.bottom - pad
  const spaceAbove = anchorRect.top - pad
  let top: number
  let maxHeight: number
  if (spaceBelow >= POPOVER_MIN_HEIGHT) {
    top = anchorRect.bottom + gap
    maxHeight = Math.max(POPOVER_MIN_HEIGHT, Math.floor(spaceBelow - gap))
  } else {
    maxHeight = Math.max(POPOVER_MIN_HEIGHT, Math.floor(spaceAbove - gap))
    top = Math.max(pad, anchorRect.top - gap - maxHeight)
  }
  parentPickerStyle.value = {
    position: 'fixed',
    top: `${Math.round(top)}px`,
    left: `${Math.round(left)}px`,
    maxHeight: `${maxHeight}px`,
    zIndex: '80',
  }
}
async function toggleParentPicker (event?: Event) {
  if (submitting.value || parentTasksLoading.value || parentTaskDefaultsLoading.value) return
  if (parentPickerOpen.value) {
    closeParentPicker()
    return
  }
  parentPickerAnchorEl.value = captureParentPickerAnchor(event)
  parentPickerError.value = null
  parentPickerOpen.value = true
  if (!parentTasks.value.length) {
    await fetchParentTasks()
  }
  updateParentPickerPosition()
}
function closeParentPicker () {
  parentPickerOpen.value = false
  parentPickerError.value = null
  parentPickerStyle.value = {}
}
function selectParentTask (id: number) {
  if (parentTaskId.value === id) return
  parentTaskId.value = id
}
function clearParentTask () {
  if (parentTaskId.value === null) return
  parentTaskId.value = null
}
function shouldIgnoreParentPickerOutsideClose (target: Node): boolean {
  if (!(target instanceof Element)) return false
  const root = parentPickerRootRef.value
  if (!root) return false
  const actionBtn = root.querySelector('.action-btn')
  if (actionBtn instanceof HTMLElement && actionBtn.contains(target)) {
    return true
  }
  const detailBtn = root.querySelector('.detail-value-btn')
  if (detailBtn instanceof HTMLElement && detailBtn.contains(target)) {
    return true
  }
  return false
}
function onParentPickerOutsidePointerDown (event: MouseEvent) {
  if (!parentPickerOpen.value || event.button !== 0) return
  const target = event.target
  if (!(target instanceof Node)) return
  if (resolveParentPickerPopoverElement()?.contains(target)) return
  if (shouldIgnoreParentPickerOutsideClose(target)) return
  dismissPopoverFromOutsidePointer(target, closeParentPicker)
}
function onParentPickerEscape (event: KeyboardEvent) {
  if (!parentPickerOpen.value || event.key !== 'Escape') return
  event.stopPropagation()
  closeParentPicker()
}
function bindParentPickerListeners () {
  document.addEventListener('mousedown', onParentPickerOutsidePointerDown, true)
  document.addEventListener('keydown', onParentPickerEscape, true)
}
function unbindParentPickerListeners () {
  document.removeEventListener('mousedown', onParentPickerOutsidePointerDown, true)
  document.removeEventListener('keydown', onParentPickerEscape, true)
}
function onBackdropClose () {
  if (submitting.value) return
  if (parentPickerOpen.value) {
    closeParentPicker()
    return
  }
  if (panePopoverOpen.value) {
    void taskFormPaneRef.value?.closePopover?.()
    return
  }
  close()
}
function onDocumentKeydown (event: KeyboardEvent) {
  if (!props.modelValue) {
    return
  }
  if (getTopmostModalOverlay() !== overlayRef.value) {
    return
  }
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    onBackdropClose()
    return
  }
  if (isCtrlEnterKeydown(event)) {
    if (!canSubmit.value) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    void submit()
  }
}
const {
  onOverlayMouseDown,
  resetOverlayBackdropClose,
} = createOverlayBackdropClose({
  onClose: onBackdropClose,
  canClose: () => !submitting.value,
})
async function fetchParentTasks () {
  parentTasksLoading.value = true
  try {
    const res = await api<{ data: ParentTaskOption[] }>(
      `/orgs/${props.orgSlug}/workspaces/${props.workspaceId}/tasks/parents`,
    )
    parentTasks.value = res.data
  } catch {
    parentTasks.value = []
  } finally {
    parentTasksLoading.value = false
  }
}
function resetForm () {
  draft.value = createEmptyTaskFormDraft()
  createAsParent.value = false
  parentTaskId.value = null
  parentTaskDefaultsLoading.value = false
  submitError.value = null
  parentPickerError.value = null
  closeParentPicker()
}
async function applyParentTaskDefaults (parentId: number | null) {
  if (createAsParent.value) return
  const requestId = ++parentDefaultsRequestId
  if (parentId === null) {
    draft.value = clearTaskDraftDefaults(draft.value)
    nextTick(() => {
      taskFormPaneRef.value?.resetPaneState()
    })
    return
  }
  parentTaskDefaultsLoading.value = true
  submitError.value = null
  try {
    const detail = await api<ParentTaskDetail>(
      `/orgs/${props.orgSlug}/workspaces/${props.workspaceId}/tasks/${parentId}`,
    )
    if (requestId !== parentDefaultsRequestId) return
    draft.value = applyTaskDefaultsToDraft(draft.value, detail)
    nextTick(() => {
      taskFormPaneRef.value?.resetPaneState()
    })
  } catch (e: unknown) {
    if (requestId !== parentDefaultsRequestId) return
    parentPickerError.value = e instanceof Error ? e.message : '親タスクの情報取得に失敗しました'
  } finally {
    if (requestId === parentDefaultsRequestId) {
      parentTaskDefaultsLoading.value = false
    }
  }
}
async function submit () {
  if (!canSubmit.value || props.listId === null) return
  submitting.value = true
  submitError.value = null
  try {
    await ensureOrgEffortSettings(props.orgSlug)
    const body = buildTaskCreateBody(draft.value, {
      listId: props.listId,
      createAsParent: createAsParent.value,
      parentTaskId: parentTaskId.value,
      orgEffortUnit: getOrgEffortUnit(props.orgSlug),
    })
    const created = await api<CreatedTask>(
      `/orgs/${props.orgSlug}/workspaces/${props.workspaceId}/tasks`,
      { method: 'POST', body },
    )
    emit('created', created)
    emit('update:modelValue', false)
  } catch (e: unknown) {
    submitError.value = e instanceof Error ? e.message : '作成に失敗しました'
  } finally {
    submitting.value = false
  }
}
watch(createAsParent, (enabled) => {
  closeParentPicker()
  if (enabled) {
    parentTaskId.value = null
    draft.value = clearTaskDraftDefaults(draft.value)
    nextTick(() => {
      taskFormPaneRef.value?.resetPaneState()
    })
  }
})
watch(parentTaskId, (parentId) => {
  void applyParentTaskDefaults(parentId)
})
watch(parentPickerOpen, (open) => {
  if (open) {
    bindParentPickerListeners()
    const onResize = () => updateParentPickerPosition()
    window.addEventListener('resize', onResize)
    removeParentPickerResizeListener = () => window.removeEventListener('resize', onResize)
    return
  }
  unbindParentPickerListeners()
  removeParentPickerResizeListener?.()
  removeParentPickerResizeListener = null
})
watch(
  () => props.modelValue,
  (open) => {
    if (!import.meta.client) {
      return
    }
    if (open) {
      document.addEventListener('keydown', onDocumentKeydown, true)
      resetForm()
      void fetchParentTasks()
      return
    }
    document.removeEventListener('keydown', onDocumentKeydown, true)
    resetOverlayBackdropClose()
    closeParentPicker()
  },
)
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onDocumentKeydown, true)
  resetOverlayBackdropClose()
  unbindParentPickerListeners()
  removeParentPickerResizeListener?.()
})
</script>
<style lang="scss" scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 4rem 1rem 1rem;
  z-index: 70;
  overflow-y: auto;
}
.modal-overlay--popover-open {
  overflow: hidden;
}
.modal-card {
  position: relative;
  width: min(40rem, 100%);
  border-radius: 12px;
  overflow: visible;
  background: #fff;
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.18);
}
.modal-header {
  @include mixin.modal-header-bar;
  border-radius: 12px 12px 0 0;
}
.modal-header h3 {
  margin: 0;
  font-size: 1.05rem;
  line-height: 1;
}
.icon-close {
  @include mixin.modal-close-hit-area;
  background: transparent;
  border: none;
  color: #fff;
  font-size: 1.4rem;
  line-height: 1;
  cursor: pointer;
}
.modal-body {
  position: relative;
  padding: 1.2rem 1.35rem 1.35rem;
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
  overflow: visible;
  border-radius: 0 0 12px 12px;
}
.parent-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.parent-toggle-card {
  border: 1.6px solid mixin.$main;
  border-radius: 10px;
  background: mixin.$main-aqua-surface;
  padding: 0.85rem 0.95rem;
}
.parent-toggle-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}
.parent-toggle-card__label-wrap {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  min-width: 0;
}
.parent-toggle-card__icon {
  flex-shrink: 0;
  color: mixin.$text;
}
.parent-toggle-card__label {
  font-size: 0.92rem;
  font-weight: 700;
  color: mixin.$text;
  line-height: 1.3;
}
.parent-toggle-card__hint {
  margin: 0.45rem 0 0;
  padding-left: 1.65rem;
  font-size: 0.78rem;
  line-height: 1.45;
  color: mixin.$text;
}
.task-form-section {
  overflow: visible;
  min-width: 0;
}
.toggle-switch {
  border: none;
  padding: 0;
  background: transparent;
  cursor: pointer;
  flex-shrink: 0;
}
.toggle-switch__track {
  display: inline-flex;
  align-items: center;
  width: 2.6rem;
  height: 1.45rem;
  border-radius: 999px;
  background: #cbd5e1;
  padding: 0.15rem;
  box-sizing: border-box;
  transition: background 0.15s ease;
}
.toggle-switch[aria-checked='true'] .toggle-switch__track {
  background: mixin.$main;
}
.toggle-switch__thumb {
  width: 1.15rem;
  height: 1.15rem;
  border-radius: 999px;
  background: #fff;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.2);
  transform: translateX(0);
  transition: transform 0.15s ease;
}
.toggle-switch[aria-checked='true'] .toggle-switch__thumb {
  transform: translateX(1.15rem);
}
.parent-picker-block {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.parent-select-wrap {
  position: relative;
  align-self: flex-start;
}
.popover-layer--portal {
  position: fixed;
  inset: 0;
  z-index: 80;
  pointer-events: none;
}
.popover-layer--portal .popover {
  position: fixed;
  margin: 0;
  pointer-events: auto;
}
.popover {
  position: absolute;
  z-index: 10;
  width: min(18.5rem, calc(100vw - 1.5rem));
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 10px 32px rgba(15, 23, 42, 0.2);
  border: 1px solid #e2e8f0;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}
.popover--parent-task {
  width: min(19.5rem, calc(100vw - 1.5rem));
  padding: 0;
  gap: 0;
}
.popover-fade-enter-active,
.popover-fade-leave-active {
  transition: opacity 0.12s ease;
}
.popover-fade-enter-from,
.popover-fade-leave-to {
  opacity: 0;
}
.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  border: 1px solid mixin.$border;
  border-radius: 8px;
  padding: 0.38rem 0.7rem;
  font-size: 0.84rem;
  font-weight: 600;
  color: #334155;
  background: #f8fafc;
  cursor: pointer;
}
.action-btn:hover:not(:disabled) {
  background: #f1f5f9;
  border-color: #94a3b8;
}
.action-btn--active,
.action-btn--active:hover:not(:disabled) {
  background: color-mix(in srgb, mixin.$main 12%, mixin.$white);
  border-color: mixin.$main;
  color: mixin.$main-hover;
}
.action-btn-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  line-height: 0;
}
.detail-meta-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 1rem 1.25rem;
}
.detail-item {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.detail-item--parent {
  min-width: 0;
  flex: 1 1 0;
}
.detail-item-label {
  font-size: 0.78rem;
  font-weight: 700;
  color: #64748b;
}
.detail-value-btn {
  align-self: flex-start;
  border: none;
  border-radius: 6px;
  padding: 0.35rem 0.55rem;
  font-size: 0.92rem;
  font-weight: 700;
  color: #0f172a;
  background: #fff;
  cursor: pointer;
  text-align: left;
}
.detail-item--parent .detail-value-btn {
  font-size: 1.2rem;
  padding: 0.45rem 0.7rem;
  max-width: 100%;
  overflow-wrap: anywhere;
  word-break: break-word;
}
.detail-item--parent .detail-value-btn:disabled {
  opacity: 1;
  color: #0f172a;
  cursor: default;
}
.detail-value-btn--editing {
  cursor: pointer;
}
.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding-top: 0.25rem;
}
.primary-btn,
.ghost-btn {
  border-radius: 999px;
  border: 1px solid transparent;
  padding: 0.5rem 1.1rem;
  font-weight: 800;
  cursor: pointer;
  font-size: 0.86rem;
}
.primary-btn {
  background: mixin.$main;
  color: mixin.$white;
}
.ghost-btn {
  border-color: #cbd5e1;
  color: mixin.$text-sub;
  background: #f1f5f9;
}
.err {
  margin: 0;
  color: #b91c1c;
  font-weight: 700;
  font-size: 0.86rem;
}
button:disabled:not(.parent-task-picker-row):not(.detail-value-btn) {
  opacity: 0.55;
  cursor: not-allowed;
}
</style>
