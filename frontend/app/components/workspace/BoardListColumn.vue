<template>
  <article
    :data-list-key="list.key"
    :class="[
      'list-column',
      {
        'list-column--fade-in': fadeIn,
        'list-column--empty': empty,
        'list-column--drag-source': dragSource,
        'list-column--tail-target': tailTarget,
      },
    ]"
  >
    <header
      class="list-header"
      :class="{ 'list-header--editing': isEditingTitle }"
      :style="listBarSurfaceStyle(list.color)"
    >
      <div
        class="list-title-field"
        :class="{ 'list-title-field--editing': isEditingTitle }"
      >
        <h2
          class="list-title-text list-title-clickable"
          :class="{ 'list-title-text--measure': isEditingTitle }"
          role="button"
          :tabindex="isEditingTitle ? -1 : 0"
          @click="emit('title-click')"
          @keydown.enter.prevent="emit('title-edit-start')"
          @keydown.space.prevent="emit('title-edit-start')"
        >
          {{ isEditingTitle ? (titleDraft || '\u00a0') : list.title }}
        </h2>
        <textarea
          v-if="isEditingTitle"
          ref="listTitleInputEl"
          :value="titleDraft"
          :maxlength="LIST_NAME_MAX_LENGTH"
          class="list-title-input"
          rows="1"
          :disabled="listRenamePending"
          @input="onTitleDraftInput"
          @blur="emit('title-confirm')"
          @keydown.enter.prevent="emit('title-confirm')"
          @keydown.escape.prevent="emit('title-cancel')"
        />
      </div>
      <div class="list-header-right no-list-drag">
        <span class="list-count">{{ visibleCount }}</span>
        <div class="list-header-menu-host">
          <button
            type="button"
            class="subheader-menu-btn list-header-menu-trigger"
            data-popover-trigger
            aria-label="リストメニュー"
            :aria-expanded="listMenuOpen"
            @click.stop="emit('toggle-menu', $event)"
          >
            <Ellipsis :size="18" :stroke-width="2.25" aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
    <draggable
      :list="tasks"
      item-key="id"
      :class="[
        'list-drop-zone',
        {
          'list-drop-zone--scrollable': scrollableDropZone,
          'list-drop-zone--empty': empty,
        },
      ]"
      group="board-cards"
      draggable=".task-card"
      ghost-class="drag-ghost"
      chosen-class="drag-chosen"
      drag-class="drag-active"
      fallback-class="sortable-fallback"
      filter=".no-drag, a, input, textarea, select, button, .card-menu-wrap"
      :prevent-on-filter="true"
      direction="vertical"
      :force-fallback="true"
      :fallback-on-body="true"
      :fallback-tolerance="3"
      :animation="150"
      :easing="'cubic-bezier(0.25, 0.1, 0.25, 1)'"
      :swap-threshold="0.65"
      :empty-insert-threshold="80"
      :move="onBoardDragMove"
      @scroll.passive="emit('drop-zone-scroll')"
      @choose="onBoardDragChoose"
      @start="onBoardDragStart"
      @end="onBoardDragEnd"
    >
      <template #item="{ element: task }">
        <article
          v-show="isTaskVisible(task.id)"
          :data-task-id="task.id"
          :class="[
            'task-card',
            {
              'task-card--fade-in': isTaskJustCreated(task.id),
              'task-card--parent': task.is_parent_task,
            },
          ]"
          :role="editingTaskId === task.id ? undefined : 'button'"
          :tabindex="editingTaskId === task.id ? undefined : 0"
          @click="emit('open-task', task)"
          @keydown.enter.prevent="emit('open-task', task)"
          @keydown.space.prevent="emit('open-task', task)"
          @contextmenu.prevent="emit('task-contextmenu', task, $event)"
        >
          <template v-if="editingTaskId === task.id">
            <form class="card-edit-form" novalidate @submit.prevent="emit('save-task-title', task)" @click.stop>
              <textarea
                ref="cardTitleTextareaEl"
                :value="taskTitleDraft"
                :maxlength="TASK_TITLE_MAX_LENGTH"
                class="card-title-input"
                rows="1"
                :disabled="taskRenamePending"
                @input="onTaskTitleDraftInput"
                @keydown.escape.prevent="emit('cancel-task-edit')"
                @keydown.enter.prevent="emit('save-task-title', task)"
              />
              <div class="edit-actions">
                <button type="submit" class="ghost-btn small" :disabled="taskRenamePending || !taskTitleDraft">
                  保存
                </button>
                <button type="button" class="ghost-btn small" :disabled="taskRenamePending" @click="emit('cancel-task-edit')">
                  キャンセル
                </button>
              </div>
            </form>
          </template>
          <template v-else>
            <CardMenuTrigger
              wrap-class="no-drag"
              :open="openCardMenuTaskId === task.id"
              aria-label="カードのメニュー"
              @click="emit('toggle-card-menu', task.id, $event)"
            />
            <div class="task-card-body">
              <TaskCardLabelList
                v-if="task.labels?.length"
                :labels="task.labels"
              />
              <p
                v-if="parentTaskTitle(task)"
                class="task-parent-title"
              >
                {{ parentTaskTitle(task) }}
              </p>
              <p class="task-title-row">
                <span class="task-title">{{ task.title }}</span>
              </p>
              <div
                v-if="hasTaskCardScheduleMeta(task)"
                class="task-card-meta"
              >
                <p
                  v-if="taskCardDateRange(task)"
                  class="task-card-meta__row"
                >
                  <CalendarDays :size="12" :stroke-width="2.25" aria-hidden="true" />
                  <span>{{ taskCardDateRange(task) }}</span>
                </p>
                <p
                  v-if="taskCardEffortText(task)"
                  class="task-card-meta__row"
                >
                  <Clock :size="12" :stroke-width="2.25" aria-hidden="true" />
                  <span>{{ taskCardEffortText(task) }}</span>
                </p>
                <p
                  v-if="taskCardProgressRateText(task)"
                  class="task-card-meta__row"
                >
                  <ChartNoAxesColumnIncreasing :size="12" :stroke-width="2.25" aria-hidden="true" />
                  <span>{{ taskCardProgressRateText(task) }}</span>
                </p>
              </div>
              <div v-if="cardAssignees(task).length" class="task-card-footer">
                <div class="task-card-members" aria-label="担当者">
                  <MemberAvatar
                    v-for="member in cardAssignees(task)"
                    :key="member.id"
                    :member="member"
                    size="xs"
                    :title="memberDisplayName(member)"
                  />
                </div>
              </div>
            </div>
          </template>
        </article>
      </template>
      <template #footer>
        <div
          v-if="showTailPreview"
          class="drag-ghost drag-ghost--tail-preview no-drag"
          aria-hidden="true"
        />
      </template>
    </draggable>
    <div class="composer">
      <button
        type="button"
        class="composer-add-btn"
        title="タスク追加（N）"
        @mousedown.prevent
        @click="emit('add-task', list.listId)"
      >
        <FilePlus :size="18" :stroke-width="2.25" aria-hidden="true" />
        タスク追加
      </button>
    </div>
  </article>
