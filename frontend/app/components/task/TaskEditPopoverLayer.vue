<template>
  <Teleport to="body">
    <Transition name="popover-fade" @after-enter="updatePopoverPosition">
      <div
        v-if="activePopover"
        :key="activePopover === 'member-detail' ? `member-detail-${selectedMember?.id}` : activePopover"
        class="popover-layer popover-layer--portal popover-layer--wbs"
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
            <span class="effort-unit-label">{{ effortUnitLabel(orgEffortUnit) }}</span>
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
            <div class="member-detail-body">
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
            placeholder="担当者を検索..."
            :disabled="disabled"
            @click.stop
          />

          <p class="label-section-heading">担当者</p>

          <div class="popover-scroll">
            <ul class="label-picker-list">
              <li v-for="member in filteredProjectMembers" :key="member.id">
                <button
                  type="button"
                  class="label-picker-row"
                  @click.stop="toggleMember(member)"
                >
                  <span
                    class="label-picker-checkbox"
                    :class="{ 'label-picker-checkbox--checked': isMemberAssigned(member.id) }"
                    aria-hidden="true"
                  >
                    <span v-if="isMemberAssigned(member.id)">✓</span>
                  </span>
                  <span class="label-picker-bar member-picker-bar">
                    {{ memberDisplayName(member) }}
                  </span>
                </button>
              </li>
            </ul>
            <p v-if="!projectMembers.length" class="empty-text label-picker-empty">プロジェクトメンバーがいません。</p>
            <p v-else-if="!filteredProjectMembers.length" class="empty-text label-picker-empty">該当する担当者がいません。</p>

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
                v-for="list in projectLists"
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
            <p v-if="!projectLists.length" class="empty-text list-picker-empty">
              リストがありません。
            </p>
            <p v-if="popoverError" class="err">{{ popoverError }}</p>
          </div>
        </PopoverShell>

        <PopoverShell
          v-else-if="activePopover === 'description'"
          ref="popoverElRef"
          shell-class="popover popover--description"
          :style="popoverStyle"
          title="説明"
          aria-label="説明"
          :close-disabled="disabled"
          @close="closePopover"
        >
          <textarea
            v-model="descriptionDraft"
            class="description-input"
            rows="6"
            :maxlength="TASK_DESCRIPTION_MAX_LENGTH"
            aria-label="説明"
            :disabled="disabled || descriptionSaving"
            @blur="void saveDescription()"
          />
          <p v-if="popoverError" class="err">{{ popoverError }}</p>
        </PopoverShell>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import {
  useTaskPopoverEditor,
  type PopoverType,
  type ProjectListOption,
  type TaskPopoverEditable,
} from '../../composables/useTaskPopoverEditor'
import type { TaskFormLabel, TaskFormMember } from '../../composables/useTaskFormHelpers'
import { TASK_DESCRIPTION_MAX_LENGTH } from '../../constants/fieldLengthLimits'
import { memberDisplayName, memberInitial } from '../../composables/useMemberDisplay'
import PopoverShell from '../ui/PopoverShell.vue'

const props = withDefaults(defineProps<{
  orgSlug: string
  projectId: string
  orgLabels: TaskFormLabel[]
  projectMembers: TaskFormMember[]
  projectLists: ProjectListOption[]
  disabled?: boolean
}>(), {
  disabled: false,
})

const emit = defineEmits<{
  updated: [TaskPopoverEditable]
  'popover-active-change': [{ taskId: number | null; popover: PopoverType | null }]
}>()

const taskRef = ref<TaskPopoverEditable | null>(null)
const memberSearchQuery = ref('')

function bindTask (task: TaskPopoverEditable | null) {
  if (taskRef.value?.id !== task?.id) {
    void closePopover()
  }
  taskRef.value = task
}

const {
  orgEffortUnit,
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
  openMemberPicker,
  openMemberDetail,
  openLabelPicker,
  openDescriptionPicker,
  openListPicker,
  listSaving,
  selectList,
  isMemberAssigned,
  isLabelSelected,
  toggleMember,
  removeMember,
  toggleLabel,
  saveDescription,
  updatePopoverPosition,
} = useTaskPopoverEditor({
  orgSlug: props.orgSlug,
  projectId: props.projectId,
  orgLabels: toRef(props, 'orgLabels'),
  projectMembers: toRef(props, 'projectMembers'),
  projectLists: toRef(props, 'projectLists'),
  task: taskRef,
  disabled: computed(() => props.disabled),
  onUpdated: (task) => emit('updated', task),
  zIndex: 80,
})

watch(
  [activePopover, () => taskRef.value?.id ?? null],
  ([popover, taskId]) => {
    emit('popover-active-change', { taskId, popover })
  },
  { flush: 'sync' },
)

