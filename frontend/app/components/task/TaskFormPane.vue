<template>
  <div
    class="task-form-pane"
    :class="{
      'task-form-pane--relaxed-title': relaxedTitlePadding || workspaceMode || documentMode,
      'task-form-pane--workspace': workspaceMode,
    }"
  >
    <section class="field-block title-block">
      <span
        v-if="relaxedTitlePadding || workspaceMode || documentMode"
        class="field-label"
      >{{ titleFieldLabel }}</span>
      <div class="title-input-wrap">
        <textarea
          ref="titleInputRef"
          v-model="titleDraft"
          :maxlength="titleMaxLength"
          class="title-input"
          :aria-label="titleFieldLabel"
          :disabled="disabled"
          rows="1"
          @input="onTitleInput"
          @compositionstart="onTitleCompositionStart"
          @compositionend="onTitleCompositionEnd"
          @keydown.enter.prevent
        />
        <span
          v-if="showTitlePlaceholder"
          class="title-input-placeholder"
          aria-hidden="true"
        >{{ titlePlaceholder }}</span>
      </div>
      <p v-if="titleError" class="field-error">{{ titleError }}</p>
    </section>
    <slot name="after-title" />
    <div
      class="action-toolbar"
      :class="{ 'action-toolbar--with-aside': Boolean($slots['action-aside']) }"
    >
      <div
        ref="actionButtonsRef"
        class="action-button-rows"
        :class="{ 'action-button-rows--workspace': workspaceMode }"
      >
        <div class="action-buttons">
          <button
            v-if="!documentMode"
            type="button"
            class="action-btn"
            :class="{ 'action-btn--active': activePopover === 'members' }"
            :disabled="disabled"
            @click="openMemberPicker($event)"
          >
            <span class="action-btn-icon" aria-hidden="true">
              <UserPlus :size="18" :stroke-width="2.25" />
            </span>
            {{ memberRoleLabel }}
          </button>
          <button
            type="button"
            class="action-btn"
            :class="{ 'action-btn--active': activePopover === 'labels' }"
            :disabled="disabled"
            @click="openLabelPicker($event)"
          >
            <span class="action-btn-icon" aria-hidden="true">
              <Tags :size="18" :stroke-width="2.25" />
            </span>
            ラベル
          </button>
          <template v-if="!workspaceMode && !documentMode">
            <button
              type="button"
              class="action-btn"
              :class="{ 'action-btn--active': activePopover === 'period' }"
              :disabled="disabled"
              @click="openDatePicker($event)"
            >
              <span class="action-btn-icon" aria-hidden="true">
                <CalendarDays :size="18" :stroke-width="2.25" />
              </span>
              期間
            </button>
            <button
              type="button"
              class="action-btn"
              :class="{ 'action-btn--active': activePopover === 'effort' }"
              :disabled="disabled"
              @click="openEffortPicker($event)"
            >
              <span class="action-btn-icon" aria-hidden="true">
                <Clock :size="18" :stroke-width="2.25" />
              </span>
              工数
            </button>
            <button
              type="button"
              class="action-btn"
              :class="{ 'action-btn--active': activePopover === 'progress-rate' }"
              :disabled="disabled"
              @click="openProgressRatePicker($event)"
            >
              <span class="action-btn-icon" aria-hidden="true">
                <ChartNoAxesColumnIncreasing :size="18" :stroke-width="2.25" />
              </span>
              進捗率
            </button>
          </template>
          <button
            v-if="documentMode"
            type="button"
            class="action-btn"
            :class="{ 'action-btn--active': activePopover === 'category' }"
            :disabled="disabled"
            @click="openCategoryPicker($event)"
          >
            <span class="action-btn-icon" aria-hidden="true">
              <Group :size="18" :stroke-width="2.25" />
            </span>
            カテゴリ
          </button>
          <button
            v-if="workspaceMode"
            type="button"
            class="action-btn"
            :class="{ 'action-btn--active': activePopover === 'status' }"
            :disabled="disabled"
            @click="openStatusPicker($event)"
          >
            <span class="action-btn-icon" aria-hidden="true">
              <BadgePlus :size="18" :stroke-width="2.25" />
            </span>
            ステータス
          </button>
        </div>
      </div>
      <div
        v-if="$slots['action-aside']"
        class="action-toolbar__aside"
      >
        <slot name="action-aside" />
      </div>
    </div>
    <template v-if="workspaceMode && (draft.assignees.length || draft.status || draft.labels.length)">
      <div class="detail-meta-rows detail-meta-rows--workspace">
        <div
          v-if="draft.assignees.length || draft.labels.length"
          class="detail-meta-row detail-meta-row--people"
        >
          <section
            v-if="draft.assignees.length"
            class="detail-item detail-item--members"
          >
            <span class="detail-item-label">{{ memberRoleLabel }}</span>
            <div class="member-avatar-list detail-chip-wrap">
              <button
                v-for="member in draft.assignees"
                :key="member.id"
                type="button"
                class="member-avatar-btn"
                :class="{
                  'member-avatar-btn--active':
                    activePopover === 'member-detail' && selectedMember?.id === member.id,
                }"
                :disabled="disabled"
                :aria-label="memberDisplayName(member)"
                @click="openMemberDetail(member, $event)"
              >
                <img
                  v-if="memberAvatarSrc(member)"
                  :src="memberAvatarSrc(member)!"
                  alt=""
                  class="member-avatar-btn-image"
                />
                <span v-else class="member-avatar-btn-initial">{{ memberInitial(member) }}</span>
              </button>
              <button
                type="button"
                class="member-avatar-btn member-avatar-btn--add"
                :class="{ 'member-avatar-btn--active': activePopover === 'members' }"
                :disabled="disabled"
                :aria-label="`${memberRoleLabel}を追加`"
                @click="openMemberPicker($event)"
              >
                <Plus
                  :size="16"
                  :stroke-width="2.25"
                  class="member-avatar-btn-plus"
                  aria-hidden="true"
                />
              </button>
            </div>
          </section>
          <section
            v-if="draft.labels.length"
            class="detail-item detail-item--labels"
          >
            <span class="detail-item-label">ラベル</span>
            <div class="label-chip-list detail-chip-wrap">
              <button
                v-for="label in draft.labels"
                :key="label.id"
                type="button"
                class="label-chip"
                :style="{
                  backgroundColor: label.color,
                  color: labelBarTextColor(label.color),
                }"
                :disabled="disabled"
                :aria-label="`ラベル: ${label.name}`"
                @click="openLabelPicker($event)"
              >
                {{ label.name }}
              </button>
              <button
                type="button"
                class="label-chip-add"
                :disabled="disabled"
                aria-label="ラベルを追加"
                @click="openLabelPicker($event)"
              >
                <Plus
                  :size="16"
                  :stroke-width="2.25"
                  class="label-chip-add-plus"
                  aria-hidden="true"
                />
              </button>
            </div>
          </section>
        </div>
        <div
          v-if="draft.status"
          class="detail-meta-row detail-meta-row--status"
        >
          <section class="detail-item detail-item--status">
            <span class="detail-item-label">ステータス</span>
            <div class="detail-chip-wrap">
              <button
                type="button"
                class="workspace-form-status-btn"
                :disabled="disabled"
                :aria-label="`ステータス: ${draft.status.name}`"
                @click="openStatusPicker($event)"
              >
                <LabelStrip
                  :label="workspaceStatusLabel(draft.status)"
                  :text-color="workspaceStatusTextColor(draft.status.color)"
                  size="sm"
                />
              </button>
            </div>
          </section>
        </div>
      </div>
    </template>
    <div
      v-else-if="draft.assignees.length || draft.labels.length || (documentMode && draft.category)"
      class="detail-meta-row detail-meta-row--people"
    >
      <section
        v-if="draft.assignees.length && !documentMode && !workspaceMode"
        class="detail-item detail-item--members"
      >
        <span class="detail-item-label">{{ memberRoleLabel }}</span>
        <div class="member-avatar-list detail-chip-wrap">
          <button
            v-for="member in draft.assignees"
            :key="member.id"
            type="button"
            class="member-avatar-btn"
            :class="{
              'member-avatar-btn--active':
                activePopover === 'member-detail' && selectedMember?.id === member.id,
            }"
            :disabled="disabled"
            :aria-label="memberDisplayName(member)"
            @click="openMemberDetail(member, $event)"
          >
            <img
              v-if="memberAvatarSrc(member)"
              :src="memberAvatarSrc(member)!"
              alt=""
              class="member-avatar-btn-image"
            />
            <span v-else class="member-avatar-btn-initial">{{ memberInitial(member) }}</span>
          </button>
          <button
            type="button"
            class="member-avatar-btn member-avatar-btn--add"
            :class="{ 'member-avatar-btn--active': activePopover === 'members' }"
            :disabled="disabled"
            :aria-label="`${memberRoleLabel}を追加`"
            @click="openMemberPicker($event)"
          >
            <Plus
              :size="16"
              :stroke-width="2.25"
              class="member-avatar-btn-plus"
              aria-hidden="true"
            />
          </button>
        </div>
      </section>
      <section
        v-if="documentMode && draft.category"
        class="detail-item detail-item--category"
      >
        <span class="detail-item-label">カテゴリ</span>
        <div class="detail-chip-wrap">
          <button
            type="button"
            class="workspace-form-status-btn"
            :disabled="disabled"
            :aria-label="`カテゴリ: ${draft.category.name}`"
            @click="openCategoryPicker($event)"
          >
            <LabelStrip
              :label="workspaceStatusLabel(draft.category)"
              :text-color="workspaceStatusTextColor(draft.category.color)"
              size="sm"
            />
          </button>
        </div>
      </section>
      <section
        v-if="draft.labels.length && !workspaceMode"
        class="detail-item detail-item--labels"
      >
        <span class="detail-item-label">ラベル</span>
        <div class="label-chip-list detail-chip-wrap">
          <button
            v-for="label in draft.labels"
            :key="label.id"
            type="button"
            class="label-chip"
            :style="{
              backgroundColor: label.color,
              color: labelBarTextColor(label.color),
            }"
            :disabled="disabled"
            :aria-label="`ラベル: ${label.name}`"
            @click="openLabelPicker($event)"
          >
            {{ label.name }}
          </button>
          <button
            type="button"
            class="label-chip-add"
            :disabled="disabled"
            aria-label="ラベルを追加"
            @click="openLabelPicker($event)"
          >
            <Plus
              :size="16"
              :stroke-width="2.25"
              class="label-chip-add-plus"
              aria-hidden="true"
            />
          </button>
        </div>
      </section>
    </div>
    <div
      v-if="!workspaceMode && !documentMode && (draft.start_date || draft.due_date || showEffortDetailSection || showProgressRateDetailSection)"
      class="detail-meta-row detail-meta-row--schedule"
    >
      <section v-if="draft.start_date || draft.due_date" class="detail-item detail-item--date">
        <span class="detail-item-label">期間</span>
        <button
          type="button"
          class="detail-value-btn"
          :disabled="disabled"
          @click="openDatePicker($event)"
        >
          {{ formatPeriodDisplay(draft.start_date, draft.due_date) }}
        </button>
      </section>
      <section
        v-if="showEffortDetailSection"
        ref="effortDetailAnchorRef"
        class="detail-item detail-item--effort"
      >
        <span class="detail-item-label">工数</span>
        <button
          type="button"
          class="detail-value-btn"
          :class="{ 'detail-value-btn--editing': activePopover === 'effort' }"
          :disabled="disabled"
          :aria-live="activePopover === 'effort' ? 'polite' : undefined"
          @click="openEffortPicker($event)"
        >
          {{ effortDetailDisplayText }}
        </button>
      </section>
      <section
        v-if="showProgressRateDetailSection"
        ref="progressRateDetailAnchorRef"
        class="detail-item detail-item--progress-rate"
      >
        <span class="detail-item-label">進捗率</span>
        <button
          type="button"
          class="detail-value-btn"
          :class="{ 'detail-value-btn--editing': activePopover === 'progress-rate' }"
          :disabled="disabled"
          :aria-live="activePopover === 'progress-rate' ? 'polite' : undefined"
          @click="openProgressRatePicker($event)"
        >
          {{ progressRateDetailDisplayText }}
        </button>
      </section>
    </div>
    <section class="field-block description-block">
      <span class="field-label">説明</span>
      <textarea
        ref="descriptionTextareaRef"
        v-model="descriptionModel"
        class="description-input"
        rows="1"
        :maxlength="TASK_DESCRIPTION_MAX_LENGTH"
        aria-label="説明"
        :disabled="disabled"
        @input="onDescriptionInput"
      />
    </section>
    <Teleport v-if="portalActive" to="body">
      <Transition name="popover-fade" @after-enter="updatePopoverPosition" @after-leave="notifyPopoverAfterLeave">
        <div
          v-if="activePopover"
          :key="activePopover === 'member-detail' ? `member-detail-${selectedMember?.id}` : activePopover"
          class="popover-layer popover-layer--portal"
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
            @clear="clearCalendarDate()"
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
            @clear="clearEffortDraft()"
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
            @clear="clearProgressRateDraft()"
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
            :remove-label="workspaceMode ? 'メンバーから外す' : 'タスクから削除'"
            @close="closePopover"
            @remove="removeMember(selectedMember)"
          />
          <WorkspaceMemberPickerPopover
            v-else-if="activePopover === 'members'"
            ref="popoverElRef"
            :style="popoverStyle"
            :title="memberRoleLabel"
            :assigned-section-heading="memberRoleLabel"
            :unassigned-section-heading="memberPickerUnassignedHeading"
            v-model:search-query="memberSearchQuery"
            :assignees="draft.assignees"
            :org-members="workspaceMembers"
            :disabled="disabled"
            :can-clear="canClearAssignees"
            :error="popoverError"
            :empty-members-message="workspaceMode ? '組織ユーザーがいません' : 'スペースメンバーがいません'"
            @close="closePopover"
            @toggle-member="toggleMember"
            @clear="clearAssignees()"
          />
          <TaskOptionPickerPopover
            v-else-if="activePopover === 'status'"
            ref="popoverElRef"
            :style="popoverStyle"
            title="ステータス"
            :disabled="disabled"
            :can-clear="canClearStatus"
            :error="popoverError"
            v-model:search-query="statusSearchQuery"
            search-placeholder="ステータスを検索..."
            section-heading="ステータス"
            :items="statusOptionItems"
            :has-source-items="workspaceStatuses.length > 0"
            empty-source-message="ステータスは設定画面で追加できます"
            empty-filter-message="該当するステータスがありません"
            :pill-style="optionPillStyle"
            @close="closePopover"
            @select="onStatusOptionSelect"
            @clear="clearStatus()"
          />
          <TaskOptionPickerPopover
            v-else-if="activePopover === 'category'"
            ref="popoverElRef"
            :style="popoverStyle"
            title="カテゴリ"
            :disabled="disabled"
            :can-clear="canClearCategory"
            :error="popoverError"
            v-model:search-query="categorySearchQuery"
            search-placeholder="カテゴリを検索..."
            section-heading="カテゴリ"
            :items="categoryOptionItems"
            :has-source-items="documentCategories.length > 0"
            empty-source-message="カテゴリは設定画面で追加できます"
            empty-filter-message="該当するカテゴリがありません"
            :pill-style="optionPillStyle"
            @close="closePopover"
            @select="onCategoryOptionSelect"
            @clear="clearCategory()"
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
            :selected-ids="draft.labels.map(label => label.id)"
            :has-source-labels="orgLabels.length > 0"
            @close="closePopover"
            @toggle="toggleLabel"
            @clear="clearLabels()"
          />
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
<script setup lang="ts">
import {
  BadgePlus,
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  Clock,
  Group,
  Plus,
  Tags,
  UserPlus,
} from 'lucide-vue-next'
import WorkspaceMemberPickerPopover from '../workspace/WorkspaceMemberPickerPopover.vue'
import { useTaskFormPane } from '../../composables/useTaskFormPane'
import {
  TASK_DESCRIPTION_MAX_LENGTH,
  TASK_TITLE_MAX_LENGTH,
  DOCUMENT_NAME_MAX_LENGTH,
  WORKSPACE_NAME_MAX_LENGTH,
} from '../../constants/fieldLengthLimits'
import type {
  TaskFormCategory,
  TaskFormDraft,
  TaskFormLabel,
  TaskFormMember,
} from '../../composables/useTaskFormHelpers'
import { EFFORT_UNIT_LABEL, PROGRESS_RATE_UNIT_LABEL } from '../../composables/useTaskFormHelpers'
import {
  standardColorEmphasisText,
  standardColorSurfaceBackground,
} from '../../constants/colorPresets'
import { memberDisplayName, memberInitial } from '../../composables/useMemberDisplay'
import { resolveDisplayAvatarUrl } from '../../composables/userProfileUpdated'
import { resolveAvatarUrl } from '../../utils/resolveAvatarUrl'
import { adjustTextareaHeight } from '../../utils/textareaAutoGrow'
import LabelStrip from '../ui/LabelStrip.vue'
import TaskDatePickerPopover from './popover/TaskDatePickerPopover.vue'
import TaskEffortPickerPopover from './popover/TaskEffortPickerPopover.vue'
import TaskProgressRatePickerPopover from './popover/TaskProgressRatePickerPopover.vue'
import TaskLabelsPickerPopover from './popover/TaskLabelsPickerPopover.vue'
import TaskMemberDetailPopover from './popover/TaskMemberDetailPopover.vue'
import TaskOptionPickerPopover from './popover/TaskOptionPickerPopover.vue'
import type { TaskPopoverOptionItem } from '../../utils/taskPopoverTypes'
import type { LabelCategoryGroup } from '../../composables/useLabelCategories'
const props = withDefaults(defineProps<{
  modelValue: TaskFormDraft
  orgSlug: string
  orgLabels: TaskFormLabel[]
  labelCategories?: LabelCategoryGroup[]
  workspaceMembers: TaskFormMember[]
  disabled?: boolean
  portalActive?: boolean
  relaxedTitlePadding?: boolean
  autoFocusTitle?: boolean
  workspaceMode?: boolean
  documentMode?: boolean
  documentCategories?: TaskFormCategory[]
  workspaceStatuses?: TaskFormCategory[]
  titleError?: string | null
}>(), {
  disabled: false,
  portalActive: true,
  relaxedTitlePadding: false,
  autoFocusTitle: false,
  workspaceMode: false,
  documentMode: false,
  documentCategories: () => [],
  workspaceStatuses: () => [],
  labelCategories: () => [],
  titleError: null,
})
const emit = defineEmits<{
  'update:modelValue': [TaskFormDraft]
}>()
const config = useRuntimeConfig()
function memberAvatarSrc (member: { id: number; avatar_url?: string | null }): string | null {
  return resolveAvatarUrl(
    resolveDisplayAvatarUrl(member),
    String(config.public.apiBaseUrl || '/api'),
  )
}
const draft = computed({
  get: () => props.modelValue,
  set: (value: TaskFormDraft) => emit('update:modelValue', value),
})
const memberRoleLabel = computed(() => (props.workspaceMode ? 'メンバー' : '担当者'))
const memberPickerUnassignedHeading = computed(() => (props.workspaceMode ? 'ユーザー' : 'メンバー'))
const memberSearchQuery = ref('')
const descriptionModel = computed({
  get: () => props.modelValue.description,
  set: (description: string) => emit('update:modelValue', { ...props.modelValue, description }),
})
const titleDraft = ref('')
const descriptionTextareaRef = ref<HTMLTextAreaElement | null>(null)
const titleComposing = ref(false)
const showTitlePlaceholder = computed(() => {
  if (titleComposing.value) return false
  return titleDraft.value.length === 0
})
const titleFieldLabel = computed(() => {
  if (props.workspaceMode) return 'スペース名'
  if (props.documentMode) return '資料名'
  return 'タスク名'
})
const titlePlaceholder = computed(() => {
  if (props.workspaceMode) return 'スペース名を入力...'
  if (props.documentMode) return '資料名を入力...'
  return 'タスク名を入力...'
})
const titleMaxLength = computed(() => {
  if (props.workspaceMode) return WORKSPACE_NAME_MAX_LENGTH
  if (props.documentMode) return DOCUMENT_NAME_MAX_LENGTH
  return TASK_TITLE_MAX_LENGTH
})
function onTitleCompositionStart () {
  titleComposing.value = true
}
function onTitleCompositionEnd () {
  titleComposing.value = false
}
const {
  activePopover,
  selectedMember,
  popoverError,
  popoverStyle,
  popoverElRef,
  actionButtonsRef,
  effortDetailAnchorRef,
  progressRateDetailAnchorRef,
  titleInputRef,
  labelSearchQuery,
  categorySearchQuery,
  statusSearchQuery,
  effortDraft,
  progressRateDraft,
  weekdayLabels,
  filteredLabelCategories,
  filteredDocumentCategories,
  filteredWorkspaceStatuses,
  showEffortDetailSection,
  effortDetailDisplayText,
  showProgressRateDetailSection,
  progressRateDetailDisplayText,
  calendarMonthLabel,
  calendarCells,
  formatPeriodDisplay,
  labelBarTextColor,
  memberEmailLine,
  canClearCalendarDate,
  periodRangeStartIso,
  periodRangeEndIso,
  canClearEffort,
  canClearProgressRate,
  canClearAssignees,
  canClearLabels,
  canClearStatus,
  canClearCategory,
  openDatePicker,
  shiftCalendarMonth,
  pickCalendarDay,
  pickCalendarRange,
  clearCalendarDate,
  clearEffortDraft,
  clearProgressRateDraft,
  clearAssignees,
  clearLabels,
  clearStatus,
  clearCategory,
  openEffortPicker,
  updateEffortDraft,
  finalizeEffortPopover,
  openProgressRatePicker,
  updateProgressRateDraft,
  finalizeProgressRatePopover,
  closePopover,
  notifyPopoverAfterLeave,
  openMemberPicker,
  openMemberDetail,
  openLabelPicker,
  openCategoryPicker,
  openStatusPicker,
  isCategorySelected,
  isStatusSelected,
  toggleMember,
  removeMember,
  toggleLabel,
  selectCategory,
  selectStatus,
  resetPaneState,
  focusTitleInput,
  updatePopoverPosition,
} = useTaskFormPane({
  draft,
  orgLabels: toRef(props, 'orgLabels'),
  labelCategories: toRef(props, 'labelCategories'),
  workspaceMembers: toRef(props, 'workspaceMembers'),
  disabled: computed(() => props.disabled ?? false),
  documentCategories: toRef(props, 'documentCategories'),
  workspaceStatuses: toRef(props, 'workspaceStatuses'),
})
const statusOptionItems = computed<TaskPopoverOptionItem[]>(() => (
  filteredWorkspaceStatuses.value.map(status => ({
    key: status.name,
    name: status.name,
    color: status.color,
    selected: isStatusSelected(status.name),
  }))
))
const categoryOptionItems = computed<TaskPopoverOptionItem[]>(() => (
  filteredDocumentCategories.value.map(category => ({
    key: category.name,
    name: category.name,
    color: category.color,
    selected: isCategorySelected(category.name),
  }))
))
function optionPillStyle (item: TaskPopoverOptionItem) {
  return surfacePillStyle(item.color)
}
function onStatusOptionSelect (item: TaskPopoverOptionItem) {
  const status = filteredWorkspaceStatuses.value.find(entry => entry.name === item.key)
  if (status) selectStatus(status)
}
function onCategoryOptionSelect (item: TaskPopoverOptionItem) {
  const category = filteredDocumentCategories.value.find(entry => entry.name === item.key)
  if (category) selectCategory(category)
}
function adjustTitleTextareaHeight () {
  adjustTextareaHeight(titleInputRef.value)
}
function adjustDescriptionTextareaHeight () {
  adjustTextareaHeight(descriptionTextareaRef.value)
}
function onDescriptionInput () {
  adjustDescriptionTextareaHeight()
}
function onTitleInput () {
  const cleaned = titleDraft.value.replace(/\r?\n/g, '')
  if (cleaned !== titleDraft.value) {
    titleDraft.value = cleaned
  }
  adjustTitleTextareaHeight()
  emit('update:modelValue', {
    ...props.modelValue,
    title: titleDraft.value,
  })
}
watch(
  () => props.modelValue.title,
  (title) => {
    if (title !== titleDraft.value) {
      titleDraft.value = title
    }
    nextTick(() => adjustTitleTextareaHeight())
  },
  { immediate: true },
)
watch(
  () => props.modelValue.description,
  () => {
    nextTick(() => adjustDescriptionTextareaHeight())
  },
  { immediate: true },
)
watch(memberSearchQuery, () => {
  if (activePopover.value === 'members') {
    updatePopoverPosition()
  }
})
/** ステータス・カテゴリ用: 淡色背景+濃色文字のピル配色 */
function surfacePillStyle (color: string) {
  return {
    backgroundColor: standardColorSurfaceBackground(color),
    color: standardColorEmphasisText(color),
  }
}
function workspaceStatusLabel (status: TaskFormCategory) {
  return {
    ...status,
    color: standardColorSurfaceBackground(status.color),
  }
}
function workspaceStatusTextColor (color: string) {
  return standardColorEmphasisText(color)
}
defineExpose({ resetPaneState, focusTitleInput, activePopover, closePopover })
onMounted(() => {
  nextTick(() => {
    adjustTitleTextareaHeight()
    adjustDescriptionTextareaHeight()
  })
  if (props.autoFocusTitle) {
    focusTitleInput()
  }
})
</script>
<style lang="scss" scoped src="~/assets/styles/components/task/TaskFormPane.scss"></style>
