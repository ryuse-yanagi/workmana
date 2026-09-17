<template>
  <tr
    class="workspace-wbs__task-row"
    :class="{
      'workspace-wbs__task-row--parent': row.kind === 'parent',
      'workspace-wbs__task-row--child': row.kind === 'child' || row.kind === 'task',
      'workspace-wbs__task-row--last-child': lastChild,
      'workspace-wbs__task-row--drag-preview': dragPreview,
    }"
    :data-wbs-row-index="rowIndex"
    :data-wbs-task-id="row.task.id"
  >
    <td class="workspace-wbs__code-cell workspace-wbs__desc-cell">
      <span class="workspace-wbs__code">{{ row.wbsCode }}</span>
    </td>
    <td
      v-if="isColumnVisible('title')"
      class="workspace-wbs__task-title workspace-wbs__desc-cell"
      :class="{
        'workspace-wbs__desc-cell--edge': isLastVisibleColumn('title'),
        'workspace-wbs__desc-cell--first': isFirstVisibleColumn('title'),
      }"
    >
      <div
        class="workspace-wbs__title-cell"
        :class="{
          'workspace-wbs__title-cell--child': row.kind === 'child',
          'workspace-wbs__title-cell--editable': editMode && editingTitleTaskId !== row.task.id,
        }"
        :tabindex="editMode && editingTitleTaskId !== row.task.id ? 0 : undefined"
        @click="emit('title-activate', row.task, $event)"
        @mousedown="emit('title-mousedown', row.task, $event)"
        @keydown.enter.prevent="emit('title-activate', row.task)"
      >
        <button
          v-if="row.kind === 'parent' && !editMode"
          type="button"
          class="workspace-wbs__toggle"
          :aria-expanded="!parentCollapsed"
          :aria-label="parentCollapsed ? '子タスクを展開' : '子タスクを折りたたむ'"
          @click.stop="emit('toggle-collapse', row.task.id)"
        >
          <ChevronDown
            v-if="!parentCollapsed"
            :size="16"
            :stroke-width="2.25"
            aria-hidden="true"
          />
          <ChevronRight
            v-else
            :size="16"
            :stroke-width="2.25"
            aria-hidden="true"
          />
        </button>
        <button
          v-else-if="editMode"
          type="button"
          class="workspace-wbs__drag-handle"
          aria-label="ドラッグしてタスクの並び順を変更"
          @pointerdown="emit('drag-handle-pointerdown', row.task.id, $event)"
          @click.prevent="emit('drag-handle-click')"
        >
          <Equal
            :size="16"
            :stroke-width="2.25"
            aria-hidden="true"
          />
        </button>
        <span
          v-else-if="row.kind === 'task'"
          class="workspace-wbs__leading-spacer"
          aria-hidden="true"
        />
        <div class="workspace-wbs__title-field">
          <input
            v-if="editingTitleTaskId !== row.task.id"
            type="text"
            class="workspace-wbs__title-text"
            :value="row.task.title"
            :title="row.task.title"
            readonly
            tabindex="-1"
          />
          <input
            v-else
            :ref="(el) => emit('title-input-ref', row.task.id, el)"
            :value="titleDraft"
            type="text"
            class="workspace-wbs__title-input"
            :data-task-id="row.task.id"
            :maxlength="TASK_TITLE_MAX_LENGTH"
            :disabled="titleSaving"
            @pointerdown.stop
            @click.stop
            @input="onTitleDraftInput"
            @blur="emit('title-confirm', row.task)"
            @keydown.enter.prevent="emit('title-confirm', row.task)"
          />
        </div>
        <div
          class="workspace-wbs__task-menu"
          :class="{ 'workspace-wbs__task-menu--open': menuOpen }"
          data-no-drag-scroll
          @pointerdown.stop
          @mousedown.stop
          @click.stop
        >
          <button
            type="button"
            class="subheader-menu-btn"
            data-popover-trigger
            :aria-expanded="menuOpen"
            aria-label="タスクのメニュー"
            @click="emit('toggle-menu', row.task, $event)"
          >
            <Ellipsis
              :size="20"
              :stroke-width="2.25"
              aria-hidden="true"
            />
          </button>
        </div>
      </div>
    </td>
    <td
      v-if="isColumnVisible('assignees')"
      class="workspace-wbs__desc-cell"
      :class="{
        'workspace-wbs__desc-cell--edge': isLastVisibleColumn('assignees'),
        'workspace-wbs__desc-cell--first': isFirstVisibleColumn('assignees'),
      }"
    >
      <div
        class="workspace-wbs__members-cell"
        :class="{
          'workspace-wbs__members-cell--edit': editMode,
          'workspace-wbs__members-cell--popover-open': assigneePickerActive,
        }"
        @click="emit('members-click', row.task, $event)"
      >
        <template v-if="row.task.assignees?.length">
          <button
            v-for="member in row.task.assignees"
            :key="member.id"
            type="button"
            class="workspace-wbs__avatar-btn workspace-wbs__avatar-pill"
            :class="{
              'workspace-wbs__avatar-btn--active': isAssigneeDetailActive(row.task.id, member.id),
            }"
            :aria-label="`${memberDisplayName(member)}の詳細`"
            @click.stop="emit('member-detail', row.task, member, $event)"
          >
            <MemberAvatar
              :member="member"
              size="xs"
              decorative
            />
          </button>
        </template>
        <span
          v-else
          class="workspace-wbs__placeholder"
        />
      </div>
    </td>
    <td
      v-if="isColumnVisible('labels')"
      class="workspace-wbs__desc-cell"
      :class="{
        'workspace-wbs__desc-cell--edge': isLastVisibleColumn('labels'),
        'workspace-wbs__desc-cell--first': isFirstVisibleColumn('labels'),
      }"
    >
      <div
        v-if="row.task.labels?.length && !editMode"
        class="workspace-wbs__labels-wrap"
      >
        <div class="workspace-wbs__labels workspace-wbs__labels--readonly">
          <LabelStrip
            v-for="label in row.task.labels"
            :key="label.id"
            :label="label"
            size="sm"
          />
        </div>
      </div>
      <button
        v-else-if="editMode"
        type="button"
        class="workspace-wbs__cell-btn"
        :class="{
          'workspace-wbs__cell-btn--popover-open': isPopoverCellActive(row.task.id, 'labels'),
        }"
        aria-label="ラベル"
        @click="emit('open-labels', row.task, $event)"
      >
        <div class="workspace-wbs__labels">
          <LabelStrip
            v-for="label in row.task.labels ?? []"
            :key="label.id"
            :label="label"
            size="sm"
          />
        </div>
      </button>
      <span v-else class="workspace-wbs__placeholder" />
    </td>
    <td
      v-if="isColumnVisible('list')"
      class="workspace-wbs__desc-cell"
      :class="{
        'workspace-wbs__desc-cell--edge': isLastVisibleColumn('list'),
        'workspace-wbs__desc-cell--first': isFirstVisibleColumn('list'),
      }"
    >
      <button
        type="button"
        class="workspace-wbs__cell-btn workspace-wbs__cell-btn--text"
        :class="{
          'workspace-wbs__cell-btn--popover-open': isPopoverCellActive(row.task.id, 'list'),
          'workspace-wbs__cell-btn--readonly': !editMode,
        }"
        :tabindex="editMode ? undefined : -1"
        @click="emit('open-list', row.task, $event)"
      >
        <span
          v-if="row.task.list_name"
          class="workspace-wbs__ellipsis workspace-wbs__list-name"
          :title="row.task.list_name"
          :style="listNameStyle(row.task.list_id)"
        >{{ row.task.list_name }}</span>
        <span v-else class="workspace-wbs__placeholder" />
      </button>
    </td>
    <td
      v-if="isColumnVisible('period')"
      class="workspace-wbs__desc-cell"
      :class="{
        'workspace-wbs__desc-cell--edge': isLastVisibleColumn('period'),
        'workspace-wbs__desc-cell--first': isFirstVisibleColumn('period'),
      }"
    >
      <button
        type="button"
        class="workspace-wbs__cell-btn workspace-wbs__cell-btn--text"
        :class="{
          'workspace-wbs__cell-btn--popover-open': isPopoverCellActive(row.task.id, 'period'),
          'workspace-wbs__cell-btn--readonly': !editMode,
        }"
        :tabindex="editMode ? undefined : -1"
        @click="emit('open-period', row.task, $event)"
      >
        <span v-if="formatWbsPeriod(row.task.start_date, row.task.due_date)">{{ formatWbsPeriod(row.task.start_date, row.task.due_date) }}</span>
        <span v-else class="workspace-wbs__placeholder" />
      </button>
    </td>
    <td
      v-if="isColumnVisible('effort')"
      class="workspace-wbs__desc-cell"
      :class="{
        'workspace-wbs__desc-cell--edge': isLastVisibleColumn('effort'),
        'workspace-wbs__desc-cell--first': isFirstVisibleColumn('effort'),
      }"
    >
      <button
        type="button"
        class="workspace-wbs__cell-btn workspace-wbs__cell-btn--text"
        :class="{
          'workspace-wbs__cell-btn--popover-open': isPopoverCellActive(row.task.id, 'effort'),
          'workspace-wbs__cell-btn--readonly': !editMode,
        }"
        :tabindex="editMode ? undefined : -1"
        @click="emit('open-effort', row.task, $event)"
      >
        <span v-if="formatWbsEffort(row.task)">{{ formatWbsEffort(row.task) }}</span>
        <span v-else class="workspace-wbs__placeholder" />
      </button>
    </td>
    <td
      v-if="isColumnVisible('progressRate')"
      class="workspace-wbs__desc-cell"
      :class="{
        'workspace-wbs__desc-cell--edge': isLastVisibleColumn('progressRate'),
        'workspace-wbs__desc-cell--first': isFirstVisibleColumn('progressRate'),
      }"
    >
      <button
        type="button"
        class="workspace-wbs__cell-btn workspace-wbs__cell-btn--text"
        :class="{
          'workspace-wbs__cell-btn--popover-open': isPopoverCellActive(row.task.id, 'progressRate'),
          'workspace-wbs__cell-btn--readonly': !editMode,
        }"
        :tabindex="editMode ? undefined : -1"
        @click="emit('open-progress-rate', row.task, $event)"
      >
        <span v-if="formatWbsProgressRate(row.task)">{{ formatWbsProgressRate(row.task) }}</span>
        <span v-else class="workspace-wbs__placeholder" />
      </button>
    </td>
    <td
      v-if="isColumnVisible('notes')"
      class="workspace-wbs__desc-cell"
      :class="{
        'workspace-wbs__desc-cell--edge': isLastVisibleColumn('notes'),
        'workspace-wbs__desc-cell--first': isFirstVisibleColumn('notes'),
      }"
    >
      <button
        type="button"
        class="workspace-wbs__cell-btn workspace-wbs__cell-btn--text workspace-wbs__cell-btn--notes"
        :class="{
          'workspace-wbs__cell-btn--popover-open': isPopoverCellActive(row.task.id, 'notes'),
          'workspace-wbs__cell-btn--readonly': !editMode,
          'workspace-wbs__cell-btn--notes-has-content': !editMode && Boolean(row.task.description?.trim()),
        }"
        :aria-disabled="!editMode && !row.task.description?.trim()"
        @click="emit('open-notes', row.task, $event)"
      >
        <span
          v-if="formatWbsDescription(row.task.description)"
          class="workspace-wbs__notes workspace-wbs__ellipsis"
          :title="formatWbsDescription(row.task.description)"
        >{{ formatWbsDescription(row.task.description) }}</span>
        <span v-else class="workspace-wbs__placeholder" />
        <span
          v-if="!editMode && row.task.description?.trim()"
          class="workspace-wbs__notes-chevron"
          :class="{ 'workspace-wbs__notes-chevron--open': isPopoverCellActive(row.task.id, 'notes') }"
          aria-hidden="true"
        />
      </button>
    </td>
    <td
      v-for="day in ganttDays"
      :key="`${row.task.id}-${day.iso}`"
      class="workspace-wbs__day-cell"
      :class="{
        'workspace-wbs__day-cell--weekend': day.isWeekend,
        'workspace-wbs__day-cell--today': day.isToday,
        'workspace-wbs__day-cell--filled': shouldShowFilledBar(row.task, day.iso),
        'workspace-wbs__day-cell--bar-start': isBarStartDay(row.task, day.iso),
        'workspace-wbs__day-cell--bar-end': isBarEndDay(row.task, day.iso),
        'workspace-wbs__day-cell--create-preview': isDaySelectionOutlined(row.task, day.iso),
        'workspace-wbs__day-cell--create-preview-start': isSelectionStartDay(row.task, day.iso),
        'workspace-wbs__day-cell--create-preview-end': isSelectionEndDay(row.task, day.iso),
        'workspace-wbs__day-cell--interactive': editMode,
        'workspace-wbs__day-cell--dragging': ganttDragging,
      }"
      :style="dayCellStyle(row.task, day.iso)"
      @pointerdown="emit('day-pointerdown', row.task.id, day.iso, $event)"
      @contextmenu.prevent
    >
      <button
        v-if="editMode && isBarStartDay(row.task, day.iso)"
        type="button"
        class="workspace-wbs__gantt-edge workspace-wbs__gantt-edge--start"
        aria-label="開始日を変更"
        @pointerdown.stop="emit('day-pointerdown', row.task.id, day.iso, $event, 'start-edge')"
      />
      <button
        v-if="editMode && isBarEndDay(row.task, day.iso)"
        type="button"
        class="workspace-wbs__gantt-edge workspace-wbs__gantt-edge--end"
        aria-label="終了日を変更"
        @pointerdown.stop="emit('day-pointerdown', row.task.id, day.iso, $event, 'end-edge')"
      />
    </td>
  </tr>