const filteredProjectMembers = computed(() => {
  const query = memberSearchQuery.value.trim().toLowerCase()
  if (!query) return props.projectMembers
  return props.projectMembers.filter((member) => {
    const name = memberDisplayName(member).toLowerCase()
    const email = (member.email ?? '').toLowerCase()
    return name.includes(query) || email.includes(query)
  })
})

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
  activePopover,
})
</script>

<style lang="scss" scoped>
.popover-layer--portal {
  position: fixed;
  inset: 0;
  z-index: 80;
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
  width: min(18.5rem, calc(100vw - 1.5rem));
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 10px 32px rgba(15, 23, 42, 0.2);
  border: 1px solid #e2e8f0;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.popover--date {
  overflow-x: hidden;
  overflow-y: auto;
  padding: 0.6rem;
  gap: 0.5rem;
}

.popover--members,
.popover--labels {
  width: min(19.5rem, calc(100vw - 1.5rem));
  min-height: 0;
  overflow: hidden;
  padding: 0;
  gap: 0;
}

.popover--members .empty-text,
.popover--members .err {
  margin-left: 0.65rem;
  margin-right: 0.65rem;
}

.popover--description {
  width: min(22rem, calc(100vw - 1.5rem));
  min-height: 0;
  overflow: hidden;
  padding: 0;
  gap: 0;
}

.popover--description .description-input {
  @include mixin.description-textarea;
  margin: 0.65rem;
  width: calc(100% - 1.3rem);
  min-height: 8rem;
}

.popover--description .err {
  margin: 0 0.65rem 0.65rem;
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
  padding: 0.65rem 2rem 0.55rem;
  border-bottom: 1px solid #dfe1e6;
}

.popover-header--labels :deep(.popover-shell__close) {
  position: absolute;
  right: 0.45rem;
  top: 50%;
  transform: translateY(-50%);
}

.label-search-input {
  display: block;
  width: calc(100% - 1.3rem);
  margin: 0.55rem 0.65rem 0.45rem;
  box-sizing: border-box;
  border: 1px solid mixin.$border;
  border-radius: 6px;
  padding: 0.45rem 0.55rem;
  font-size: 0.88rem;
  color: #172b4d;
}

.label-search-input:focus {
  @include mixin.input-focus-ring;
}

.label-section-heading {
  margin: 0.15rem 0.65rem 0.35rem;
  font-size: 0.78rem;
  font-weight: 700;
  color: #5e6c84;
}

.label-picker-list {
  list-style: none;
  margin: 0;
  padding: 0 0.5rem 0.65rem;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.label-picker-row {
  @include mixin.picker-checkbox-row;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  width: 100%;
  border: none;
  background: transparent;
  padding: 0.15rem 0;
  text-align: left;
}

.label-picker-row:hover .label-picker-bar {
  filter: brightness(0.96);
}

.label-picker-checkbox {
  width: 1rem;
  height: 1rem;
  border: 2px solid #8590a2;
  border-radius: 3px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.72rem;
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
  min-height: 2rem;
  border-radius: 4px;
  padding: 0.38rem 0.55rem;
  font-size: 0.88rem;
  font-weight: 700;
  line-height: 1.25;
  display: flex;
  align-items: center;
}

.member-picker-bar {
  background: #f8fafc;
  color: #172b4d;
}

.label-picker-empty {
  padding: 0 0.65rem 0.75rem;
}

.popover--member-detail {
  padding: 0;
  width: min(17rem, calc(100% - 1.5rem));
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
  padding: 1rem 0.85rem 1.2rem;
  color: #fff;
}

.member-detail-close {
  position: absolute;
  top: 0.45rem;
  right: 0.45rem;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.92);
  font-size: 1rem;
  line-height: 1;
  cursor: pointer;
  padding: 0.2rem 0.35rem;
  border-radius: 6px;
}

.member-detail-close:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.15);
}

.member-detail-profile {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding-right: 1.25rem;
}

.member-detail-avatar,
.member-detail-initial {
  width: 2.75rem;
  height: 2.75rem;
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
  font-size: 1rem;
  font-weight: 800;
}

.member-detail-name {
  margin: 0;
  font-size: 1rem;
  font-weight: 800;
  line-height: 1.25;
}

.member-detail-email {
  margin: 0.2rem 0 0;
  font-size: 0.82rem;
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
  padding: 0.8rem 0.9rem;
  text-align: left;
  font-size: 0.9rem;
  font-weight: 600;
  color: #334155;
  cursor: pointer;
}

.member-detail-remove:hover:not(:disabled) {
  background: #f8fafc;
}

