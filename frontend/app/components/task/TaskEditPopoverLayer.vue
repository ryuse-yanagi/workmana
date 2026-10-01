<template>
  <Teleport to="body">
    <Transition name="popover-fade" @after-enter="onPopoverAfterEnter" @after-leave="notifyPopoverAfterLeave">
      <div
        v-if="activePopover"
        class="popover-layer popover-layer--portal popover-layer--table"
      >
        <TaskDatePickerPopover
          v-if="activePopover === 'period'"
          ref="popoverElRef"
          :style="popoverStyle"
          title="期間"
          :disabled="disabled"
          :can-clear="canClearCalendarDate"
          :error="popoverError"
          :weekday-labels="weekdayLabels"
          :calendar-month-label="calendarMonthLabel"
          :calendar-cells="calendarCells"
          :range-start-iso="periodRangeStartIso"
          :range-end-iso="periodRangeEndIso"
          @close="closePopover"
          @shift-month="shiftCalendarMonth"
          @pick="pickCalendarDay"
          @pick-range="pickCalendarRange"
          @clear="void clearCalendarDate()"
        />
        <TaskEffortPickerPopover
          v-else-if="activePopover === 'effort'"
          ref="popoverElRef"
          :style="popoverStyle"
          :disabled="disabled"
          :can-clear="canClearEffort"
          :error="popoverError"
          :draft="String(effortDraft ?? '')"
          :unit-label="EFFORT_UNIT_LABEL"
          @close="void finalizeEffortPopover()"
          @update:draft="updateEffortDraft"
          @finalize="void finalizeEffortPopover()"
          @clear="void clearEffort()"
        />
        <TaskProgressRatePickerPopover
          v-else-if="activePopover === 'progress-rate'"
          ref="popoverElRef"
          :style="popoverStyle"
          :disabled="disabled"
          :can-clear="canClearProgressRate"
          :error="popoverError"
          :draft="String(progressRateDraft ?? '')"
          :unit-label="PROGRESS_RATE_UNIT_LABEL"
          @close="void finalizeProgressRatePopover()"
          @update:draft="updateProgressRateDraft"
          @finalize="void finalizeProgressRatePopover()"
          @clear="void clearProgressRate()"
        />
        <TaskMemberDetailPopover
          v-else-if="activePopover === 'member-detail' && selectedMember"
          ref="popoverElRef"
          :style="popoverStyle"
          :disabled="disabled"
          :error="popoverError"
          :display-name="memberDisplayName(selectedMember)"
          :email-line="memberEmailLine(selectedMember)"
          :initial="memberInitial(selectedMember)"
          :avatar-src="memberAvatarSrc(selectedMember)"
          :show-remove="allowMemberRemove"
          @close="closePopover"
          @remove="removeMember(selectedMember)"
        />
        <WorkspaceMemberPickerPopover
          v-else-if="activePopover === 'members'"
          ref="popoverElRef"
          :style="popoverStyle"
          title="担当者"
          assigned-section-heading="担当者"
          unassigned-section-heading="メンバー"
          v-model:search-query="memberSearchQuery"
          :assignees="taskRef?.assignees ?? []"
          :org-members="workspaceMembers"
          :disabled="disabled"
          :can-clear="canClearAssignees"
          :error="popoverError"
          empty-members-message="スペースメンバーがいません"
          @close="closePopover"
          @toggle-member="toggleMember"
          @clear="void clearAssignees()"
        />
        <TaskLabelsPickerPopover
          v-else-if="activePopover === 'labels'"
          ref="popoverElRef"
          :style="popoverStyle"
          :disabled="disabled"
          :can-clear="canClearLabels"
          :error="popoverError"
          v-model:search-query="labelSearchQuery"
          :categories="filteredLabelCategories"
          :selected-ids="(taskRef?.labels ?? []).map(label => label.id)"
          :has-source-labels="orgLabels.length > 0"
          @close="closePopover"
          @toggle="toggleLabel"
          @clear="void clearLabels()"
        />
        <TaskListPickerPopover
          v-else-if="activePopover === 'list'"
          ref="popoverElRef"
          :style="popoverStyle"
          :disabled="listSaving"
          :error="popoverError"
          :lists="workspaceLists"
          :selected-id="taskRef?.list_id ?? null"
          variant="bar"
          :bar-style="listPickerBarStyle"
          @close="closePopover"
          @select="selectList"
        />
        <TaskDescriptionPickerPopover
          v-else-if="activePopover === 'description'"
          ref="popoverElRef"
          :style="popoverStyle"
          :disabled="disabled"
          :saving="descriptionSaving"
          :can-clear="canClearDescription"
          :error="popoverError"
          :readonly="readonlyDescription"
          :draft="descriptionDraft"
          :text="descriptionDisplayText"
          :max-length="TASK_DESCRIPTION_MAX_LENGTH"
          @close="closePopover"
          @update:draft="descriptionDraft = $event"
          @blur-save="void saveDescription()"
          @clear="void clearDescription()"
        />
      </div>
    </Transition>
  </Teleport>