</template>
<script setup lang="ts">
import { ChevronDown, ChevronRight, Ellipsis, Equal } from 'lucide-vue-next'
import MemberAvatar from '../ui/MemberAvatar.vue'
import { TASK_TITLE_MAX_LENGTH } from '../../constants/fieldLengthLimits'
import { memberDisplayName } from '../../composables/useMemberDisplay'
import type { GanttDay } from '../../composables/useGanttCalendar'
import type { WbsColumnKey } from '../../composables/useWbsColumnResize'
import {
  formatWbsPeriod,
  formatWbsDescription,
  formatWbsEffort,
  formatWbsProgressRate,
  type WbsCodedDisplayRow,
  type WbsTask,
  type WbsTaskMember,
} from '../../composables/useWbsTaskGroups'

type WbsPopoverCellField = 'assignees' | 'labels' | 'list' | 'period' | 'effort' | 'progressRate' | 'notes'
type GanttEdgeMode = 'start-edge' | 'end-edge'

defineProps<{
  row: WbsCodedDisplayRow
  rowIndex: number
  lastChild: boolean
  dragPreview: boolean
  editMode: boolean
  parentCollapsed: boolean
  menuOpen: boolean
  assigneePickerActive: boolean
  editingTitleTaskId: number | null
  titleDraft: string
  titleSaving: boolean
  ganttDays: GanttDay[]
  ganttDragging: boolean
  isColumnVisible: (key: WbsColumnKey) => boolean
  isFirstVisibleColumn: (key: WbsColumnKey) => boolean
  isLastVisibleColumn: (key: WbsColumnKey) => boolean
  isPopoverCellActive: (taskId: number, field: WbsPopoverCellField) => boolean
  isAssigneeDetailActive: (taskId: number, memberId: number) => boolean
  listNameStyle: (listId: number | null | undefined) => { color: string } | undefined
  shouldShowFilledBar: (task: WbsTask, dayIso: string) => boolean
  isBarStartDay: (task: WbsTask, dayIso: string) => boolean
  isBarEndDay: (task: WbsTask, dayIso: string) => boolean
  isDaySelectionOutlined: (task: WbsTask, dayIso: string) => boolean
  isSelectionStartDay: (task: WbsTask, dayIso: string) => boolean
  isSelectionEndDay: (task: WbsTask, dayIso: string) => boolean
  dayCellStyle: (task: WbsTask, dayIso: string) => Record<string, string>
}>()

