<template>
  <Teleport to="body">
    <Transition
      name="popover-fade"
      @after-leave="onAfterLeave"
    >
      <PopoverShell
        v-if="modelValue"
        ref="shellRef"
        title="アーカイブ済みタスク"
        aria-label="アーカイブ済みタスク"
        shell-class="popover archived-list-popover"
        :style="popoverStyle"
        :close-disabled="pendingId !== null || isConfirmOpen"
        :inert="isConfirmOpen"
        @close="closePopover"
      >
        <div class="popover-scroll archived-list-popover__scroll">
          <div class="archived-list-popover__body">
            <p
              v-if="error"
              class="archived-list-popover__err"
            >{{ error }}</p>
            <section
              v-if="loading && tasks === null"
              class="archived-list-popover__empty archived-list-popover__loading"
              aria-busy="true"
              aria-label="読み込み中"
            >
              <p aria-hidden="true">アーカイブ済みタスクはありません</p>
              <div class="spinner" />
            </section>
            <div
              v-else-if="tasks !== null"
              :class="[
                'archived-list-popover__content',
                { 'archived-list-popover__content--fade-in': contentShouldFadeIn },
              ]"
            >
              <section
                v-if="!tasks.length"
                class="archived-list-popover__empty"
              >
                <p>アーカイブ済みタスクはありません</p>
              </section>
              <ul
                v-else
                class="archived-list-popover__list"
              >
                <li
                  v-for="task in tasks"
                  :key="task.id"
                  class="archived-list-popover__item"
                  :data-archived-task-id="task.id"
                >
                  <TaskBoardCard :task="task" />
                  <footer
                    v-if="canManageArchive || archivedChildCount(task) > 0"
                    class="archived-list-popover__actions"
                  >
                    <div class="archived-list-popover__actions-start">
                      <button
                        v-if="canManageArchive"
                        type="button"
                        class="archived-list-popover__action"
                        :disabled="pendingId === task.id"
                        @click="openRestoreConfirm(task)"
                      >
                        復元
                      </button>
                      <button
                        v-if="canManageArchive"
                        type="button"
                        class="archived-list-popover__action archived-list-popover__action--danger"
                        :disabled="pendingId === task.id"
                        @click="openDeleteConfirm(task)"
                      >
                        削除
                      </button>
                    </div>
                    <button
                      v-if="archivedChildCount(task) > 0"
                      type="button"
                      class="archived-list-popover__action archived-list-popover__action--children"
                      data-popover-trigger
                      :aria-expanded="childrenPopoverTaskId === task.id"
                      @pointerdown.stop
                      @click.stop="toggleChildrenPopover(task, $event)"
                    >
                      子タスク{{ archivedChildCount(task) }}件
                    </button>
                  </footer>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </PopoverShell>
    </Transition>

    <Transition name="popover-fade">
      <PopoverShell
        v-if="childrenPopoverTask"
        ref="childrenShellRef"
        :title="`子タスク${archivedChildCount(childrenPopoverTask)}件`"
        :aria-label="`子タスク${archivedChildCount(childrenPopoverTask)}件`"
        shell-class="popover archived-list-popover archived-list-popover--children"
        :style="childrenPopoverStyle"
        @close="closeChildrenPopover"
      >
        <div class="popover-scroll archived-list-popover__scroll">
          <div class="archived-list-popover__body">
            <ul class="archived-list-popover__list">
              <li
                v-for="child in childrenPopoverTask.archived_children ?? []"
                :key="child.id"
                class="archived-list-popover__item"
              >
                <TaskBoardCard :task="child" />
              </li>
            </ul>
          </div>
        </div>
      </PopoverShell>
    </Transition>

    <ConfirmModal
      v-model="restoreConfirmOpen"
      width="min(480px, 100%)"
      title="タスクの復元"
      :message="restoreConfirmMessage"
      confirm-text="復元"
      :loading="pendingId !== null"
      @confirm="confirmRestoreTask"
    />
    <ConfirmModal
      v-model="deleteConfirmOpen"
      width="min(480px, 100%)"
      title="タスクの削除"
      :message="deleteConfirmMessage"
      confirm-text="削除"
      variant="danger"
      :loading="pendingId !== null"
      @confirm="confirmPermanentDelete"
    />
  </Teleport>
