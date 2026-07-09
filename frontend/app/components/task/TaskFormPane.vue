<template>
  <div
    class="task-form-pane"
    :class="{ 'task-form-pane--relaxed-title': relaxedTitlePadding }"
  >
    <section class="field-block title-block">
      <span
        v-if="relaxedTitlePadding || workspaceMode"
        class="field-label"
      >{{ workspaceMode ? 'スペース名' : 'タスク名' }}</span>
      <div class="title-input-wrap">
        <input
          ref="titleInputRef"
          v-model="titleDraft"
          type="text"
          :maxlength="workspaceMode ? WORKSPACE_NAME_MAX_LENGTH : TASK_TITLE_MAX_LENGTH"
          class="title-input"
          :aria-label="workspaceMode ? 'スペース名' : 'タスク名'"
          :disabled="disabled"
          @input="onTitleInput"
          @compositionstart="onTitleCompositionStart"
          @compositionend="onTitleCompositionEnd"
        />
        <span
          v-if="showTitlePlaceholder"
          class="title-input-placeholder"
          aria-hidden="true"
        >{{ workspaceMode ? 'スペース名を入力してください' : (relaxedTitlePadding ? 'タスク名を入力してください' : 'タスク名') }}</span>
      </div>
    </section>
    <div ref="actionButtonsRef" class="action-buttons">
      <template v-if="!workspaceMode">
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
        type="button"
        class="action-btn"
        :class="{ 'action-btn--active': activePopover === 'members' }"
        :disabled="disabled"
        @click="openMemberPicker($event)"
      >
        <span class="action-btn-icon" aria-hidden="true">
          <Users :size="16" :stroke-width="2.25" />
        </span>
        担当者
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
      v-if="!workspaceMode && (draft.start_date || draft.due_date || showEffortDetailSection)"
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
      v-if="draft.assignees.length || draft.labels.length"
      class="detail-meta-row detail-meta-row--people"
    >
      <section
        v-if="draft.assignees.length"
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
              <span class="effort-unit-label">{{ effortUnitLabel(orgEffortUnit) }}</span>
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
          <PopoverShell
            v-else-if="activePopover === 'members'"
            ref="popoverElRef"
            shell-class="popover popover--members"
            header-class="popover-header--labels"
            :style="popoverStyle"
            title="担当者"
            aria-label="担当者"
            :close-disabled="disabled"
            @close="closePopover"
          >
            <input
              v-model="memberSearchQuery"
              type="search"
              class="label-search-input"
              :placeholder="'メンバーを検索...'"
              :disabled="disabled"
              @click.stop
            />
            <div class="popover-scroll">
              <template v-if="filteredAssignedMembers.length">
                <p class="label-section-heading">担当者</p>
                <ul class="label-picker-list">
                  <li v-for="member in filteredAssignedMembers" :key="`assigned-${member.id}`">
                    <button
                      type="button"
                      class="label-picker-row member-picker-row--workspace"
                      @click.stop="toggleMember(member)"
                    >
                      <span class="label-picker-bar member-picker-bar">
                        <MemberAvatar
                          :member="member"
                          size="xs"
                          class="member-picker-avatar"
                        />
                        <span class="member-picker-name">{{ memberDisplayName(member) }}</span>
                      </span>
                      <Check
                        :size="16"
                        :stroke-width="2.75"
                        class="member-picker-check"
                        aria-hidden="true"
                      />
                    </button>
                  </li>
                </ul>
              </template>
              <template v-if="filteredUnassignedMembers.length">
                <p class="label-section-heading">メンバー</p>
                <ul class="label-picker-list">
                  <li v-for="member in filteredUnassignedMembers" :key="`member-${member.id}`">
                    <button
                      type="button"
                      class="label-picker-row member-picker-row--workspace"
                      @click.stop="toggleMember(member)"
                    >
                      <span class="label-picker-bar member-picker-bar">
                        <MemberAvatar
                          :member="member"
                          size="xs"
                          class="member-picker-avatar"
                        />
                        <span class="member-picker-name">{{ memberDisplayName(member) }}</span>
                      </span>
                    </button>
                  </li>
                </ul>
              </template>
              <p v-if="!workspaceMembers.length" class="empty-text label-picker-empty">
                {{ workspaceMode ? '組織メンバーがいません。' : 'スペースメンバーがいません。' }}
              </p>
              <p
                v-else-if="!filteredAssignedMembers.length && !filteredUnassignedMembers.length"
                class="empty-text label-picker-empty"
              >該当するメンバーがいません。</p>
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
  CalendarCheck,
  CalendarDays,
  Check,
  Clock,
  Tags,
  Users,
} from 'lucide-vue-next'
import { useTaskFormPane } from '../../composables/useTaskFormPane'
import {
  TASK_DESCRIPTION_MAX_LENGTH,
  TASK_TITLE_MAX_LENGTH,
  WORKSPACE_NAME_MAX_LENGTH,
} from '../../constants/fieldLengthLimits'
import type {
  TaskFormDraft,
  TaskFormLabel,
  TaskFormMember,
} from '../../composables/useTaskFormHelpers'
import { effortUnitLabel } from '../../composables/useTaskFormHelpers'
import { useOrgEffortUnit } from '../../composables/useOrgEffortSettings'
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
}>(), {
  disabled: false,
  portalActive: true,
  relaxedTitlePadding: false,
  autoFocusTitle: false,
  workspaceMode: false,
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
watch(
  () => props.modelValue.title,
  (title) => {
    if (title !== titleDraft.value) {
      titleDraft.value = title
    }
  },
  { immediate: true },
)
function onTitleCompositionStart () {
  titleComposing.value = true
}
function onTitleCompositionEnd () {
  titleComposing.value = false
}
function onTitleInput () {
  emit('update:modelValue', {
    ...props.modelValue,
    title: titleDraft.value,
  })
}
const { orgEffortUnit, ensureOrgEffortUnit } = useOrgEffortUnit(() => props.orgSlug)
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
  effortDraft,
  effortInputRef,
  weekdayLabels,
  filteredOrgLabels,
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
  isLabelSelected,
  toggleMember,
  removeMember,
  toggleLabel,
  resetPaneState,
  focusTitleInput,
  updatePopoverPosition,
} = useTaskFormPane({
  draft,
  orgLabels: toRef(props, 'orgLabels'),
  workspaceMembers: toRef(props, 'workspaceMembers'),
  orgEffortUnit,
  disabled: computed(() => props.disabled ?? false),
})
function memberMatchesSearch (member: TaskFormMember, query: string): boolean {
  if (!query) return true
  const name = memberDisplayName(member).toLowerCase()
  const email = (member.email ?? '').toLowerCase()
  return name.includes(query) || email.includes(query)
}
const filteredAssignedMembers = computed(() => {
  const query = memberSearchQuery.value.trim().toLowerCase()
  return draft.value.assignees.filter(member => memberMatchesSearch(member, query))
})
const filteredUnassignedMembers = computed(() => {
  const query = memberSearchQuery.value.trim().toLowerCase()
  const assignedIds = new Set(draft.value.assignees.map(member => member.id))
  return props.workspaceMembers.filter(
    member => !assignedIds.has(member.id) && memberMatchesSearch(member, query),
  )
})
const activeCalendarDate = computed(() => {
  if (activePopover.value === 'start-date') return draft.value.start_date
  if (activePopover.value === 'due-date') return draft.value.due_date
  return null
})
defineExpose({ resetPaneState, focusTitleInput, activePopover, closePopover })
onMounted(() => {
  void ensureOrgEffortUnit()
  if (props.autoFocusTitle) {
    focusTitleInput()
  }
})
</script>
<style lang="scss" scoped>
.task-form-pane {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow: visible;
}
.field-block {
  display: flex;
  flex-direction: column;
  gap: 6.3px;
}
.field-label {
  font-size: 11.48px;
  font-weight: 700;
  color: mixin.$text-sub;
}
.title-block {
  margin-bottom: 1.4px;
  gap: 0;
}
.task-form-pane--relaxed-title .title-block {
  gap: 6.3px;
  margin-bottom: 0;
}
.task-form-pane--relaxed-title .title-block,
.task-form-pane--relaxed-title .description-block {
  box-sizing: border-box;
}
.task-form-pane--relaxed-title .title-input {
  @include mixin.input-border-default;
  border-radius: 8px;
  padding: 8.68px 10.5px;
  font-size: 12.6px;
  font-weight: 400;
  line-height: 1.35;
  background: #fff;
}
.task-form-pane--relaxed-title .title-input-placeholder {
  left: 10.5px;
  right: 10.5px;
  font-size: 12.6px;
  font-weight: 400;
  line-height: 1.35;
}
.description-input {
  @include mixin.description-textarea;
}
.title-input-wrap {
  position: relative;
  width: 100%;
}
.title-input {
  border: 1px solid transparent;
  border-radius: 8px;
  padding: 7px 8.4px;
  font-size: 25.2px;
  font-weight: 800;
  color: #0f172a;
  background: transparent;
  width: 100%;
  box-sizing: border-box;
  line-height: 1.25;
  display: block;
  outline: none;
  box-shadow: none;
}
.title-input-placeholder {
  position: absolute;
  top: 50%;
  left: 8.4px;
  right: 8.4px;
  transform: translateY(-50%);
  font-size: 25.2px;
  line-height: 1.25;
  color: #94a3b8;
  pointer-events: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.title-input:focus,
.title-input:focus-visible {
  @include mixin.input-focus-ring;
}
.action-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 5.6px;
}
.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 4.9px;
  border: 1px solid mixin.$border;
  border-radius: 8px;
  padding: 5.32px 9.8px;
  font-size: 11.76px;
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
.popover-layer {
  position: absolute;
  inset: 0;
  z-index: 8;
}
.popover-layer--portal {
  position: fixed;
  inset: 0;
  z-index: 75;
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
  width: min(259px, calc(100vw - 21px));
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 10px 32px rgba(15, 23, 42, 0.2);
  border: 1px solid #e2e8f0;
  padding: 10.5px;
  display: flex;
  flex-direction: column;
  gap: 9.1px;
}
.popover--date {
  overflow-x: hidden;
  overflow-y: auto;
  padding: 8.4px;
  gap: 7px;
}
.popover--members,
.popover--labels {
  width: min(273px, calc(100vw - 21px));
  min-height: 0;
  overflow: hidden;
  padding: 0;
  gap: 0;
}
.popover--members .empty-text,
.popover--members .err {
  margin-left: 9.1px;
  margin-right: 9.1px;
}
.popover-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.popover-header--labels {
  position: relative;
  justify-content: center;
  padding: 9.1px 28px 7.7px;
  border-bottom: 1px solid #dfe1e6;
}
.popover-header--labels .popover-close {
  position: absolute;
  right: 6.3px;
  top: 50%;
  transform: translateY(-50%);
}
.label-search-input {
  display: block;
  width: calc(100% - 18.2px);
  margin: 7.7px 9.1px 6.3px;
  box-sizing: border-box;
  border: 1px solid mixin.$border;
  border-radius: 6px;
  padding: 6.3px 7.7px;
  font-size: 12.32px;
  color: #172b4d;
}
.label-search-input:focus {
  @include mixin.input-focus-ring;
}
.label-section-heading {
  margin: 2.1px 9.1px 4.9px;
  font-size: 10.92px;
  font-weight: 700;
  color: #5e6c84;
}
.label-picker-list {
  list-style: none;
  margin: 0;
  padding: 0 7px 9.1px;
  display: flex;
  flex-direction: column;
  gap: 2.8px;
}
.label-picker-row {
  @include mixin.picker-checkbox-row;
  display: flex;
  align-items: center;
  gap: 5.6px;
  width: 100%;
  border: none;
  background: transparent;
  padding: 2.1px 0;
  text-align: left;
}
.label-picker-row:hover .label-picker-bar:not(.member-picker-bar) {
  filter: brightness(0.96);
}
.label-picker-checkbox {
  width: 14px;
  height: 14px;
  border: 2px solid #8590a2;
  border-radius: 3px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 10.08px;
  font-weight: 800;
  color: #fff;
  background: #fff;
}
.label-picker-checkbox--checked {
  background: #2563eb;
  border-color: #2563eb;
}
.label-picker-bar {
  flex: 1;
  min-height: 28px;
  border-radius: 4px;
  padding: 5.32px 7.7px;
  font-size: 12.32px;
  font-weight: 700;
  line-height: 1.25;
  display: flex;
  align-items: center;
}
.member-picker-bar {
  background: #fff;
  color: #172b4d;
  gap: 7px;
  transition: background 0.12s ease;
}
.label-picker-row.member-picker-row--workspace {
  border-radius: 4px;
  padding: 0 7.7px;
  transition: background 0.12s ease;
}
.label-picker-row.member-picker-row--workspace:hover {
  background: #f8fafc;
}
.member-picker-row--workspace .member-picker-bar {
  flex: 1;
  background: transparent;
  padding-left: 0;
  padding-right: 0;
}
.label-picker-row.member-picker-row--workspace:hover .member-picker-bar {
  background: transparent;
}
.member-picker-check {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 28px;
  padding: 0 2.1px;
  color: #2563eb;
}
.member-picker-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.label-picker-empty {
  padding: 0 9.1px 10.5px;
}
.popover--member-detail {
  padding: 0;
  width: min(238px, calc(100% - 21px));
  overflow: hidden;
  gap: 0;
}
.member-detail-card {
  display: flex;
  flex-direction: column;
}
.member-detail-header {
  position: relative;
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  padding: 14px 11.9px 16.8px;
  color: #fff;
}
.member-detail-close {
  position: absolute;
  top: 6.3px;
  right: 6.3px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.92);
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  padding: 2.8px 4.9px;
  border-radius: 6px;
}
.member-detail-close:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.15);
}
.member-detail-profile {
  display: flex;
  align-items: center;
  gap: 9.1px;
  padding-right: 17.5px;
}
.member-detail-avatar,
.member-detail-initial {
  width: 38.5px;
  height: 38.5px;
  border-radius: 999px;
  flex-shrink: 0;
  border: 2px solid rgba(255, 255, 255, 0.35);
  object-fit: cover;
}
.member-detail-initial {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #a67c52;
  color: #fff;
  font-size: 14px;
  font-weight: 800;
}
.member-detail-name {
  margin: 0;
  font-size: 14px;
  font-weight: 800;
  line-height: 1.25;
}
.member-detail-email {
  margin: 2.8px 0 0;
  font-size: 11.48px;
  color: rgba(255, 255, 255, 0.88);
  line-height: 1.3;
  word-break: break-all;
}
.member-detail-body {
  background: #fff;
}
.member-detail-remove {
  width: 100%;
  border: none;
  background: #fff;
  padding: 11.2px 12.6px;
  text-align: left;
  font-size: 12.6px;
  font-weight: 600;
  color: #334155;
  cursor: pointer;
}
.member-detail-remove:hover:not(:disabled) {
  background: #f8fafc;
}
.member-detail-error {
  margin: 0;
  padding: 7px 10.5px 10.5px;
}
.popover-fade-enter-active,
.popover-fade-leave-active {
  transition: opacity 0.22s ease;
}
.popover-fade-enter-from,
.popover-fade-leave-to {
  opacity: 0;
}
.detail-meta-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 14px 17.5px;
}
.detail-meta-row--schedule .detail-item--date,
.detail-meta-row--schedule .detail-item--effort {
  flex: 1 1 0;
  min-width: 77px;
}
.detail-meta-row--people .detail-item--members,
.detail-meta-row--people .detail-item--labels {
  flex: 1 1 0;
  min-width: min(100%, 140px);
}
.detail-chip-wrap {
  align-content: flex-start;
  box-sizing: border-box;
  padding: 3px;
}
.member-avatar-list.detail-chip-wrap {
  gap: 6.3px;
}
.detail-item--date {
  min-width: 0;
}
.detail-item--date .detail-value-btn {
  font-size: 16.8px;
  padding: 6.3px 9.8px;
}
.detail-item--effort .detail-value-btn {
  align-self: flex-start;
  box-sizing: border-box;
  font-size: 16.8px;
  line-height: 1.3;
  padding: 6.3px 9.8px;
  min-height: calc(16.8px * 1.3 + 12.6px);
}
.detail-item--effort .detail-value-btn:disabled {
  opacity: 1;
  color: #0f172a;
  cursor: default;
}
.detail-item--effort .detail-value-btn--editing {
  cursor: pointer;
}
.popover--effort {
  width: min(252px, calc(100vw - 21px));
  padding: 8.4px;
  gap: 7px;
}
.effort-input-row {
  display: flex;
  align-items: stretch;
  gap: 6.3px;
}
.popover--effort .effort-input {
  flex: 1 1 auto;
  min-width: 0;
  box-sizing: border-box;
  border: 1px solid mixin.$border;
  border-radius: 8px;
  padding: 6.3px 8.4px;
  font-size: 13.16px;
  color: #0f172a;
  background: #fff;
  @include mixin.hide-number-spin-buttons;
}
.popover--effort .effort-input:focus {
  @include mixin.input-focus-ring;
}
.popover--effort .effort-unit-label {
  flex: 0 0 auto;
  box-sizing: border-box;
  padding: 6.3px 7px;
  font-size: 12.32px;
  font-weight: 700;
  color: #64748b;
  white-space: nowrap;
}
.popover-field-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 7.7px;
}
.popover-field-clear-btn {
  min-width: 49px;
  height: 24.5px;
  padding: 0 9.1px;
  border: 1px solid mixin.$border-light;
  border-radius: 6px;
  background: #fff;
  color: mixin.$text-sub;
  font: inherit;
  font-size: 10.92px;
  font-weight: 600;
  cursor: pointer;
}
.popover-field-clear-btn:hover:not(:disabled) {
  background: rgba(15, 23, 42, 0.04);
  color: mixin.$text;
}
.popover-field-clear-btn:disabled {
  opacity: 0.45;
  cursor: default;
}
.detail-item {
  display: flex;
  flex-direction: column;
  gap: 4.9px;
}
.detail-item-label {
  font-size: 10.92px;
  font-weight: 700;
  color: #64748b;
}
.detail-value-btn {
  align-self: flex-start;
  border: none;
  border-radius: 6px;
  padding: 4.9px 7.7px;
  font-size: 12.88px;
  font-weight: 700;
  color: #0f172a;
  background: #fff;
  cursor: pointer;
}
.popover--date .calendar {
  padding: 7px;
}
.popover--date .calendar-nav {
  margin-bottom: 5.6px;
}
.popover--date .calendar-nav-btn {
  width: 24.5px;
  height: 24.5px;
  font-size: 14px;
}
.popover--date .calendar-month-label {
  font-size: 12.32px;
}
.popover--date .calendar-weekdays {
  margin-bottom: 2.1px;
}
.popover--date .calendar-grid {
  gap: 1.4px;
}
.popover--date .calendar-day {
  aspect-ratio: unset;
  min-height: 23.1px;
  padding: 1.4px 0;
  font-size: 11.2px;
}
.calendar {
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 10.5px;
  background: #f8fafc;
}
.calendar-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 9.1px;
}
.calendar-nav-btn {
  width: 28px;
  height: 28px;
  border: 1px solid mixin.$border;
  border-radius: 6px;
  background: #fff;
  color: #334155;
  font-size: 15.4px;
  cursor: pointer;
  line-height: 1;
}
.calendar-month-label {
  font-size: 13.3px;
  font-weight: 800;
  color: #0f172a;
}
.calendar-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2.1px;
  margin-bottom: 3.5px;
}
.calendar-weekday {
  text-align: center;
  font-size: 10.08px;
  font-weight: 700;
  color: #64748b;
}
.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2.1px;
}
.calendar-day {
  aspect-ratio: 1;
  border: 1px solid transparent;
  border-radius: 6px;
  background: #fff;
  color: #0f172a;
  font-size: 12.04px;
  font-weight: 600;
  cursor: pointer;
}
.calendar-day:hover:not(:disabled) {
  background: #e2e8f0;
}
.calendar-day--outside {
  color: #94a3b8;
  background: transparent;
}
.calendar-day--today {
  border-color: mixin.$main;
}
.calendar-day--selected {
  background: mixin.$main;
  color: mixin.$white;
  border-color: mixin.$main;
}
.label-chip-list {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4.9px;
}
.label-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 28px;
  box-sizing: border-box;
  padding: 0 7.7px;
  border: none;
  border-radius: 6px;
  font-size: 10.92px;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
  flex-shrink: 0;
  cursor: pointer;
}
.label-chip:hover:not(:disabled) {
  filter: brightness(0.94);
}
.label-chip-add {
  width: 28px;
  height: 28px;
  box-sizing: border-box;
  border: 1px solid mixin.$border;
  border-radius: 6px;
  padding: 0;
  background: #fff;
  color: #64748b;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.label-chip-add-plus {
  font-size: 16.1px;
  font-weight: 400;
  line-height: 1;
}
.empty-text {
  margin: 0;
  font-size: 11.76px;
  color: #94a3b8;
}
.description-block {
  flex-shrink: 0;
  min-width: 0;
}
.err {
  margin: 0;
  color: #b91c1c;
  font-weight: 700;
  font-size: 12.04px;
}
button:disabled:not(.label-picker-row):not(.parent-task-picker-row):not(.member-picker-row) {
  opacity: 0.55;
  cursor: not-allowed;
}
.member-avatar-list {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4.9px;
}
.member-avatar-btn {
  width: 28px;
  height: 28px;
  border-radius: 999px;
  border: none;
  padding: 0;
  background: transparent;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
}
.member-avatar-btn--add {
  border: 1px solid mixin.$border;
  background: #fff;
  color: #64748b;
}
.member-avatar-btn-plus {
  font-size: 16.8px;
  font-weight: 400;
  line-height: 1;
}
.member-avatar-btn--active {
  box-shadow: 0 0 0 2px #2563eb;
}
.member-avatar-btn-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 999px;
}
.member-avatar-btn-initial {
  width: 100%;
  height: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #dbeafe;
  color: #1e3a8a;
  font-size: 10.92px;
  font-weight: 800;
  border-radius: 999px;
}
.member-picker-avatar {
  flex-shrink: 0;
}
</style>