.member-detail-error {
  margin: 0;
  padding: 0.5rem 0.75rem 0.75rem;
}

.popover-fade-enter-active,
.popover-fade-leave-active {
  transition: opacity 0.22s ease;
}

.popover-fade-enter-from,
.popover-fade-leave-to {
  opacity: 0;
}

.popover--effort {
  width: min(18rem, calc(100vw - 1.5rem));
  padding: 0.6rem;
  gap: 0.5rem;
}

.effort-input-row {
  display: flex;
  align-items: stretch;
  gap: 0.45rem;
}

.popover--effort .effort-input {
  flex: 1 1 auto;
  min-width: 0;
  box-sizing: border-box;
  border: 1px solid mixin.$border;
  border-radius: 8px;
  padding: 0.45rem 0.6rem;
  font-size: 0.94rem;
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
  padding: 0.45rem 0.5rem;
  font-size: 0.88rem;
  font-weight: 700;
  color: #64748b;
  white-space: nowrap;
}

.popover-field-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 0.55rem;
}

.popover-field-clear-btn {
  min-width: 3.5rem;
  height: 1.75rem;
  padding: 0 0.65rem;
  border: 1px solid mixin.$border-light;
  border-radius: 6px;
  background: #fff;
  color: mixin.$text-sub;
  font: inherit;
  font-size: 0.78rem;
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

.popover--date .calendar {
  padding: 0.5rem;
}

.popover--date .calendar-nav {
  margin-bottom: 0.4rem;
}

.popover--date .calendar-nav-btn {
  width: 1.75rem;
  height: 1.75rem;
  font-size: 1rem;
}

.popover--date .calendar-month-label {
  font-size: 0.88rem;
}

.popover--date .calendar-weekdays {
  margin-bottom: 0.15rem;
}

.popover--date .calendar-grid {
  gap: 0.1rem;
}

.popover--date .calendar-day {
  aspect-ratio: unset;
  min-height: 1.65rem;
  padding: 0.1rem 0;
  font-size: 0.8rem;
}

.calendar {
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 0.75rem;
  background: #f8fafc;
}

.calendar-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.65rem;
}

.calendar-nav-btn {
  width: 2rem;
  height: 2rem;
  border: 1px solid mixin.$border;
  border-radius: 6px;
  background: #fff;
  color: #334155;
  font-size: 1.1rem;
  cursor: pointer;
  line-height: 1;
}

.calendar-month-label {
  font-size: 0.95rem;
  font-weight: 800;
  color: #0f172a;
}

.calendar-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 0.15rem;
  margin-bottom: 0.25rem;
}

.calendar-weekday {
  text-align: center;
  font-size: 0.72rem;
  font-weight: 700;
  color: #64748b;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 0.15rem;
}

.calendar-day {
  aspect-ratio: 1;
  border: 1px solid transparent;
  border-radius: 6px;
  background: #fff;
  color: #0f172a;
  font-size: 0.86rem;
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


.empty-text {
  margin: 0;
  font-size: 0.84rem;
  color: #94a3b8;
}

.err {
  margin: 0;
  color: #b91c1c;
  font-weight: 700;
  font-size: 0.86rem;
}

.popover--list {
  width: min(19.5rem, calc(100vw - 1.5rem));
}

.list-picker-list {
  list-style: none;
  margin: 0;
  padding: 0.5rem 0.65rem 0.65rem;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.list-picker-row {
  @include mixin.picker-checkbox-row;
  display: flex;
  align-items: center;
  gap: 0.55rem;
  width: 100%;
  border: none;
  border-radius: 8px;
  padding: 0.45rem 0.35rem;
  background: transparent;
  text-align: left;
}

.list-picker-row:hover {
  background: #f8fafc;
}

.list-picker-row--selected {
  background: color-mix(in srgb, mixin.$main 8%, mixin.$white);
}

.list-picker-radio {
  width: 1rem;
  height: 1rem;
  border: 2px solid #8590a2;
  border-radius: 50%;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #fff;
}

.list-picker-radio--checked {
  border-color: mixin.$main;
  background: mixin.$main;
}

.list-picker-radio--checked::after {
  content: '✓';
  font-size: 0.62rem;
  font-weight: 800;
  line-height: 1;
  color: mixin.$white;
}

.list-picker-label {
  flex: 1;
  min-width: 0;
  font-size: 0.88rem;
  font-weight: 600;
  line-height: 1.35;
  color: mixin.$text;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.list-picker-empty {
  margin: 0.55rem 0.65rem 0.65rem;
}

button:disabled:not(.label-picker-row):not(.member-picker-row):not(.list-picker-row) {
  opacity: 0.55;
  cursor: not-allowed;
}
</style>