const emit = defineEmits<{
  'update:titleDraft': [value: string]
  'title-activate': [task: WbsTask, event?: Event]
  'title-mousedown': [task: WbsTask, event: MouseEvent]
  'title-confirm': [task: WbsTask]
  'title-input-ref': [taskId: number, el: unknown]
  'toggle-collapse': [taskId: number]
  'drag-handle-pointerdown': [taskId: number, event: PointerEvent]
  'drag-handle-click': []
  'toggle-menu': [task: WbsTask, event: MouseEvent]
  'members-click': [task: WbsTask, event: MouseEvent]
  'member-detail': [task: WbsTask, member: WbsTaskMember, event: Event]
  'open-labels': [task: WbsTask, event: Event]
  'open-list': [task: WbsTask, event: Event]
  'open-period': [task: WbsTask, event: Event]
  'open-effort': [task: WbsTask, event: Event]
  'open-progress-rate': [task: WbsTask, event: Event]
  'open-notes': [task: WbsTask, event: Event]
  'day-pointerdown': [
    taskId: number,
    dayIso: string,
    event: PointerEvent,
    edge?: GanttEdgeMode,
  ]
}>()

function onTitleDraftInput (event: Event) {
  const target = event.target
  if (!(target instanceof HTMLInputElement)) {
    return
  }
  emit('update:titleDraft', target.value)
}
</script>
