<template>
  <Teleport to="body">
    <Transition name="popover-fade" @after-enter="updatePopoverPosition">
      <div
        v-if="activePopover"
        :key="activePopover === 'member-detail' ? `member-detail-${selectedMember?.id}` : activePopover"
        class="popover-layer popover-layer--portal popover-layer--table"
      >
        <PopoverShell
          v-if="activePopover === 'start-date' || activePopover === 'due-date'"
          ref="popoverElRef"
          shell-class="popover popover--date"
          :style="popoverStyle"
          :title="activePopover === 'start-date' ? '開始日' : '終了日'"
          :aria-label="activePopover === 'start-date' ? '開始日' : '終了日'"
          :close-disabled="disabled"
          @close="closePopover"
        >
          <div class="calendar">
            <div class="calendar-nav">
              <button
                type="button"
                class="calendar-nav-btn"
                :disabled="disabled"
                aria-label="前の月"
                @click="shiftCalendarMonth(-1)"
              >‹</button>
              <span class="calendar-month-label">{{ calendarMonthLabel }}</span>
              <button
                type="button"
                class="calendar-nav-btn"
                :disabled="disabled"
                aria-label="次の月"
                @click="shiftCalendarMonth(1)"
              >›</button>
            </div>
            <div class="calendar-weekdays">
              <span v-for="day in weekdayLabels" :key="day" class="calendar-weekday">{{ day }}</span>
            </div>
            <div class="calendar-grid">
              <button
                v-for="cell in calendarCells"
                :key="cell.key"
                type="button"
                class="calendar-day"
                :class="{
                  'calendar-day--outside': !cell.inMonth,
                  'calendar-day--selected': cell.iso === activeCalendarDate,
                  'calendar-day--today': cell.isToday,
                }"
                @click.stop="pickCalendarDay(cell.iso)"
              >
                {{ cell.day }}
              </button>
            </div>
          </div>
          <div class="popover-field-actions">
            <button
              type="button"
              class="popover-field-clear-btn"
              :disabled="disabled || dateSaving || !canClearCalendarDate"
              @click.stop="void clearCalendarDate()"
            >
              削除
            </button>
          </div>
          <p v-if="popoverError" class="err">{{ popoverError }}</p>
        </PopoverShell>
        <PopoverShell
          v-else-if="activePopover === 'effort'"
          ref="popoverElRef"
          shell-class="popover popover--effort"
          :style="popoverStyle"
          title="工数"
          aria-label="工数"
          :close-disabled="disabled"
          @close="void finalizeEffortPopover()"
        >
          <div class="effort-input-row">
            <input
              ref="effortInputRef"
              :value="effortDraft"
              type="number"
              min="0"
              step="0.01"
              class="effort-input"
              placeholder="工数を入力してください"
              aria-label="工数"
              :disabled="disabled"
              @input="updateEffortDraft(($event.target as HTMLInputElement).value)"
              @keydown.enter.prevent="void finalizeEffortPopover()"
              @keydown.escape.prevent="void finalizeEffortPopover()"
              @click.stop
            />
            <span class="effort-unit-label">{{ effortUnitLabel() }}</span>
          </div>
          <div class="popover-field-actions">
            <button
              type="button"
              class="popover-field-clear-btn"
              :disabled="disabled || effortSaving || !canClearEffort"
              @click.stop="void clearEffort()"
            >
              削除
            </button>
          </div>
          <p v-if="popoverError" class="err">{{ popoverError }}</p>
        </PopoverShell>
        <div
          v-else-if="activePopover === 'member-detail' && selectedMember"
          ref="popoverElRef"
          class="popover popover--member-detail"
          :style="popoverStyle"
          role="dialog"
          :aria-label="`${memberDisplayName(selectedMember)}の詳細`"
          @click.stop
        >
          <div class="member-detail-card">
            <header class="member-detail-header">
              <button
                type="button"
                class="member-detail-close"
                :disabled="disabled"
                aria-label="閉じる"
                @click="closePopover"
              >✕</button>
              <div class="member-detail-profile">
                <img
                  v-if="selectedMember.avatar_url"
                  :src="selectedMember.avatar_url"
                  alt=""
                  class="member-detail-avatar"
                />
                <span v-else class="member-detail-initial">{{ memberInitial(selectedMember) }}</span>
                <div class="member-detail-text">
                  <p class="member-detail-name">{{ memberDisplayName(selectedMember) }}</p>
                  <p class="member-detail-email">{{ memberEmailLine(selectedMember) }}</p>
                </div>
              </div>
            </header>
            <div
              v-if="allowMemberRemove"
              class="member-detail-body"
            >
              <button
                type="button"
                class="member-detail-remove"
                :disabled="disabled"
                @click.stop="removeMember(selectedMember)"
              >
                タスクから削除
              </button>
            </div>
          </div>
          <p v-if="popoverError" class="err member-detail-error">{{ popoverError }}</p>
        </div>
        <WorkspaceMemberPickerPopover
          v-else-if="activePopover === 'members'"
          ref="popoverElRef"
          :style="popoverStyle"
          v-model:search-query="memberSearchQuery"
          :assignees="taskRef?.assignees ?? []"
          :org-members="workspaceMembers"
          :disabled="disabled"
          :error="popoverError"
          empty-members-message="スペースユーザーがいません。"
          @close="closePopover"
          @toggle-member="toggleMember"
        />
        <PopoverShell
          v-else-if="activePopover === 'labels'"
          ref="popoverElRef"
          shell-class="popover popover--labels"
          header-class="popover-header--labels"
          :style="popoverStyle"
          title="ラベル"
          aria-label="ラベル"
          :close-disabled="disabled"
          @close="closePopover"
        >
          <input
            v-model="labelSearchQuery"
            type="search"
            class="label-search-input"
            placeholder="ラベルを検索..."
            :disabled="disabled"
            @click.stop
          />
          <p class="label-section-heading">ラベル</p>
          <div class="popover-scroll">
            <ul class="label-picker-list">
              <li v-for="label in filteredOrgLabels" :key="label.id">
                <button
                  type="button"
                  class="label-picker-row"
                  @click.stop="toggleLabel(label)"
                >
                  <span
                    class="label-picker-checkbox"
                    :class="{ 'label-picker-checkbox--checked': isLabelSelected(label.id) }"
                    aria-hidden="true"
                  >
                    <span v-if="isLabelSelected(label.id)">✓</span>
                  </span>
                  <span
                    class="label-picker-bar"
                    :style="{
                      backgroundColor: label.color,
                      color: labelBarTextColor(label.color),
                    }"
                  >
                    {{ label.name }}
                  </span>
                </button>
              </li>
            </ul>
            <p v-if="!orgLabels.length" class="empty-text label-picker-empty">
              ラベルは設定画面で作成できます。
            </p>
            <p v-else-if="!filteredOrgLabels.length" class="empty-text label-picker-empty">
              該当するラベルがありません。
            </p>
            <p v-if="popoverError" class="err">{{ popoverError }}</p>
          </div>
        </PopoverShell>
        <PopoverShell
          v-else-if="activePopover === 'list'"
          ref="popoverElRef"
          shell-class="popover popover--list"
          :style="popoverStyle"
          title="リストを選択"
          aria-label="リストを選択"
          :close-disabled="listSaving"
          @close="closePopover"
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
                  :class="{ 'list-picker-row--selected': taskRef?.list_id === list.id }"
                  :disabled="listSaving"
                  @click.stop="selectList(list.id)"
                >
                  <span
                    class="list-picker-radio"
                    :class="{ 'list-picker-radio--checked': taskRef?.list_id === list.id }"
                    aria-hidden="true"
                  />
                  <span class="list-picker-label">{{ list.name }}</span>
                </button>
              </li>
            </ul>
            <p v-if="!workspaceLists.length" class="empty-text list-picker-empty">
              リストがありません。
            </p>
            <p v-if="popoverError" class="err">{{ popoverError }}</p>
          </div>
        </PopoverShell>
        <PopoverShell
          v-else-if="activePopover === 'description'"
          ref="popoverElRef"
          :shell-class="[
            'popover',
            'popover--description',
            { 'popover--description-edit': !readonlyDescription },
          ]"
          :style="popoverStyle"
          title="説明"
          aria-label="説明"
          :close-disabled="disabled"
          @close="closePopover"
        >
          <template #header-end>
            <div
              class="description-mode-tabs"
              role="tablist"
              aria-label="説明の表示形式"
            >
              <button
                type="button"
                class="description-mode-tab"
                :class="{ 'description-mode-tab--active': descriptionViewMode === 'preview' }"
                role="tab"
                :aria-selected="descriptionViewMode === 'preview'"
                :disabled="disabled || descriptionSaving"
                @click="setDescriptionViewMode('preview')"
              >
                Preview
              </button>
              <button
                type="button"
                class="description-mode-tab"
                :class="{ 'description-mode-tab--active': descriptionViewMode === 'markdown' }"
                role="tab"
                :aria-selected="descriptionViewMode === 'markdown'"
                :disabled="disabled || descriptionSaving"
                @click="setDescriptionViewMode('markdown')"
              >
                Markdown
              </button>
            </div>
          </template>
          <template v-if="readonlyDescription">
            <div class="description-view popover-scroll">
              <div
                v-if="descriptionViewMode === 'preview' && renderedDescriptionHtml"
                class="description-preview"
                v-html="renderedDescriptionHtml"
              />
              <p
                v-else-if="descriptionViewMode === 'markdown' && descriptionDisplayText"
                class="description-view-text"
              >{{ descriptionDisplayText }}</p>
              <p
                v-else
                class="empty-text description-view-empty"
              >説明はありません。</p>
            </div>
          </template>
          <template v-else>
            <div class="description-body">
              <textarea
                v-if="descriptionViewMode === 'markdown'"
                ref="descriptionInputRef"
                v-model="descriptionDraft"
                class="description-input"
                rows="6"
                :maxlength="TASK_DESCRIPTION_MAX_LENGTH"
                aria-label="説明"
                :disabled="disabled || descriptionSaving"
                spellcheck="false"
                @blur="void saveDescription()"
              />
              <div
                v-else-if="renderedDescriptionHtml"
                class="description-preview description-preview--edit popover-scroll"
                v-html="renderedDescriptionHtml"
              />
              <p
                v-else
                class="empty-text description-view-empty description-view-empty--edit"
              >説明はありません。</p>
              <p v-if="popoverError" class="err">{{ popoverError }}</p>
            </div>
          </template>
        </PopoverShell>
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
} from '../../composables/useTaskPopoverEditor'
import type { TaskFormLabel, TaskFormMember } from '../../composables/useTaskFormHelpers'
import { TASK_DESCRIPTION_MAX_LENGTH } from '../../constants/fieldLengthLimits'
import { memberDisplayName, memberInitial } from '../../composables/useMemberDisplay'
import { renderMarkdownToSafeHtml } from '../../utils/renderMarkdown'
import PopoverShell from '../ui/PopoverShell.vue'
import WorkspaceMemberPickerPopover from '../workspace/WorkspaceMemberPickerPopover.vue'
const props = withDefaults(defineProps<{
  orgSlug: string
  workspaceId: string
  orgLabels: TaskFormLabel[]
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
})
const emit = defineEmits<{
  updated: [TaskPopoverEditable]
  'popover-active-change': [{
    taskId: number | null
    popover: PopoverType | null
    memberId: number | null
  }]
}>()
const taskRef = ref<TaskPopoverEditable | null>(null)
const memberSearchQuery = ref('')
type DescriptionViewMode = 'preview' | 'markdown'
const descriptionViewMode = ref<DescriptionViewMode>('markdown')
function bindTask (task: TaskPopoverEditable | null) {
  if (taskRef.value && taskRef.value.id !== task?.id) {
    dismissPopover()
  }
  taskRef.value = task
}
const {
  effortUnitLabel,
  activePopover,
  selectedMember,
  popoverError,
  popoverStyle,
  popoverElRef,
  labelSearchQuery,
  effortDraft,
  effortInputRef,
  descriptionDraft,
  descriptionInputRef,
  descriptionSaving,
  weekdayLabels,
  filteredOrgLabels,
  activeCalendarDate,
  calendarMonthLabel,
  calendarCells,
  labelBarTextColor,
  memberEmailLine,
  pendingDate,
  dateSaving,
  effortSaving,
  canClearCalendarDate,
  canClearEffort,
  openDatePicker,
  shiftCalendarMonth,
  pickCalendarDay,
  clearCalendarDate,
  openEffortPicker,
  updateEffortDraft,
  finalizeEffortPopover,
  clearEffort,
  closePopover,
  dismissPopover,
  openMemberPicker,
  openMemberDetail,
  openLabelPicker,
  openDescriptionPicker: openDescriptionPickerBase,
  openListPicker,
  listSaving,
  selectList,
  isLabelSelected,
  toggleMember,
  removeMember,
  toggleLabel,
  saveDescription,
  updatePopoverPosition,
} = useTaskPopoverEditor({
  orgSlug: props.orgSlug,
  workspaceId: props.workspaceId,
  orgLabels: toRef(props, 'orgLabels'),
  workspaceMembers: toRef(props, 'workspaceMembers'),
  workspaceLists: toRef(props, 'workspaceLists'),
  task: taskRef,
  disabled: computed(() => props.disabled),
  readonlyDescription: computed(() => props.readonlyDescription),
  onUpdated: (task) => emit('updated', task),
  zIndex: 130,
})
const descriptionDisplayText = computed(() => (
  props.readonlyDescription
    ? (taskRef.value?.description ?? '')
    : descriptionDraft.value
))
const renderedDescriptionHtml = computed(() => (
  renderMarkdownToSafeHtml(descriptionDisplayText.value)
))
async function setDescriptionViewMode (mode: DescriptionViewMode) {
  if (descriptionViewMode.value === mode) {
    return
  }
  if (
    !props.readonlyDescription
    && mode === 'preview'
    && descriptionViewMode.value === 'markdown'
  ) {
    await saveDescription()
  }
  descriptionViewMode.value = mode
  if (!props.readonlyDescription && mode === 'markdown') {
    await nextTick()
    const el = descriptionInputRef.value
    if (!el) return
    el.focus()
    const len = el.value.length
    el.setSelectionRange(len, len)
  }
}
function openDescriptionPicker (event?: Event) {
  descriptionViewMode.value = props.readonlyDescription ? 'preview' : 'markdown'
  openDescriptionPickerBase(event)
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
defineExpose({
  bindTask,
  openDatePicker,
  openEffortPicker,
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