</template>
<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import { useApi } from '../../../composables/shared/useApi'
import { useArchivedListPopoverLayout } from '../../../composables/archived/useArchivedListPopoverLayout'
import {
  nestArchivedTasks,
  useArchivedTasksCache,
  type ArchivedTask,
} from '../../../composables/archived/useArchivedTasksCache'
import { buildDestructiveConfirmMessage } from '../../../utils/shared/destructiveConfirmMessage'
import type { RealtimeArchivedTask } from '../../../composables/workspace/useWorkspaceRealtimeChannel'
import {
  POPOVER_PANEL_BASE_WIDTH,
  POPOVER_VIEWPORT_INSET,
  buildAnchoredPopoverStyle,
  computeAnchoredPopoverBesideLayout,
  popoverPositionVisibilityStyle,
  schedulePopoverOpenLayout,
} from '../../../utils/ui/popoverScrollbar'
import TaskBoardCard from '../../task/TaskBoardCard.vue'
import PopoverShell from '../../ui/PopoverShell.vue'
import ConfirmModal from '../shared/ConfirmModal.vue'

export type { ArchivedTask }

const props = withDefaults(defineProps<{
  modelValue: boolean
  orgSlug: string
  workspaceId: string
  canManageArchive?: boolean
}>(), {
  canManageArchive: false,
})
const emit = defineEmits<{
  'update:modelValue': [boolean]
  restored: [ArchivedTask, ArchivedTask[]]
}>()

const ARCHIVED_TASKS_POPOVER_WIDTH = 280
const ARCHIVED_CHILDREN_POPOVER_WIDTH = POPOVER_PANEL_BASE_WIDTH.hierarchy

const { api } = useApi()
const {
  getCached,
  fetchList,
  removeCachedTask,
  upsertCachedTask,
} = useArchivedTasksCache()
const tasks = ref<ArchivedTask[] | null>(null)
const error = ref<string | null>(null)
const loading = ref(false)
const contentShouldFadeIn = ref(false)
const pendingId = ref<number | null>(null)
const deleteConfirmTask = ref<ArchivedTask | null>(null)
const restoreConfirmTask = ref<ArchivedTask | null>(null)
const childrenPopoverTaskId = ref<number | null>(null)
const childrenPopoverAnchorEl = ref<HTMLElement | null>(null)
const childrenPopoverStyle = ref<Record<string, string>>(popoverPositionVisibilityStyle(false))
const shellRef = ref<InstanceType<typeof PopoverShell> | null>(null)
const childrenShellRef = ref<InstanceType<typeof PopoverShell> | null>(null)
let contentFadeInTimer: ReturnType<typeof setTimeout> | null = null

const isEmpty = computed(() => tasks.value !== null && tasks.value.length === 0)
const childrenPopoverTask = computed(() => {
  const id = childrenPopoverTaskId.value
  if (id == null || !tasks.value) {
    return null
  }
  return tasks.value.find(task => task.id === id) ?? null
})
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
const isConfirmOpen = computed(() => (
  restoreConfirmTask.value !== null || deleteConfirmTask.value !== null
))
const deleteConfirmMessage = computed(() => {
  const task = deleteConfirmTask.value
  const childCount = task ? archivedChildCount(task) : 0
  return buildDestructiveConfirmMessage(
    'タスク',
    '削除',
    task?.title,
    childCount > 0 ? `※子タスク ${childCount} 件も削除されます。` : null,
  )
})
const restoreConfirmMessage = computed(() => {
  const task = restoreConfirmTask.value
  const childCount = task ? archivedChildCount(task) : 0
  return buildDestructiveConfirmMessage(
    'タスク',
    '復元',
    task?.title,
    childCount > 0 ? `※子タスク ${childCount} 件も復元されます。` : null,
  )
})
const isExclusiveOpen = computed(() => props.modelValue && !isConfirmOpen.value)

const {
  style: popoverStyle,
  close: closeMainPopover,
  onAfterLeave,
  positionPopover,
} = useArchivedListPopoverLayout({
  isOpen: () => props.modelValue,
  isExclusiveOpen,
  baseWidth: ARCHIVED_TASKS_POPOVER_WIDTH,
  canClose: () => pendingId.value === null && !isConfirmOpen.value,
  onClose: () => {
    // Escape や外側クリックは、子タスクポップオーバーが開いていればそちらだけ閉じる
    if (childrenPopoverTaskId.value != null) {
      closeChildrenPopover()
      return
    }
    emit('update:modelValue', false)
  },
  rootRef: shellRef,
})

function archivedChildCount (task: ArchivedTask): number {
  return task.archived_child_count
    ?? task.archived_children?.length
    ?? 0
}

function closePopover () {
  closeChildrenPopover()
  closeMainPopover()
}

function closeChildrenPopover () {
  childrenPopoverTaskId.value = null
  childrenPopoverAnchorEl.value = null
  childrenPopoverStyle.value = popoverPositionVisibilityStyle(false)
}

