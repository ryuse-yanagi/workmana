<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div
        v-if="modelValue"
        ref="overlayRef"
        class="modal-overlay"
        :class="{ 'modal-overlay--popover-open': anyPopoverOpen }"
        role="presentation"
        @mousedown="onOverlayMouseDown"
      >
        <section
          ref="modalCardRef"
          class="modal-card"
          :class="{
            'modal-card--content-pending': !contentReady,
            'modal-card--fade-in': contentShouldFadeIn,
          }"
          :style="modalScrollbarStyle"
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
            >
              <X
                :size="20"
                :stroke-width="2.25"
                aria-hidden="true"
              />
            </button>
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
                  OFFの場合、親タスクを指定すると子タスクとして作成されます
                </p>
              </div>
              <div
                v-if="!createAsParent"
                ref="metaPickerRootRef"
                class="parent-picker-block"
              >
                <div
                  class="detail-meta-row"
                >
                  <section
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
                </div>
              </div>
            </section>
            <div class="task-form-section">
              <TaskFormPane
                ref="taskFormPaneRef"
                v-model="draft"
                :org-slug="orgSlug"
                :org-labels="orgLabels"
                :label-categories="labelCategories"
                :workspace-members="workspaceMembers"
                :disabled="submitting"
                :title-error="titleError"
                relaxed-title-padding
                auto-focus-title
              >
                <template
                  v-if="selectedListId !== null"
                  #after-title
                >
                  <div class="detail-meta-row detail-meta-row--list">
                    <button
                      ref="listPickerBtnRef"
                      type="button"
                      class="task-detail-list-btn"
                      data-popover-trigger
                      :class="{
                        'task-detail-list-btn--placeholder': !selectedListOption,
                        'task-detail-list-btn--open': listPickerOpen,
                      }"
                      :style="selectedListValueStyle"
                      :disabled="submitting"
                      :aria-label="`リスト: ${selectedListName}`"
                      :aria-expanded="listPickerOpen"
                      @click.stop="toggleListPicker($event)"
                    >
                      <span class="task-detail-list-btn__name">{{ selectedListName }}</span>
                      <ChevronDown
                        class="task-detail-list-btn__chevron"
                        :size="14"
                        :stroke-width="2.5"
                        aria-hidden="true"
                      />
                    </button>
                  </div>
                </template>
              </TaskFormPane>
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
    </Transition>
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
          :show-clear="parentTaskId !== null"
          @close="closeParentPicker"
          @clear="clearParentTask"
        >
          <ParentTaskPickerPanel
            :loading="parentTasksLoading"
            :parents="parentTasks"
            :selected-parent-id="parentTaskId"
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
        <TaskListPickerPopover
          ref="listPickerPopoverRef"
          :style="listPickerStyle"
          :disabled="submitting"
          :can-clear="selectedListId !== null"
          :error="listPickerError"
          :lists="workspaceLists"
          :selected-id="selectedListId"
          variant="bar"
          :bar-style="listPickerBarStyle"
          @close="closeListPicker"
          @select="selectList"
          @clear="clearList"
        />
      </div>
    </Transition>
  </Teleport>
