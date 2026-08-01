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
          aria-label="タスクの追加"
        >
          <header class="modal-header">
            <h3>タスクの追加</h3>
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
                ref="metaPickerRootRef"
                class="parent-picker-block"
              >
                <div
                  class="detail-meta-row"
                >
                  <section
                    v-if="!createAsParent"
                    class="detail-item detail-item--parent"
                  >
                    <span class="detail-item-label">親タスク</span>
                    <button
                      type="button"
                      class="detail-value-btn detail-value-btn--parent"
                      :class="{ 'detail-value-btn--editing': parentPickerOpen }"
                      :disabled="submitting || parentTasksLoading || parentTaskDefaultsLoading"
                      @click.stop="toggleParentPicker($event)"
                    >
                      {{ selectedParentTaskTitle }}
                    </button>
                  </section>
                  <section
                    v-if="selectedListId !== null"
                    class="detail-item detail-item--list"
                  >
                    <span class="detail-item-label">リスト</span>
                    <button
                      type="button"
                      class="detail-value-btn detail-value-btn--list"
                      :class="{ 'detail-value-btn--editing': listPickerOpen }"
                      :style="selectedListValueStyle"
                      :disabled="submitting"
                      @click.stop="toggleListPicker($event)"
                    >
                      {{ selectedListName }}
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
                :title-error="titleError"
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
                :disabled="submitting"
                @click="submit"
              >
                追加
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
            show-unset-option
            :error="parentPickerError"
            @select="selectParentTask"
            @clear="clearParentTask"
          />
        </PopoverShell>
      </div>
    </Transition>
  </Teleport>
  <Teleport to="body">
    <Transition name="popover-fade" @after-enter="updateListPickerPosition">
      <div
        v-if="modelValue && listPickerOpen"
        class="popover-layer popover-layer--portal"
      >
        <PopoverShell
          ref="listPickerPopoverRef"
          shell-class="popover popover--list"
          :style="listPickerStyle"
          title="リストを選択"
          aria-label="リストを選択"
          :close-disabled="submitting"
          @close="closeListPicker"
        >
          <div class="popover-scroll">
            <ul class="list-picker-list">
              <li
                v-for="list in workspaceLists"
                :key="list.id"
              >
                <button
                  type="button"
                  class="list-picker-row"
                  :class="{ 'list-picker-row--selected': selectedListId === list.id }"
                  :disabled="submitting"
                  @click.stop="selectList(list.id)"
                >
                  <span
                    class="list-picker-radio"
                    :class="{ 'list-picker-radio--checked': selectedListId === list.id }"
                    aria-hidden="true"
                  />
                  <span class="list-picker-label">{{ list.name }}</span>
                </button>
              </li>
            </ul>
            <p v-if="!workspaceLists.length" class="empty-text list-picker-empty">
              リストがありません。
            </p>
            <p v-if="listPickerError" class="err">{{ listPickerError }}</p>
          </div>
        </PopoverShell>
      </div>
    </Transition>
  </Teleport>