function positionChildrenPopover () {
  const anchorEl = childrenPopoverAnchorEl.value
  const childShell = childrenShellRef.value?.rootRef ?? null
  const parentShell = shellRef.value?.rootRef ?? null
  if (!anchorEl || !childShell || !parentShell || !import.meta.client) {
    childrenPopoverStyle.value = popoverPositionVisibilityStyle(false)
    return
  }
  const itemRect = anchorEl.getBoundingClientRect()
  const parentRect = parentShell.getBoundingClientRect()
  const layout = computeAnchoredPopoverBesideLayout(
    new DOMRect(parentRect.left, itemRect.top, 0, itemRect.height),
    ARCHIVED_CHILDREN_POPOVER_WIDTH,
    childShell,
    { pad: POPOVER_VIEWPORT_INSET, prefer: 'left' },
  )
  const gap = 6
  const pad = POPOVER_VIEWPORT_INSET
  let left = parentRect.left - gap - layout.panelWidth
  left = Math.max(pad, left)
  childrenPopoverStyle.value = buildAnchoredPopoverStyle({
    ...layout,
    left,
  }, {
    // アーカイブ一覧（--tm-z-popover）より下。重なっても閉じる・復元・削除へクリックが届く
    zIndex: 'calc(var(--tm-z-popover) - 1)',
    visible: true,
  })
}

function toggleChildrenPopover (task: ArchivedTask, event: MouseEvent) {
  if (childrenPopoverTaskId.value === task.id) {
    closeChildrenPopover()
    return
  }
  const trigger = event.currentTarget
  if (!(trigger instanceof HTMLElement)) {
    return
  }
  const item = trigger.closest('.archived-list-popover__item')
  if (!(item instanceof HTMLElement)) {
    return
  }
  childrenPopoverAnchorEl.value = item
  childrenPopoverTaskId.value = task.id
  childrenPopoverStyle.value = popoverPositionVisibilityStyle(false)
  nextTick(() => {
    schedulePopoverOpenLayout(
      () => positionChildrenPopover(),
      () => positionChildrenPopover(),
    )
  })
}

watch(isEmpty, () => {
  if (!props.modelValue) {
    return
  }
  nextTick(() => {
    positionPopover()
    requestAnimationFrame(() => {
      positionPopover()
      if (childrenPopoverTaskId.value != null) {
        positionChildrenPopover()
      }
    })
  })
})

watch(childrenPopoverTaskId, (id) => {
  if (id == null) {
    return
  }
  nextTick(() => {
    schedulePopoverOpenLayout(
      () => positionChildrenPopover(),
      () => positionChildrenPopover(),
    )
  })
})