</template>
<script setup lang="ts">
import ParentTaskPickerPanel from '../task/ParentTaskPickerPanel.vue'
import TaskFormPane from '../task/TaskFormPane.vue'
import TaskListPickerPopover from '../task/popover/TaskListPickerPopover.vue'
import PopoverShell from '../ui/PopoverShell.vue'
import { ChevronDown, X } from 'lucide-vue-next'
import { useApi } from '../../composables/useApi'
import {
  applyTaskDefaultsToDraft,
  buildTaskCreateBody,
  clearTaskDraftDefaults,
  createEmptyTaskFormDraft,
  listBarSurfaceStyle,
  type TaskFormDefaultsSource,
  type TaskFormDraft,
  type TaskFormLabel,
  type TaskFormMember,
} from '../../composables/useTaskFormHelpers'
import type { TaskPopoverListOption } from '../../utils/taskPopoverTypes'
import type { LabelCategoryGroup } from '../../composables/useLabelCategories'
import type { TaskFormPopoverType } from '../../composables/useTaskFormPane'
import {
  resolveListColor,
  type WorkspaceListOption,
} from '../../composables/useTaskPopoverEditor'
import { createOverlayBackdropClose, dismissExclusivePopoverBeforeModalClose, dismissPopoverFromOutsidePointer, getTopmostModalOverlay, isCtrlEnterKeydown, isInsideFloatingPopover } from '../../utils/uiInteraction'
import { useModalLayer } from '../../composables/useModalLayer'
import { useModalScrollbarGutter } from '../../composables/useModalScrollbarGutter'
import {
  POPOVER_PANEL_BASE_WIDTH,
  POPOVER_VIEWPORT_INSET,
  buildAnchoredPopoverStyle,
  computeAnchoredPopoverBelowLayout,
  popoverPositionVisibilityStyle,
  schedulePopoverOpenLayout,
} from '../../utils/popoverScrollbar'
import { useExclusivePopover } from '../../composables/useExclusivePopover'
import { taskTitleFieldError } from '../../utils/formValidation'
type ParentTaskOption = {
  id: number
  title: string
}
type ParentTaskDetail = {
  start_date: string | null
  due_date: string | null
  effort_hours: number | string | null
  progress_rate: number | string | null
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
  priority?: string
  start_date?: string | null
  due_date?: string | null
  effort_hours?: number | string | null
  progress_rate?: number | string | null
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
  labelCategories?: LabelCategoryGroup[]
  workspaceMembers: TaskFormMember[]
  workspaceLists?: WorkspaceListOption[]
  initialParentTaskId?: number | null
  /** 子タスク追加時に親詳細を先読みした結果（あれば API 再取得せず適用） */
  initialParentDefaults?: TaskFormDefaultsSource | null
}>(), {
  workspaceLists: () => [],
  labelCategories: () => [],
  initialParentTaskId: null,
  initialParentDefaults: null,
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
const contentReady = ref(true)
const contentShouldFadeIn = ref(false)
let contentFadeInTimer: ReturnType<typeof setTimeout> | null = null
let prepareOpenGeneration = 0
const submitting = ref(false)
const submitError = ref<string | null>(null)
const titleError = ref<string | null>(null)
const parentPickerOpen = ref(false)
const listPickerOpen = ref(false)
const metaPickerRootRef = ref<HTMLElement | null>(null)
const listPickerBtnRef = ref<HTMLElement | null>(null)
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
/** resetForm で先読み適用した直後の watch(parentTaskId) を一度だけ無視する */
let ignoreParentDefaultsWatch = false
let removeParentPickerResizeListener: (() => void) | null = null
let removeListPickerResizeListener: (() => void) | null = null
const POPOVER_ANCHOR_GAP = 6
const POPOVER_MIN_HEIGHT = 120
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
  if (!color) return undefined
  return listBarSurfaceStyle(color)
})
function listPickerBarStyle (list: TaskPopoverListOption) {
  return listBarSurfaceStyle(list.color ?? '')
}
const panePopoverOpen = computed(() => taskFormPaneRef.value?.activePopover != null)
const anyPopoverOpen = computed(() => panePopoverOpen.value || parentPickerOpen.value || listPickerOpen.value)

const modalCardRef = ref<HTMLElement | null>(null)
const { scrollbarStyle: modalScrollbarStyle } = useModalScrollbarGutter({
  cardRef: modalCardRef,
  open: () => props.modelValue,
  scrollerSelector: '.modal-body',
})