</template>
<script setup lang="ts">
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
import {
  resolveListColor,
  type WorkspaceListOption,
} from '../../composables/useTaskPopoverEditor'
import { createOverlayBackdropClose, dismissPopoverFromOutsidePointer, getTopmostModalOverlay, isCtrlEnterKeydown } from '../../utils/uiInteraction'
import { taskTitleFieldError } from '../../utils/formValidation'
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
const props = withDefaults(defineProps<{
  modelValue: boolean
  orgSlug: string
  workspaceId: string
  listId: number | null
  orgLabels: TaskFormLabel[]
  workspaceMembers: TaskFormMember[]
  workspaceLists?: WorkspaceListOption[]
}>(), {
  workspaceLists: () => [],
})
const emit = defineEmits<{
  'update:modelValue': [boolean]
  created: [CreatedTask]
}>()
const { api } = useApi()
const draft = ref<TaskFormDraft>(createEmptyTaskFormDraft())
const createAsParent = ref(false)
const parentTaskId = ref<number | null>(null)
const selectedListId = ref<number | null>(null)
const parentTasks = ref<ParentTaskOption[]>([])
const parentTasksFetched = ref(false)
const parentTasksLoading = ref(false)
const parentTaskDefaultsLoading = ref(false)
const submitting = ref(false)
const submitError = ref<string | null>(null)
const titleError = ref<string | null>(null)
const parentPickerOpen = ref(false)
const listPickerOpen = ref(false)
const metaPickerRootRef = ref<HTMLElement | null>(null)
const parentPickerAnchorEl = ref<HTMLElement | null>(null)
const listPickerAnchorEl = ref<HTMLElement | null>(null)
const parentPickerPopoverRef = ref<{ rootRef: HTMLElement | null } | null>(null)
const listPickerPopoverRef = ref<{ rootRef: HTMLElement | null } | null>(null)
const parentPickerStyle = ref<Record<string, string>>({})
const listPickerStyle = ref<Record<string, string>>({})
const parentPickerError = ref<string | null>(null)
const listPickerError = ref<string | null>(null)
const taskFormPaneRef = ref<TaskFormPaneExpose | null>(null)
const overlayRef = ref<HTMLElement | null>(null)
let parentDefaultsRequestId = 0
let removeParentPickerResizeListener: (() => void) | null = null
let removeListPickerResizeListener: (() => void) | null = null
const POPOVER_VIEWPORT_PAD = 12
const POPOVER_ANCHOR_GAP = 6
const POPOVER_MIN_HEIGHT = 120
const POPOVER_DEFAULT_WIDTH_PX = 312
const selectedParentTaskTitle = computed(() => {
  if (parentTaskId.value === null) return '未設定'
  const parent = parentTasks.value.find(item => item.id === parentTaskId.value)
  return parent?.title ?? '未設定'
})
const selectedListOption = computed((): WorkspaceListOption | null => {
  const listId = selectedListId.value
  if (listId == null) return null
  return props.workspaceLists.find(list => list.id === listId) ?? null
})
const selectedListName = computed(() => selectedListOption.value?.name ?? 'リストを選択')
const selectedListValueStyle = computed(() => {
  const color = resolveListColor(selectedListId.value, props.workspaceLists)
  return color ? { color } : undefined
})
const panePopoverOpen = computed(() => taskFormPaneRef.value?.activePopover != null)
const anyPopoverOpen = computed(() => panePopoverOpen.value || parentPickerOpen.value || listPickerOpen.value)
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
function resolveListPickerPopoverElement (): HTMLElement | null {
  return listPickerPopoverRef.value?.rootRef ?? null
}
function captureMetaPickerAnchor (event: Event | undefined, selector: string): HTMLElement | null {
  const fromEvent = event?.currentTarget
  if (fromEvent instanceof HTMLElement) return fromEvent
  return metaPickerRootRef.value?.querySelector(selector) ?? null
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
function updateListPickerPosition () {
  nextTick(() => {
    requestAnimationFrame(() => {
      positionListPicker()
      if (!listPickerPopoverRef.value) {
        requestAnimationFrame(() => positionListPicker())
      }
    })
  })
}
function positionAnchoredPopover (
  anchor: HTMLElement | null,
  popover: HTMLElement | null,
): Record<string, string> | null {
  if (!anchor || !popover) return null
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
  return {
    position: 'fixed',
    top: `${Math.round(top)}px`,
    left: `${Math.round(left)}px`,
    maxHeight: `${maxHeight}px`,
    zIndex: '80',
  }
}
function positionParentPicker () {
  const style = positionAnchoredPopover(
    parentPickerAnchorEl.value,
    resolveParentPickerPopoverElement(),
  )
  if (style) parentPickerStyle.value = style
}
function positionListPicker () {
  const style = positionAnchoredPopover(
    listPickerAnchorEl.value,
    resolveListPickerPopoverElement(),
  )
  if (style) listPickerStyle.value = style
}
async function toggleParentPicker (event?: Event) {
  if (submitting.value || parentTasksLoading.value || parentTaskDefaultsLoading.value) return
  if (parentPickerOpen.value) {
    closeParentPicker()
    return
  }
  closeListPicker()
  parentPickerAnchorEl.value = captureMetaPickerAnchor(event, '.detail-value-btn--parent')
  parentPickerError.value = null
  parentPickerOpen.value = true
  updateParentPickerPosition()
  if (!parentTasksFetched.value) {
    await fetchParentTasks()
    updateParentPickerPosition()
  }
}
async function toggleListPicker (event?: Event) {
  if (submitting.value) return
  if (listPickerOpen.value) {
    closeListPicker()
    return
  }
  closeParentPicker()
  listPickerAnchorEl.value = captureMetaPickerAnchor(event, '.detail-value-btn--list')
  listPickerError.value = null
  listPickerOpen.value = true
  updateListPickerPosition()
}
function closeParentPicker () {
  parentPickerOpen.value = false
  parentPickerError.value = null
  parentPickerStyle.value = {}
}
function closeListPicker () {
  listPickerOpen.value = false
  listPickerError.value = null
  listPickerStyle.value = {}
}
function selectParentTask (id: number) {
  if (parentTaskId.value === id) return
  parentTaskId.value = id
}
function clearParentTask () {
  if (parentTaskId.value === null) return
  parentTaskId.value = null
}
function selectList (listId: number) {
  if (selectedListId.value === listId) {
    closeListPicker()
    return
  }
  selectedListId.value = listId
  closeListPicker()
}
function shouldIgnoreMetaPickerOutsideClose (target: Node, selectors: string[]): boolean {
  if (!(target instanceof Element)) return false
  const root = metaPickerRootRef.value
  if (!root) return false
  return selectors.some((selector) => {
    const el = root.querySelector(selector)
    return el instanceof HTMLElement && el.contains(target)
  })
}
function onParentPickerOutsidePointerUp (event: MouseEvent) {
  if (!parentPickerOpen.value || event.button !== 0) return
  const target = event.target
  if (!(target instanceof Node)) return
  if (resolveParentPickerPopoverElement()?.contains(target)) return
  if (shouldIgnoreMetaPickerOutsideClose(target, ['.detail-value-btn--parent'])) return
  dismissPopoverFromOutsidePointer(target, closeParentPicker)
}
function onListPickerOutsidePointerUp (event: MouseEvent) {
  if (!listPickerOpen.value || event.button !== 0) return
  const target = event.target
  if (!(target instanceof Node)) return
  if (resolveListPickerPopoverElement()?.contains(target)) return
  if (shouldIgnoreMetaPickerOutsideClose(target, ['.detail-value-btn--list'])) return
  dismissPopoverFromOutsidePointer(target, closeListPicker)
}
function onParentPickerEscape (event: KeyboardEvent) {
  if (!parentPickerOpen.value || event.key !== 'Escape') return
  event.stopPropagation()
  closeParentPicker()
}
function onListPickerEscape (event: KeyboardEvent) {
  if (!listPickerOpen.value || event.key !== 'Escape') return
  event.stopPropagation()
  closeListPicker()
}
function bindParentPickerListeners () {
  document.addEventListener('mouseup', onParentPickerOutsidePointerUp, true)
  document.addEventListener('keydown', onParentPickerEscape, true)
}
function unbindParentPickerListeners () {
  document.removeEventListener('mouseup', onParentPickerOutsidePointerUp, true)
  document.removeEventListener('keydown', onParentPickerEscape, true)
}
function bindListPickerListeners () {
  document.addEventListener('mouseup', onListPickerOutsidePointerUp, true)
  document.addEventListener('keydown', onListPickerEscape, true)
}
function unbindListPickerListeners () {
  document.removeEventListener('mouseup', onListPickerOutsidePointerUp, true)
  document.removeEventListener('keydown', onListPickerEscape, true)
}
function onBackdropClose () {
  if (submitting.value) return
  if (parentPickerOpen.value) {
    closeParentPicker()
    return
  }
  if (listPickerOpen.value) {
    closeListPicker()
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
    parentTasksFetched.value = true
  }
}
function resetForm () {
  draft.value = createEmptyTaskFormDraft()
  createAsParent.value = false
  parentTaskId.value = null
  selectedListId.value = props.listId
  parentTasks.value = []
  parentTasksFetched.value = false
  parentTaskDefaultsLoading.value = false
  submitError.value = null
  titleError.value = null
  parentPickerError.value = null
  listPickerError.value = null
  closeParentPicker()
  closeListPicker()
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
  if (submitting.value) return
  const validationError = taskTitleFieldError(draft.value.title)
  if (validationError) {
    titleError.value = validationError
    return
  }
  if (selectedListId.value === null) {
    submitError.value = 'リストが選択されていません'
    return
  }
  titleError.value = null
  submitting.value = true
  submitError.value = null
  try {
    const body = buildTaskCreateBody(draft.value, {
      listId: selectedListId.value,
      createAsParent: createAsParent.value,
      parentTaskId: parentTaskId.value,
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
watch(listPickerOpen, (open) => {
  if (open) {
    bindListPickerListeners()
    const onResize = () => updateListPickerPosition()
    window.addEventListener('resize', onResize)
    removeListPickerResizeListener = () => window.removeEventListener('resize', onResize)
    return
  }
  unbindListPickerListeners()
  removeListPickerResizeListener?.()
  removeListPickerResizeListener = null
})
watch(
  () => draft.value.title,
  () => {
    if (titleError.value) {
      titleError.value = null
    }
  },
)
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
    closeListPicker()
  },
)
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onDocumentKeydown, true)
  resetOverlayBackdropClose()
  unbindParentPickerListeners()
  unbindListPickerListeners()
  removeParentPickerResizeListener?.()
  removeListPickerResizeListener?.()
})
</script>
<style lang="scss" scoped src="~/assets/styles/components/modals/TaskCreateModal.scss"></style>