</template>
<script setup lang="ts">
import { CalendarDays, ChartNoAxesColumnIncreasing, Clock, Ellipsis, FilePlus } from 'lucide-vue-next'
import draggable from 'vuedraggable'
import CardMenuTrigger from '../ui/CardMenuTrigger.vue'
import TaskCardLabelList from '../task/TaskCardLabelList.vue'
import MemberAvatar from '../ui/MemberAvatar.vue'
import { LIST_NAME_MAX_LENGTH, TASK_TITLE_MAX_LENGTH } from '../../constants/fieldLengthLimits'
import { memberDisplayName } from '../../composables/useMemberDisplay'
import { listBarSurfaceStyle } from '../../composables/useTaskFormHelpers'
import {
  formatTaskCardDateRange,
  formatTaskCardEffort,
  formatTaskCardProgressRate,
  hasTaskCardScheduleMeta,
  resolveParentTaskTitle,
  type TaskCardParentLookup,
} from '../../composables/useTaskCardMeta'
import type { WorkspaceBoardTask } from '../../composables/useWorkspaceBoardPageData'

export type BoardListColumnDef = {
  key: string
  title: string
  listId: number
  color: string
  color_index: number
}

const props = defineProps<{
  list: BoardListColumnDef
  tasks: WorkspaceBoardTask[]
  fadeIn: boolean
  empty: boolean
  dragSource: boolean
  tailTarget: boolean
  isEditingTitle: boolean
  titleDraft: string
  listRenamePending: boolean
  listMenuOpen: boolean
  visibleCount: number
  scrollableDropZone: boolean
  showTailPreview: boolean
  editingTaskId: number | null
  taskTitleDraft: string
  taskRenamePending: boolean
  openCardMenuTaskId: number | null
  parentTasks: TaskCardParentLookup[]
  isTaskVisible: (taskId: number) => boolean
  isTaskJustCreated: (taskId: number) => boolean
  onBoardDragMove: (
    evt: { to: HTMLElement, from: HTMLElement },
    originalEvent?: Event,
  ) => boolean
  onBoardDragChoose: (evt: { item: HTMLElement }) => void
  onBoardDragStart: (evt: { item: HTMLElement, originalEvent?: Event }) => void
  onBoardDragEnd: (evt?: { originalEvent?: Event }) => void
}>()