useModalLayer(() => props.modelValue)
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
function positionAnchoredPopover (
  anchor: HTMLElement | null,
  popover: HTMLElement | null,
  baseWidthPx: number,
  visible = true,
): Record<string, string> | null {
  if (!anchor || !popover) return null
  const layout = computeAnchoredPopoverBelowLayout(
    anchor.getBoundingClientRect(),
    baseWidthPx,
    popover,
    {
      pad: POPOVER_VIEWPORT_INSET,
      gap: POPOVER_ANCHOR_GAP,
      minHeight: POPOVER_MIN_HEIGHT,
    },
  )
  return buildAnchoredPopoverStyle(layout, { zIndex: 210, visible })
}
function positionParentPicker (visible = true) {
  const style = positionAnchoredPopover(
    parentPickerAnchorEl.value,
    resolveParentPickerPopoverElement(),
    POPOVER_PANEL_BASE_WIDTH.parent,
    visible,
  )
  if (style) parentPickerStyle.value = style
}
function positionListPicker (visible = true) {
  const style = positionAnchoredPopover(
    listPickerAnchorEl.value,
    resolveListPickerPopoverElement(),
    POPOVER_PANEL_BASE_WIDTH.list,
    visible,
  )
  if (style) listPickerStyle.value = style
}
function updateParentPickerPosition () {
  const wasVisible = parentPickerStyle.value.visibility === 'visible'
  if (!wasVisible) {
    parentPickerStyle.value = popoverPositionVisibilityStyle(false)
    nextTick(() => {
      schedulePopoverOpenLayout(
        () => positionParentPicker(false),
        () => positionParentPicker(true),
      )
    })
    return
  }
  nextTick(() => {
    requestAnimationFrame(() => positionParentPicker(true))
  })
}
function updateListPickerPosition () {
  const wasVisible = listPickerStyle.value.visibility === 'visible'
  if (!wasVisible) {
    listPickerStyle.value = popoverPositionVisibilityStyle(false)
    nextTick(() => {
      schedulePopoverOpenLayout(
        () => positionListPicker(false),
        () => positionListPicker(true),
      )
    })
    return
  }
  nextTick(() => {
    requestAnimationFrame(() => positionListPicker(true))
  })
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
  const fromEvent = event?.currentTarget
  listPickerAnchorEl.value = fromEvent instanceof HTMLElement
    ? fromEvent
    : listPickerBtnRef.value
  listPickerError.value = null
  listPickerOpen.value = true
  updateListPickerPosition()
}
function closeParentPicker () {
  parentPickerOpen.value = false
  parentPickerError.value = null
  parentPickerStyle.value = popoverPositionVisibilityStyle(false)
}
function closeListPicker () {
  listPickerOpen.value = false
  listPickerError.value = null
  listPickerStyle.value = popoverPositionVisibilityStyle(false)
}
useExclusivePopover(parentPickerOpen, closeParentPicker)
useExclusivePopover(listPickerOpen, closeListPicker)
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
    return
  }
  selectedListId.value = listId
}
function clearList () {
  if (selectedListId.value === null) return
  selectedListId.value = null
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
  if (isInsideFloatingPopover(target)) return
  if (resolveParentPickerPopoverElement()?.contains(target)) return
  if (shouldIgnoreMetaPickerOutsideClose(target, ['.detail-value-btn--parent'])) return
  dismissPopoverFromOutsidePointer(target, closeParentPicker)
}
function onListPickerOutsidePointerUp (event: MouseEvent) {
  if (!listPickerOpen.value || event.button !== 0) return
  const target = event.target
  if (!(target instanceof Node)) return
  if (isInsideFloatingPopover(target)) return
  if (resolveListPickerPopoverElement()?.contains(target)) return
  if (listPickerBtnRef.value?.contains(target)) return
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
  if (dismissExclusivePopoverBeforeModalClose()) return
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
function clearContentFadeInTimer () {
  if (contentFadeInTimer === null) return
  clearTimeout(contentFadeInTimer)
  contentFadeInTimer = null
}
function triggerContentFadeIn () {
  clearContentFadeInTimer()
  contentShouldFadeIn.value = true
  contentFadeInTimer = setTimeout(() => {
    contentShouldFadeIn.value = false
    contentFadeInTimer = null
  }, 260)
}
async function prepareOpenForm () {
  const generation = ++prepareOpenGeneration
  resetForm()
  const gateOnParentTitle = props.initialParentTaskId != null
  if (!gateOnParentTitle) {
    if (generation !== prepareOpenGeneration || !props.modelValue) return
    contentReady.value = true
    void fetchParentTasks()
    return
  }
  // 親タスク名が解決するまでカードを隠し、「未設定」→本名のちらつきを防ぐ
  contentReady.value = false
  contentShouldFadeIn.value = false
  await fetchParentTasks()
  if (generation !== prepareOpenGeneration || !props.modelValue) return
  contentReady.value = true
  await nextTick()
  if (generation !== prepareOpenGeneration || !props.modelValue) return
  triggerContentFadeIn()
  nextTick(() => {
    if (generation !== prepareOpenGeneration || !props.modelValue) return
    taskFormPaneRef.value?.focusTitleInput()
  })
}
function resetForm () {
  draft.value = createEmptyTaskFormDraft()
  createAsParent.value = false
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
  const initialParentId = props.initialParentTaskId ?? null
  const prefetched = initialParentId != null ? props.initialParentDefaults : null
  if (prefetched) {
    ignoreParentDefaultsWatch = parentTaskId.value !== initialParentId
    parentTaskId.value = initialParentId
    draft.value = applyTaskDefaultsToDraft(draft.value, prefetched)
    nextTick(() => {
      taskFormPaneRef.value?.resetPaneState()
    })
    return
  }
  // 同じ親IDで再オープンすると watch(parentTaskId) が発火しないため、明示適用する
  const parentUnchanged = parentTaskId.value === initialParentId
  parentTaskId.value = initialParentId
  if (parentUnchanged) {
    void applyParentTaskDefaults(initialParentId)
  }
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
  if (ignoreParentDefaultsWatch) {
    ignoreParentDefaultsWatch = false
    return
  }
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
      if (props.initialParentTaskId != null) {
        contentReady.value = false
        contentShouldFadeIn.value = false
      } else {
        contentReady.value = true
        contentShouldFadeIn.value = false
      }
      void prepareOpenForm()
      return
    }
    document.removeEventListener('keydown', onDocumentKeydown, true)
    resetOverlayBackdropClose()
    closeParentPicker()
    closeListPicker()
    clearContentFadeInTimer()
    contentShouldFadeIn.value = false
    contentReady.value = true
    prepareOpenGeneration += 1
  },
)
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onDocumentKeydown, true)
  resetOverlayBackdropClose()
  unbindParentPickerListeners()
  unbindListPickerListeners()
  removeParentPickerResizeListener?.()
  removeListPickerResizeListener?.()
  clearContentFadeInTimer()
})
</script>
<style lang="scss" scoped src="~/assets/styles/components/modals/TaskCreateModal.scss"></style>