</template>
<script setup lang="ts">
import {
  useTaskPopoverEditor,
  type PopoverType,
  type WorkspaceListOption,
  type TaskPopoverEditable,
} from '../../composables/task/useTaskPopoverEditor'
import { listBarSurfaceStyle, type TaskFormLabel, type TaskFormMember } from '../../composables/task/useTaskFormHelpers'
import type { TaskPopoverListOption } from '../../utils/task/taskPopoverTypes'
import { TASK_DESCRIPTION_MAX_LENGTH } from '../../constants/fieldLengthLimits'
import { memberDisplayName, memberInitial } from '../../composables/member/useMemberDisplay'
import { resolveDisplayAvatarUrl } from '../../composables/auth/userProfileUpdated'
import { resolveAvatarUrl } from '../../utils/member/resolveAvatarUrl'
import { schedulePopoverInputFocus } from '../../utils/ui/schedulePopoverInputFocus'
import { resolvePopoverExposedInput } from '../../utils/ui/popoverComponentRef'
import WorkspaceMemberPickerPopover from '../workspace/WorkspaceMemberPickerPopover.vue'
import TaskDatePickerPopover from './popover/TaskDatePickerPopover.vue'
import TaskDescriptionPickerPopover from './popover/TaskDescriptionPickerPopover.vue'
import TaskEffortPickerPopover from './popover/TaskEffortPickerPopover.vue'
import TaskProgressRatePickerPopover from './popover/TaskProgressRatePickerPopover.vue'
import TaskLabelsPickerPopover from './popover/TaskLabelsPickerPopover.vue'
import TaskListPickerPopover from './popover/TaskListPickerPopover.vue'
import TaskMemberDetailPopover from './popover/TaskMemberDetailPopover.vue'
import type { LabelCategoryGroup } from '../../composables/label/useLabelCategories'
const props = withDefaults(defineProps<{
  orgSlug: string
  workspaceId: string
  orgLabels: TaskFormLabel[]
  labelCategories?: LabelCategoryGroup[]
  workspaceMembers: TaskFormMember[]
  workspaceLists: WorkspaceListOption[]
  disabled?: boolean
  allowMemberRemove?: boolean
  /** 説明ポップオーバーを閲覧専用（全文表示のみ）にする */
  readonlyDescription?: boolean
}>(), {
  disabled: false,
  allowMemberRemove: true,
  readonlyDescription: false,
  labelCategories: () => [],
})
const emit = defineEmits<{
  updated: [TaskPopoverEditable]
  'popover-active-change': [{
    taskId: number | null
    popover: PopoverType | null
    memberId: number | null
  }]
}>()
const config = useRuntimeConfig()
function memberAvatarSrc (member: { id: number; avatar_url?: string | null }): string | null {
  return resolveAvatarUrl(
    resolveDisplayAvatarUrl(member),
    String(config.public.apiBaseUrl || '/api'),
  )
}
function listPickerBarStyle (list: TaskPopoverListOption) {
  return listBarSurfaceStyle(list.color ?? '')
}
const taskRef = ref<TaskPopoverEditable | null>(null)
const memberSearchQuery = ref('')
const {
  EFFORT_UNIT_LABEL,
  PROGRESS_RATE_UNIT_LABEL,
  activePopover,
  selectedMember,
  popoverError,
  popoverStyle,
  popoverElRef,
  labelSearchQuery,
  effortDraft,
  progressRateDraft,
  descriptionDraft,
  descriptionSaving,
  weekdayLabels,
  filteredLabelCategories,
  periodRangeStartIso,
  periodRangeEndIso,
  calendarMonthLabel,
  calendarCells,
  memberEmailLine,
  dateSaving,
  effortSaving,
  progressRateSaving,
  canClearCalendarDate,
  canClearEffort,
  canClearProgressRate,
  canClearAssignees,
  canClearLabels,
  canClearDescription,
  openDatePicker,
  shiftCalendarMonth,
  pickCalendarDay,
  pickCalendarRange,
  clearCalendarDate,
  clearEffort,
  clearProgressRate,
  clearAssignees,
  clearLabels,
  clearDescription,
  openEffortPicker,
  updateEffortDraft,
  finalizeEffortPopover,
  openProgressRatePicker,
  updateProgressRateDraft,
  finalizeProgressRatePopover,
  closePopover,
  dismissPopover,
  notifyPopoverAfterLeave,
  openMemberPicker,
  openMemberDetail,
  openLabelPicker,
  openDescriptionPicker: openDescriptionPickerBase,
  openListPicker,
  listSaving,
  selectList,
  toggleMember,
  removeMember,
  toggleLabel,
  saveDescription,
  updatePopoverPosition,
} = useTaskPopoverEditor({
  orgSlug: props.orgSlug,
  workspaceId: props.workspaceId,
  orgLabels: toRef(props, 'orgLabels'),
  labelCategories: toRef(props, 'labelCategories'),
  workspaceMembers: toRef(props, 'workspaceMembers'),
  workspaceLists: toRef(props, 'workspaceLists'),
  task: taskRef,
  disabled: computed(() => props.disabled),
  readonlyDescription: computed(() => props.readonlyDescription),
  onUpdated: (task) => emit('updated', task),
  zIndex: 130,
})
async function bindTask (task: TaskPopoverEditable | null) {
  if (taskRef.value && taskRef.value.id !== task?.id) {
    await closePopover()
  }
  taskRef.value = task
}
const descriptionDisplayText = computed(() => (
  props.readonlyDescription
    ? (taskRef.value?.description ?? '')
    : descriptionDraft.value
))
function openDescriptionPicker (event?: Event) {
  openDescriptionPickerBase(event)
}
function onPopoverAfterEnter () {
  updatePopoverPosition()
  const popover = activePopover.value
  if (!popover) {
    return
  }
  if (popover === 'effort') {
    schedulePopoverInputFocus(
      () => {
        const el = resolvePopoverExposedInput(popoverElRef.value)
        return el instanceof HTMLInputElement ? el : null
      },
      { select: 'all' },
    )
    return
  }
  if (popover === 'progress-rate') {
    schedulePopoverInputFocus(
      () => {
        const el = resolvePopoverExposedInput(popoverElRef.value)
        return el instanceof HTMLInputElement ? el : null
      },
      { select: 'all' },
    )
    return
  }
  if (popover === 'description' && !props.readonlyDescription) {
    schedulePopoverInputFocus(
      () => {
        const el = resolvePopoverExposedInput(popoverElRef.value)
        return el instanceof HTMLTextAreaElement ? el : null
      },
      { select: 'end' },
    )
    return
  }
  if (popover === 'labels' || popover === 'members') {
    schedulePopoverInputFocus(() => resolvePopoverExposedInput(popoverElRef.value))
  }
}
watch(
  [activePopover, () => taskRef.value?.id ?? null, () => selectedMember.value?.id ?? null],
  ([popover, taskId, memberId]) => {
    emit('popover-active-change', {
      taskId,
      popover,
      memberId: popover === 'member-detail' ? memberId : null,
    })
  },
  { flush: 'sync' },
)
watch(memberSearchQuery, () => {
  if (activePopover.value === 'members') {
    updatePopoverPosition()
  }
})
defineExpose({
  bindTask,
  openDatePicker,
  openEffortPicker,
  openProgressRatePicker,
  openMemberPicker,
  openMemberDetail,
  openLabelPicker,
  openDescriptionPicker,
  openListPicker,
  closePopover,
  dismissPopover,
  activePopover,
  selectedMember,
})
</script>
<style lang="scss" scoped src="~/assets/styles/components/task/TaskEditPopoverLayer.scss"></style>