const emit = defineEmits<{
  'update:titleDraft': [value: string]
  'update:taskTitleDraft': [value: string]
  'title-click': []
  'title-edit-start': []
  'title-confirm': []
  'title-cancel': []
  'toggle-menu': [event: MouseEvent]
  'drop-zone-scroll': []
  'open-task': [task: WorkspaceBoardTask]
  'task-contextmenu': [task: WorkspaceBoardTask, event: MouseEvent]
  'save-task-title': [task: WorkspaceBoardTask]
  'cancel-task-edit': []
  'toggle-card-menu': [taskId: number, event: MouseEvent]
  'add-task': [listId: number]
}>()

const listTitleInputEl = ref<HTMLTextAreaElement | null>(null)
const cardTitleTextareaEl = ref<HTMLTextAreaElement | null>(null)

watch(() => props.isEditingTitle, async (editing) => {
  if (!editing) {
    return
  }
  await nextTick()
  listTitleInputEl.value?.focus()
  listTitleInputEl.value?.select()
})

watch(() => props.editingTaskId, async (taskId) => {
  if (taskId == null || !props.tasks.some(task => task.id === taskId)) {
    return
  }
  await nextTick()
  adjustTextareaHeight(cardTitleTextareaEl.value)
})

function stripManualLineBreaks (value: string) {
  return value.replace(/\r?\n/g, '')
}

function adjustTextareaHeight (el: HTMLTextAreaElement | null | undefined) {
  if (!el) {
    return
  }
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

function onTitleDraftInput (event: Event) {
  const target = event.target
  if (!(target instanceof HTMLTextAreaElement)) {
    return
  }
  emit('update:titleDraft', stripManualLineBreaks(target.value))
}

function onTaskTitleDraftInput (event: Event) {
  const target = event.target
  if (!(target instanceof HTMLTextAreaElement)) {
    return
  }
  const cleaned = stripManualLineBreaks(target.value)
  emit('update:taskTitleDraft', cleaned)
  nextTick(() => adjustTextareaHeight(cardTitleTextareaEl.value))
}

function parentTaskTitle (task: WorkspaceBoardTask): string | null {
  return resolveParentTaskTitle(task, props.parentTasks)
}

function cardAssignees (task: WorkspaceBoardTask) {
  return (task.assignees ?? []).slice(0, 3)
}

function taskCardDateRange (task: WorkspaceBoardTask): string | null {
  return formatTaskCardDateRange(task.start_date, task.due_date)
}

function taskCardEffortText (task: WorkspaceBoardTask): string | null {
  return formatTaskCardEffort(task)
}

function taskCardProgressRateText (task: WorkspaceBoardTask): string | null {
  return formatTaskCardProgressRate(task)
}
</script>
