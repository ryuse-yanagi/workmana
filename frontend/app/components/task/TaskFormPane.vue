<template>
  <div
    class="task-form-pane"
    :class="{ 'task-form-pane--relaxed-title': relaxedTitlePadding || workspaceMode || documentMode }"
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
    <div ref="actionButtonsRef" class="action-buttons">
      <template v-if="!workspaceMode && !documentMode">
        <button
          type="button"
          class="action-btn"
          :class="{ 'action-btn--active': activePopover === 'start-date' }"
          :disabled="disabled"
          @click="openDatePicker('start', $event)"
        >
          <span class="action-btn-icon" aria-hidden="true">
            <CalendarDays :size="16" :stroke-width="2.25" />
          </span>
          開始日
        </button>
        <button
          type="button"
          class="action-btn"
          :class="{ 'action-btn--active': activePopover === 'due-date' }"
          :disabled="disabled"
          @click="openDatePicker('due', $event)"
        >
          <span class="action-btn-icon" aria-hidden="true">
            <CalendarCheck :size="16" :stroke-width="2.25" />
          </span>
          終了日
        </button>
        <button
          type="button"
          class="action-btn"
          :class="{ 'action-btn--active': activePopover === 'effort' }"
          :disabled="disabled"
          @click="openEffortPicker($event)"
        >
          <span class="action-btn-icon" aria-hidden="true">
            <Clock :size="16" :stroke-width="2.25" />
          </span>
          工数
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
          <Group :size="16" :stroke-width="2.25" />
        </span>
        カテゴリ
      </button>
      <button
        v-if="!documentMode"
        type="button"
        class="action-btn"
        :class="{ 'action-btn--active': activePopover === 'members' }"
        :disabled="disabled"
        @click="openMemberPicker($event)"
      >
        <span class="action-btn-icon" aria-hidden="true">
          <UserPlus :size="16" :stroke-width="2.25" />
        </span>
        担当者
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
          <BadgePlus :size="16" :stroke-width="2.25" />
        </span>
        ステータス
      </button>
      <button
        type="button"
        class="action-btn"
        :class="{ 'action-btn--active': activePopover === 'labels' }"
        :disabled="disabled"
        @click="openLabelPicker($event)"
      >
        <span class="action-btn-icon" aria-hidden="true">
          <Tags :size="16" :stroke-width="2.25" />
        </span>
        ラベル
      </button>
    </div>
    <div
      v-if="!workspaceMode && !documentMode && (draft.start_date || draft.due_date || showEffortDetailSection)"
      class="detail-meta-row detail-meta-row--schedule"
    >
      <section v-if="draft.start_date" class="detail-item detail-item--date">
        <span class="detail-item-label">開始日</span>
        <button
          type="button"
          class="detail-value-btn"
          :disabled="disabled"
          @click="openDatePicker('start', $event)"
        >
          {{ formatDateDisplay(draft.start_date) }}
        </button>
      </section>
      <section v-if="draft.due_date" class="detail-item detail-item--date">
        <span class="detail-item-label">終了日</span>
        <button
          type="button"
          class="detail-value-btn"
          :disabled="disabled"
          @click="openDatePicker('due', $event)"
        >
          {{ formatDateDisplay(draft.due_date) }}
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
    </div>
    <div
      v-if="draft.assignees.length || draft.labels.length || (documentMode && draft.category) || (workspaceMode && draft.status)"
      class="detail-meta-row detail-meta-row--people"
    >
      <section
        v-if="draft.assignees.length && !documentMode"
        class="detail-item detail-item--members"
      >
        <span class="detail-item-label">担当者</span>
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
              v-if="member.avatar_url"
              :src="member.avatar_url"
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
            aria-label="担当者を追加"
            @click="openMemberPicker($event)"
          >
            <span class="member-avatar-btn-plus" aria-hidden="true">+</span>
          </button>
        </div>
      </section>
      <section
        v-if="workspaceMode && draft.status"
        class="detail-item detail-item--status"
      >
        <span class="detail-item-label">ステータス</span>
        <div class="label-chip-list detail-chip-wrap">
          <button
            type="button"
            class="label-chip label-chip--pill"
            :style="surfacePillStyle(draft.status.color)"
            :disabled="disabled"
            :aria-label="`ステータス: ${draft.status.name}`"
            @click="openStatusPicker($event)"
          >
            {{ draft.status.name }}
          </button>
        </div>
      </section>
      <section
        v-if="documentMode && draft.category"
        class="detail-item detail-item--category"
      >
        <span class="detail-item-label">カテゴリ</span>
        <div class="label-chip-list detail-chip-wrap">
          <button
            type="button"
            class="label-chip label-chip--pill"
            :style="surfacePillStyle(draft.category.color)"
            :disabled="disabled"
            :aria-label="`カテゴリ: ${draft.category.name}`"
            @click="openCategoryPicker($event)"
          >
            {{ draft.category.name }}
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
            <span class="label-chip-add-plus" aria-hidden="true">+</span>
          </button>
        </div>
      </section>
    </div>
    <section class="field-block description-block">
      <span class="field-label">説明</span>
      <textarea
        v-model="descriptionModel"
        class="description-input"
        rows="4"
        :maxlength="TASK_DESCRIPTION_MAX_LENGTH"
        aria-label="説明"
        :disabled="disabled"
      />
    </section>
    <Teleport v-if="portalActive" to="body">
      <Transition name="popover-fade" @after-enter="updatePopoverPosition">
        <div
          v-if="activePopover"
          :key="activePopover === 'member-detail' ? `member-detail-${selectedMember?.id}` : activePopover"
          class="popover-layer popover-layer--portal"
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
                :disabled="disabled || !canClearCalendarDate"
                @click.stop="clearCalendarDate()"
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
                :disabled="disabled || !canClearEffort"
                @click.stop="clearEffort()"
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
              <div class="member-detail-body">
                <button
                  type="button"
                  class="member-detail-remove"
                  :disabled="disabled"
                  @click.stop="removeMember(selectedMember)"
                >
                  {{ workspaceMode ? '担当者から外す' : 'タスクから削除' }}
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
            :assignees="draft.assignees"
            :org-members="workspaceMembers"
            :disabled="disabled"
            :error="popoverError"
            :empty-members-message="workspaceMode ? '組織ユーザーがいません。' : 'スペースユーザーがいません。'"
            @close="closePopover"
            @toggle-member="toggleMember"
          />
          <PopoverShell
            v-else-if="activePopover === 'status'"
            ref="popoverElRef"
            shell-class="popover popover--labels"
            header-class="popover-header--labels"
            :style="popoverStyle"
            title="ステータス"
            aria-label="ステータス"
            :close-disabled="disabled"
            @close="closePopover"
          >
            <input
              v-model="statusSearchQuery"
              type="search"
              class="label-search-input"
              placeholder="ステータスを検索..."
              :disabled="disabled"
              @click.stop
            />
            <p class="label-section-heading">ステータス</p>
            <div class="popover-scroll">
              <ul class="label-picker-list">
                <li v-for="status in filteredWorkspaceStatuses" :key="status.name">
                  <button
                    type="button"
                    class="label-picker-row"
                    @click.stop="selectStatus(status)"
                  >
                    <span
                      class="label-picker-checkbox"
                      :class="{ 'label-picker-checkbox--checked': isStatusSelected(status.name) }"
                      aria-hidden="true"
                    >
                      <span v-if="isStatusSelected(status.name)">✓</span>
                    </span>
                    <span
                      class="label-picker-bar label-picker-bar--pill"
                      :style="surfacePillStyle(status.color)"
                    >
                      {{ status.name }}
                    </span>
                  </button>
                </li>
              </ul>
              <p v-if="!workspaceStatuses.length" class="empty-text label-picker-empty">
                ステータスは設定画面で作成できます。
              </p>
              <p v-else-if="!filteredWorkspaceStatuses.length" class="empty-text label-picker-empty">
                該当するステータスがありません。
              </p>
              <p v-if="popoverError" class="err">{{ popoverError }}</p>
            </div>
          </PopoverShell>
          <PopoverShell
            v-else-if="activePopover === 'category'"
            ref="popoverElRef"
            shell-class="popover popover--labels"
            header-class="popover-header--labels"
            :style="popoverStyle"
            title="カテゴリ"
            aria-label="カテゴリ"
            :close-disabled="disabled"
            @close="closePopover"
          >
            <input
              v-model="categorySearchQuery"
              type="search"
              class="label-search-input"
              placeholder="カテゴリを検索..."
              :disabled="disabled"
              @click.stop
            />
            <p class="label-section-heading">カテゴリ</p>
            <div class="popover-scroll">
              <ul class="label-picker-list">
                <li v-for="category in filteredDocumentCategories" :key="category.name">
                  <button
                    type="button"
                    class="label-picker-row"
                    @click.stop="selectCategory(category)"
                  >
                    <span
                      class="label-picker-checkbox"
                      :class="{ 'label-picker-checkbox--checked': isCategorySelected(category.name) }"
                      aria-hidden="true"
                    >
                      <span v-if="isCategorySelected(category.name)">✓</span>
                    </span>
                    <span
                      class="label-picker-bar label-picker-bar--pill"
                      :style="surfacePillStyle(category.color)"
                    >
                      {{ category.name }}
                    </span>
                  </button>
                </li>
              </ul>
              <p v-if="!documentCategories.length" class="empty-text label-picker-empty">
                カテゴリは設定画面で作成できます。
              </p>
              <p v-else-if="!filteredDocumentCategories.length" class="empty-text label-picker-empty">
                該当するカテゴリがありません。
              </p>
              <p v-if="popoverError" class="err">{{ popoverError }}</p>
            </div>
          </PopoverShell>
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
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
<script setup lang="ts">
import {
  BadgePlus,
  CalendarCheck,
  CalendarDays,
  Clock,
  Group,
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
import { effortUnitLabel } from '../../composables/useTaskFormHelpers'
import {
  standardColorEmphasisText,
  standardColorSurfaceBackground,
} from '../../constants/colorPresets'
import { memberDisplayName, memberInitial } from '../../composables/useMemberDisplay'
import PopoverShell from '../ui/PopoverShell.vue'
const props = withDefaults(defineProps<{
  modelValue: TaskFormDraft
  orgSlug: string
  orgLabels: TaskFormLabel[]
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
  titleError: null,
})
const emit = defineEmits<{
  'update:modelValue': [TaskFormDraft]
}>()
const draft = computed({
  get: () => props.modelValue,
  set: (value: TaskFormDraft) => emit('update:modelValue', value),
})
const memberSearchQuery = ref('')
const descriptionModel = computed({
  get: () => props.modelValue.description,
  set: (description: string) => emit('update:modelValue', { ...props.modelValue, description }),
})
const titleDraft = ref('')
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
  if (props.workspaceMode) return 'スペース名を入力してください'
  if (props.documentMode) return '資料名を入力してください'
  if (props.relaxedTitlePadding) return 'タスク名を入力してください'
  return 'タスク名'
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
  titleInputRef,
  labelSearchQuery,
  categorySearchQuery,
  statusSearchQuery,
  effortDraft,
  effortInputRef,
  weekdayLabels,
  filteredOrgLabels,
  filteredDocumentCategories,
  filteredWorkspaceStatuses,
  showEffortDetailSection,
  effortDetailDisplayText,
  calendarMonthLabel,
  calendarCells,
  formatDateDisplay,
  labelBarTextColor,
  memberEmailLine,
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
  openMemberPicker,
  openMemberDetail,
  openLabelPicker,
  openCategoryPicker,
  openStatusPicker,
  isLabelSelected,
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
  workspaceMembers: toRef(props, 'workspaceMembers'),
  disabled: computed(() => props.disabled ?? false),
  documentCategories: toRef(props, 'documentCategories'),
  workspaceStatuses: toRef(props, 'workspaceStatuses'),
})
function adjustTitleTextareaHeight () {
  const el = titleInputRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
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
/** ステータス・カテゴリ用: 淡色背景+濃色文字のピル配色 */
function surfacePillStyle (color: string) {
  return {
    backgroundColor: standardColorSurfaceBackground(color),
    color: standardColorEmphasisText(color),
  }
}
const activeCalendarDate = computed(() => {
  if (activePopover.value === 'start-date') return draft.value.start_date
  if (activePopover.value === 'due-date') return draft.value.due_date
  return null
})
defineExpose({ resetPaneState, focusTitleInput, activePopover, closePopover })
onMounted(() => {
  nextTick(() => adjustTitleTextareaHeight())
  if (props.autoFocusTitle) {
    focusTitleInput()
  }
})
</script>
<style lang="scss" scoped src="~/assets/styles/components/task/TaskFormPane.scss"></style>