if (import.meta.client) {
  useEventListener(window, 'resize', () => {
    if (childrenPopoverTaskId.value == null) {
      return
    }
    positionChildrenPopover()
  })
  useEventListener(
    () => shellRef.value?.rootRef?.querySelector('.archived-list-popover__scroll') ?? null,
    'scroll',
    () => {
      if (childrenPopoverTaskId.value == null) {
        return
      }
      positionChildrenPopover()
    },
    { passive: true },
  )
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

async function load () {
  error.value = null
  const cached = getCached(props.orgSlug, props.workspaceId)
  if (cached) {
    tasks.value = nestArchivedTasks(cached)
    loading.value = false
    contentShouldFadeIn.value = false
    if (props.modelValue) {
      nextTick(() => {
        positionPopover()
        requestAnimationFrame(() => positionPopover())
      })
    }
    void fetchList(props.orgSlug, props.workspaceId, { refresh: true })
      .then((fresh) => {
        if (!props.modelValue) {
          return
        }
        tasks.value = nestArchivedTasks(fresh)
        nextTick(() => {
          positionPopover()
          requestAnimationFrame(() => positionPopover())
        })
      })
      .catch(() => {})
    return
  }

  loading.value = true
  contentShouldFadeIn.value = false
  tasks.value = null
  try {
    tasks.value = nestArchivedTasks(await fetchList(props.orgSlug, props.workspaceId))
    triggerContentFadeIn()
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : '読み込みに失敗しました'
  } finally {
    loading.value = false
    if (props.modelValue) {
      nextTick(() => {
        positionPopover()
        requestAnimationFrame(() => positionPopover())
      })
    }
  }
}

async function restoreTask (task: ArchivedTask) {
  pendingId.value = task.id
  error.value = null
  const cascadedChildren = [...(task.archived_children ?? [])]
  try {
    const restored = await api<ArchivedTask>(
      `/orgs/${props.orgSlug}/workspaces/${props.workspaceId}/tasks/${task.id}/unarchive`,
      { method: 'POST' },
    )
    removeCachedTask(props.orgSlug, props.workspaceId, task.id)
    tasks.value = (tasks.value ?? []).filter(t => t.id !== task.id)
    if (childrenPopoverTaskId.value === task.id) {
      closeChildrenPopover()
    }
    emit('restored', restored, cascadedChildren)
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : '復元に失敗しました'
  } finally {
    pendingId.value = null
  }
}

function openRestoreConfirm (task: ArchivedTask) {
  closeChildrenPopover()
  restoreConfirmTask.value = task
}

async function confirmRestoreTask () {
  const task = restoreConfirmTask.value
  if (!task) return
  restoreConfirmTask.value = null
  await restoreTask(task)
}

function openDeleteConfirm (task: ArchivedTask) {
  closeChildrenPopover()
  deleteConfirmTask.value = task
}

async function confirmPermanentDelete () {
  const task = deleteConfirmTask.value
  if (!task) return
  pendingId.value = task.id
  error.value = null
  try {
    await api(
      `/orgs/${props.orgSlug}/workspaces/${props.workspaceId}/tasks/${task.id}`,
      { method: 'DELETE' },
    )
    deleteConfirmTask.value = null
    removeCachedTask(props.orgSlug, props.workspaceId, task.id)
    tasks.value = (tasks.value ?? []).filter(t => t.id !== task.id)
    if (childrenPopoverTaskId.value === task.id) {
      closeChildrenPopover()
    }
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : '削除に失敗しました'
  } finally {
    pendingId.value = null
  }
}

function toArchivedTask (task: RealtimeArchivedTask): ArchivedTask {
  return {
    id: task.id,
    title: task.title,
    description: null,
    list_id: task.list_id,
    archived_at: task.archived_at ?? null,
    labels: task.labels ?? [],
    assignees: task.assignees ?? [],
    start_date: task.start_date ?? null,
    due_date: task.due_date ?? null,
    effort_hours: task.effort_hours ?? null,
    progress_rate: task.progress_rate ?? null,
    is_parent_task: task.is_parent_task ?? false,
    parent_task_id: task.parent_task_id ?? null,
    parent_task_title: task.parent_task_title ?? null,
    archived_child_count: task.archived_child_count
      ?? task.archived_children?.length
      ?? 0,
    archived_children: (task.archived_children ?? []).map(child => toArchivedTask(child)),
  }
}

function addTaskFromRealtime (task: RealtimeArchivedTask) {
  const archived = toArchivedTask(task)
  // 親配下の子は一覧に出さない
  if (archived.parent_task_id != null) {
    const parent = (tasks.value ?? []).find(row => row.id === archived.parent_task_id)
    if (parent) {
      const children = [...(parent.archived_children ?? [])]
      if (!children.some(child => child.id === archived.id)) {
        children.unshift(archived)
      }
      const nextParent: ArchivedTask = {
        ...parent,
        archived_children: children,
        archived_child_count: children.length,
      }
      upsertCachedTask(props.orgSlug, props.workspaceId, nextParent)
      if (tasks.value) {
        tasks.value = tasks.value.map(row => (
          row.id === nextParent.id ? nextParent : row
        ))
      }
      return
    }
  }
  upsertCachedTask(props.orgSlug, props.workspaceId, archived)
  if (tasks.value === null) {
    return
  }
  if (tasks.value.some(t => t.id === archived.id)) {
    tasks.value = tasks.value.map(row => (
      row.id === archived.id ? archived : row
    ))
    return
  }
  tasks.value = [archived, ...tasks.value]
}

function removeTaskFromRealtime (taskId: number) {
  removeCachedTask(props.orgSlug, props.workspaceId, taskId)
  if (tasks.value === null) {
    return
  }
  tasks.value = tasks.value.filter(t => t.id !== taskId)
  if (childrenPopoverTaskId.value === taskId) {
    closeChildrenPopover()
  }
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      void load()
      return
    }
    clearContentFadeInTimer()
    contentShouldFadeIn.value = false
    error.value = null
    restoreConfirmTask.value = null
    deleteConfirmTask.value = null
    closeChildrenPopover()
  },
)

onBeforeUnmount(() => {
  clearContentFadeInTimer()
})

defineExpose({
  addTaskFromRealtime,
  removeTaskFromRealtime,
})
</script>
<style lang="scss" scoped src="~/assets/styles/components/modals/archived/archived-list-popover.scss"></style>
