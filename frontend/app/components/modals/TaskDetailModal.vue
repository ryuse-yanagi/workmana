<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      ref="overlayRef"
      class="modal-overlay"
      :class="{ 'modal-overlay--popover-open': !!activePopover }"
      role="presentation"
      @mousedown="onOverlayMouseDown"
    >
        <section
          ref="modalCardRef"
          class="modal-card"
          role="dialog"
          aria-modal="true"
          aria-label="タスク詳細"
        >
          <header class="modal-header">
            <h3>タスク詳細</h3>
            <button
              type="button"
              class="icon-close"
              :disabled="saving"
              @click="close"
            >✕</button>
          </header>
          <div v-if="loading" class="modal-body modal-body--state">
            <p class="state-message">読み込み中...</p>
          </div>
          <div v-else-if="loadError" class="modal-body modal-body--state">
            <p class="err">{{ loadError }}</p>
            <div class="actions">
              <button type="button" class="ghost-btn" @click="close">閉じる</button>
              <button type="button" class="primary-btn" @click="reload">再試行</button>
            </div>
          </div>
          <div v-else class="modal-split">
            <div ref="modalBodyRef" class="modal-pane modal-pane--detail">
            <section class="field-block title-block">
              <button
                v-if="showParentTaskControl"
                type="button"
                class="task-detail-parent-task"
                :class="{ 'task-detail-parent-task--placeholder': !task?.parent_task_id }"
                :disabled="saving || parentTaskSaving"
                @click="openParentTaskPicker($event)"
              >
                {{ parentTaskButtonLabel }}
              </button>
              <div class="title-input-wrap">
                <textarea
                  ref="titleTextareaRef"
                  v-model.trim="titleDraft"
                  :maxlength="TASK_TITLE_MAX_LENGTH"
                  class="title-input"
                  aria-label="タスク名"
                  :disabled="saving || titleSaving"
                  rows="1"
                  @input="adjustTitleTextareaHeight"
                  @compositionstart="titleComposing = true"
                  @compositionend="titleComposing = false"
                  @blur="onTitleBlur"
                  @keydown.enter.prevent="onTitleEnter"
                  @keydown.escape.prevent.stop="revertTitleDraft"
                />
                <span
                  v-if="showTitlePlaceholder"
                  class="title-input-placeholder"
                  aria-hidden="true"
                >タスク名</span>
              </div>
            </section>
            <div ref="actionButtonsRef" class="action-buttons">
              <button
                type="button"
                class="action-btn"
                :class="{ 'action-btn--active': activePopover === 'start-date' }"
                :disabled="saving"
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
                :disabled="saving"
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
                :disabled="saving || effortSaving"
                @click="openEffortPicker($event)"
              >
                <span class="action-btn-icon" aria-hidden="true">
                  <Clock :size="16" :stroke-width="2.25" />
                </span>
                工数
              </button>
              <button
                type="button"
                class="action-btn"
                :class="{ 'action-btn--active': activePopover === 'members' }"
                :disabled="saving"
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
                :disabled="saving"
                @click="openLabelPicker($event)"
              >
                <span class="action-btn-icon" aria-hidden="true">
                  <Tags :size="16" :stroke-width="2.25" />
                </span>
                ラベル
              </button>
              <button
                type="button"
                class="action-btn"
                :class="{ 'action-btn--active': activePopover === 'checklist-create' }"
                :disabled="saving"
                @click="openChecklistPicker($event)"
              >
                <span class="action-btn-icon" aria-hidden="true">
                  <ListChecks :size="16" :stroke-width="2.25" />
                </span>
                チェックリスト
              </button>
            </div>
            <div
              v-if="(task?.start_date || task?.due_date) || showEffortDetailSection"
              class="detail-meta-row detail-meta-row--schedule"
            >
              <section v-if="task?.start_date" class="detail-item detail-item--date">
                <span class="detail-item-label">開始日</span>
                <button
                  type="button"
                  class="detail-value-btn"
                  :disabled="saving"
                  @click="openDatePicker('start', $event)"
                >
                  {{ formatDateDisplay(task.start_date) }}
                </button>
              </section>
              <section v-if="task?.due_date" class="detail-item detail-item--date">
                <span class="detail-item-label">終了日</span>
                <button
                  type="button"
                  class="detail-value-btn"
                  :disabled="saving"
                  @click="openDatePicker('due', $event)"
                >
                  {{ formatDateDisplay(task.due_date) }}
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
                  :disabled="saving || effortSaving"
                  :aria-live="activePopover === 'effort' ? 'polite' : undefined"
                  @click="openEffortPicker($event)"
                >
                  {{ effortDetailDisplayText }}
                </button>
              </section>
            </div>
            <div
              v-if="(task?.assignees ?? []).length || (task?.labels ?? []).length"
              class="detail-meta-row detail-meta-row--people"
            >
              <section
                v-if="(task?.assignees ?? []).length"
                class="detail-item detail-item--members"
              >
                <span class="detail-item-label">担当者</span>
                <div class="member-avatar-list detail-chip-wrap">
                  <button
                    v-for="member in task?.assignees ?? []"
                    :key="member.id"
                    type="button"
                    class="member-avatar-btn"
                    :disabled="saving"
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
                    :disabled="saving"
                    aria-label="担当者を追加"
                    @click="openMemberPicker($event)"
                  >
                    <span class="member-avatar-btn-plus" aria-hidden="true">+</span>
                  </button>
                </div>
              </section>
              <section
                v-if="(task?.labels ?? []).length"
                class="detail-item detail-item--labels"
              >
                <span class="detail-item-label">ラベル</span>
                <div class="label-chip-list detail-chip-wrap">
                  <button
                    v-for="label in task?.labels"
                    :key="label.id"
                    type="button"
                    class="label-chip"
                    :style="{
                      backgroundColor: label.color,
                      color: labelBarTextColor(label.color),
                    }"
                    :disabled="saving"
                    :aria-label="`ラベル: ${label.name}`"
                    @click="openLabelPicker($event)"
                  >
                    {{ label.name }}
                  </button>
                  <button
                    type="button"
                    class="label-chip-add"
                    :disabled="saving"
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
                ref="descriptionTextareaRef"
                v-model="descriptionDraft"
                class="description-input"
                rows="1"
                :maxlength="TASK_DESCRIPTION_MAX_LENGTH"
                aria-label="説明"
                :disabled="saving || descriptionSaving"
                @input="adjustDescriptionTextareaHeight"
                @blur="onDescriptionBlur"
              />
            </section>
            <div
              v-if="checklist"
              ref="checklistBlockRef"
              class="task-checklist-wrap"
            >
              <TaskDetailChecklistBlock
                :checklist="checklist"
                :show-add-form="checklistAddFormOpen"
                @update="updateCurrentChecklist"
                @update:show-add-form="checklistAddFormOpen = $event"
                @delete="deleteCurrentChecklist"
              />
            </div>
            <TaskDetailHierarchyBlock
              v-if="showHierarchySection"
              :parent-task="hierarchyParent"
              :child-tasks="hierarchyChildTasks"
            />
            <p v-if="saveError" class="err">{{ saveError }}</p>
            <Teleport to="body">
              <Transition name="popover-fade" @after-enter="updatePopoverPosition">
                <div
                  v-if="modelValue && activePopover"
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
                  :close-disabled="saving"
                  @close="closePopover"
                >
                <div class="calendar">
                  <div class="calendar-nav">
                    <button
                      type="button"
                      class="calendar-nav-btn"
                      :disabled="saving"
                      aria-label="前の月"
                      @click="shiftCalendarMonth(-1)"
                    >‹</button>
                    <span class="calendar-month-label">{{ calendarMonthLabel }}</span>
                    <button
                      type="button"
                      class="calendar-nav-btn"
                      :disabled="saving"
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
                        'calendar-day--selected': cell.iso === pendingDate,
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
                    :disabled="saving || dateSaving || !canClearCalendarDate"
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
                :close-disabled="saving || effortSaving"
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
                    :disabled="saving || effortSaving"
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
                    :disabled="saving || effortSaving || !canClearEffort"
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
                      :disabled="saving"
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
                      :disabled="saving"
                      @click.stop="removeMemberFromTask(selectedMember)"
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
                :close-disabled="saving"
                @close="closePopover"
              >
                <input
                  v-model="memberSearchQuery"
                  type="search"
                  class="label-search-input"
                  placeholder="担当者を検索..."
                  :disabled="saving"
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
                  <p v-if="!workspaceMembers.length" class="empty-text label-picker-empty">ワークスペースメンバーがいません。</p>
                  <p v-else-if="!filteredProjectMembers.length" class="empty-text label-picker-empty">該当する担当者がいません。</p>
                  <p v-if="popoverError" class="err">{{ popoverError }}</p>
                </div>
              </PopoverShell>
              <PopoverShell
                v-else-if="activePopover === 'parent-task'"
                ref="popoverElRef"
                shell-class="popover popover--parent-task"
                :style="popoverStyle"
                title="親タスク"
                aria-label="親タスク"
                :close-disabled="parentTaskSaving"
                @close="closePopover"
              >
                <ParentTaskPickerPanel
                  :loading="parentTasksLoading"
                  :parents="parentTasks"
                  :selected-parent-id="task?.parent_task_id ?? null"
                  :clear-disabled="parentTaskSaving"
                  :error="popoverError"
                  @select="selectParentTask($event)"
                  @clear="selectParentTask(null)"
                />
              </PopoverShell>
              <PopoverShell
                v-else-if="activePopover === 'labels'"
                ref="popoverElRef"
                shell-class="popover popover--labels"
                header-class="popover-header--labels"
                :style="popoverStyle"
                title="ラベル"
                aria-label="ラベル"
                :close-disabled="saving"
                @close="closePopover"
              >
                <input
                  v-model="labelSearchQuery"
                  type="search"
                  class="label-search-input"
                  placeholder="ラベルを検索..."
                  :disabled="saving"
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
                v-else-if="activePopover === 'checklist-create'"
                ref="popoverElRef"
                shell-class="popover popover--checklist-create"
                :style="popoverStyle"
                title="チェックリスト"
                aria-label="チェックリスト"
                @close="closePopover"
              >
                <input
                  ref="checklistTitleInputRef"
                  v-model="checklistTitleDraft"
                  type="text"
                  class="checklist-create-input"
                  :maxlength="CHECKLIST_TITLE_MAX_LENGTH"
                  placeholder="タイトル"
                  aria-label="チェックリストのタイトル"
                  @keydown.enter.prevent="submitChecklistCreate"
                  @click.stop
                />
                <div class="checklist-create-actions">
                  <button
                    type="button"
                    class="checklist-create-submit"
                    @click.stop="submitChecklistCreate"
                  >
                    追加
                  </button>
                </div>
              </PopoverShell>
              </div>
              </Transition>
            </Teleport>
            </div>
            <TaskDetailChatPane
              :org-slug="orgSlug"
              :workspace-id="workspaceId"
              :task-id="taskId"
              :workspace-members="workspaceMembers"
              :initial-comments="initialComments"
              @comments-updated="emit('comments-updated', $event)"
            />
          </div>
        </section>
    </div>
  </Teleport>
</template>
<script setup lang="ts">
import {
  CalendarCheck,
  CalendarDays,
  Clock,
  ListChecks,
  Tags,
  Users,
} from 'lucide-vue-next'
import ParentTaskPickerPanel from '../task/ParentTaskPickerPanel.vue'
import TaskDetailChecklistBlock, {
  type TaskChecklist,
} from '../task/TaskDetailChecklistBlock.vue'
import TaskDetailHierarchyBlock, {
  type TaskHierarchyChild,
  type TaskHierarchyParent,
} from '../task/TaskDetailHierarchyBlock.vue'
import { useApi } from '../../composables/useApi'
import {
  effortUnitLabel,
  parseEffortDraft,
  resolveEffortUnit,
  sanitizeEffortDraftInput,
} from '../../composables/useTaskFormHelpers'
import { useOrgEffortUnit } from '../../composables/useOrgEffortSettings'
import { memberDisplayName, memberInitial } from '../../composables/useMemberDisplay'
import type { TaskDetailComment } from '../task/taskCommentTypes'
import { createOverlayBackdropClose, dismissPopoverFromOutsidePointer, getTopmostModalOverlay } from '../../utils/uiInteraction'
import {
  CHECKLIST_TITLE_MAX_LENGTH,
  TASK_DESCRIPTION_MAX_LENGTH,
  TASK_TITLE_MAX_LENGTH,
} from '../../constants/fieldLengthLimits'
import {
  isTaskInHierarchy,
  resolveTaskHierarchyFromTasks,
  type TaskHierarchySource,
} from '../../composables/useTaskHierarchy'
import { resolveLabelColors } from '../../utils/colorPresetResolution'
export type TaskDetailLabel = { id: number; name: string; color: string }
export type TaskDetailMember = {
  id: number
  name: string | null
  email: string | null
  avatar_url: string | null
}
export type TaskDetail = {
  id: number
  title: string
  description: string | null
  status: string
  list_id: number | null
  start_date: string | null
  due_date: string | null
  effort_hours: number | string | null
  effort_value?: number | string | null
  effort_unit?: EffortUnit | string | null
  assignees: TaskDetailMember[]
  labels: TaskDetailLabel[]
  checklist?: TaskChecklist | null
  is_parent_task?: boolean
  parent_task_id?: number | null
  parent_task?: TaskHierarchyParent | null
  child_tasks?: TaskHierarchyChild[]
}
type ParentTaskOption = { id: number; title: string }
type EffortUnit = 'minute' | 'hour' | 'day'
type PopoverType = 'start-date' | 'due-date' | 'effort' | 'members' | 'member-detail' | 'labels' | 'parent-task' | 'checklist-create'
type DatePickerTarget = 'start' | 'due'
type CalendarCell = {
  key: string
  iso: string
  day: number
  inMonth: boolean
  isToday: boolean
}
export type TaskDetailRemotePatch = Pick<TaskDetail, 'id'> & Partial<Omit<TaskDetail, 'id'>>
const props = defineProps<{
  modelValue: boolean
  orgSlug: string
  workspaceId: string
  taskId: number | null
  orgLabels: TaskDetailLabel[]
  workspaceMembers: TaskDetailMember[]
  /** ボード画面で取得済みのタスク詳細（あれば読み込み画面を出さない） */
  initialTaskDetail?: TaskDetail | null
  /** ボード画面で取得済みの親タスク一覧 */
  initialParentTasks?: ParentTaskOption[] | null
  /** 親子関係の即時表示用（ボード上のタスク一覧） */
  hierarchyTasks?: TaskHierarchySource[] | null
  /** ボード画面で取得済みのコメント */
  initialComments?: TaskDetailComment[] | null
  /** 他クライアントからの TaskUpdated など（rev が変わるたびに適用） */
  remoteUpdate?: TaskDetailRemotePatch | null
  remoteUpdateRev?: number
}>()
const emit = defineEmits<{
  'update:modelValue': [boolean]
  updated: [TaskDetail]
  'comments-updated': [{ taskId: number; comments: TaskDetailComment[] }]
}>()
const { api } = useApi()
const { orgEffortUnit, ensureOrgEffortUnit } = useOrgEffortUnit(() => props.orgSlug)
const task = ref<TaskDetail | null>(null)
const loading = ref(false)
const saving = ref(false)
const dateSaving = ref(false)
const loadError = ref<string | null>(null)
const saveError = ref<string | null>(null)
const ignoreOverlayCloseUntil = ref(0)
/** モーダル内で押し始めた操作（文字選択ドラッグなど）では外側で離しても閉じない */
const activePopover = ref<PopoverType | null>(null)
const selectedMember = ref<TaskDetailMember | null>(null)
const popoverError = ref<string | null>(null)
const popoverStyle = ref<Record<string, string>>({})
const modalCardRef = ref<HTMLElement | null>(null)
const overlayRef = ref<HTMLElement | null>(null)
const modalBodyRef = ref<HTMLElement | null>(null)
const popoverElRef = ref<{ rootRef: HTMLElement | null } | HTMLElement | null>(null)
function resolvePopoverElement (): HTMLElement | null {
  const target = popoverElRef.value
  if (!target) {
    return null
  }
  if (target instanceof HTMLElement) {
    return target
  }
  return target.rootRef
}
const actionButtonsRef = ref<HTMLElement | null>(null)
const effortDetailAnchorRef = ref<HTMLElement | null>(null)
const popoverAnchorEl = ref<HTMLElement | null>(null)
const calendarCursor = ref(new Date())
const pendingDate = ref<string | null>(null)
const titleDraft = ref('')
const titleComposing = ref(false)
const titleSaving = ref(false)
const titleTextareaRef = ref<HTMLTextAreaElement | null>(null)
const descriptionTextareaRef = ref<HTMLTextAreaElement | null>(null)
const showTitlePlaceholder = computed(() => {
  if (titleComposing.value) return false
  return titleDraft.value.length === 0
})
const descriptionDraft = ref('')
const descriptionSaving = ref(false)
const labelSearchQuery = ref('')
const memberSearchQuery = ref('')
const checklistTitleDraft = ref('')
const checklistAddFormOpen = ref(false)
const checklistSaving = ref(false)
const checklist = ref<TaskChecklist | null>(null)
const checklistBlockRef = ref<HTMLElement | null>(null)
const checklistTitleInputRef = ref<HTMLInputElement | null>(null)
let checklistSaveTimer: ReturnType<typeof setTimeout> | null = null
let checklistSaveSeq = 0
let lastPersistedChecklist: TaskChecklist | null = null
function clearChecklistSaveTimer () {
  if (checklistSaveTimer) {
    clearTimeout(checklistSaveTimer)
    checklistSaveTimer = null
  }
}
const effortDraft = ref<string | number>('')
const effortSaving = ref(false)
const effortInputRef = ref<HTMLInputElement | null>(null)
const parentTasks = ref<ParentTaskOption[]>([])
const parentTasksLoading = ref(false)
const parentTaskSaving = ref(false)
const pickerMutationPending = ref(false)
const showParentTaskControl = computed(() => {
  return Boolean(task.value && !task.value.is_parent_task)
})
function toHierarchyTaskRef (detail: TaskDetail): TaskHierarchySource {
  return {
    id: detail.id,
    title: detail.title,
    is_parent_task: detail.is_parent_task,
    parent_task_id: detail.parent_task_id ?? null,
    due_date: detail.due_date,
    list_id: detail.list_id,
  }
}
const hierarchyTaskSources = computed((): TaskHierarchySource[] => {
  const base = props.hierarchyTasks ?? []
  const current = task.value
  if (!current) {
    return base
  }
  const currentSource = toHierarchyTaskRef(current)
  const index = base.findIndex(row => row.id === current.id)
  if (index < 0) {
    return [...base, currentSource]
  }
  const next = base.slice()
  next[index] = { ...base[index]!, ...currentSource }
  return next
})
const resolvedHierarchy = computed((): {
  parent_task: TaskHierarchyParent | null
  child_tasks: TaskHierarchyChild[]
} => {
  const current = task.value
  if (!current || !isTaskInHierarchy(current)) {
    return { parent_task: null, child_tasks: [] }
  }
  if (hierarchyTaskSources.value.length > 0) {
    const resolved = resolveTaskHierarchyFromTasks(
      toHierarchyTaskRef(current),
      hierarchyTaskSources.value,
    )
    if (resolved.parent_task) {
      return resolved
    }
    if (current.parent_task_id != null) {
      const parent = parentTasks.value.find(item => item.id === current.parent_task_id)
      if (parent) {
        return {
          ...resolved,
          parent_task: { id: parent.id, title: parent.title },
        }
      }
    }
    return resolved
  }
  if (current.parent_task) {
    return {
      parent_task: current.parent_task,
      child_tasks: current.child_tasks ?? [],
    }
  }
  if (current.is_parent_task) {
    return {
      parent_task: { id: current.id, title: current.title },
      child_tasks: current.child_tasks ?? [],
    }
  }
  if (current.parent_task_id != null) {
    const parent = parentTasks.value.find(item => item.id === current.parent_task_id)
    return {
      parent_task: parent ? { id: parent.id, title: parent.title } : null,
      child_tasks: current.child_tasks ?? [],
    }
  }
  return { parent_task: null, child_tasks: [] }
})
const hierarchyParent = computed((): TaskHierarchyParent | null => {
  return resolvedHierarchy.value.parent_task
})
const hierarchyChildTasks = computed((): TaskHierarchyChild[] => {
  return resolvedHierarchy.value.child_tasks
})
const showHierarchySection = computed(() => {
  return isTaskInHierarchy(task.value)
})
const parentTaskButtonLabel = computed(() => {
  if (!task.value?.parent_task_id) {
    return '親タスク'
  }
  const parent = parentTasks.value.find(item => item.id === task.value!.parent_task_id)
  return parent?.title ?? '親タスク'
})
const showEffortDetailSection = computed(() => {
  if (!task.value) return false
  if (activePopover.value === 'effort') {
    const parsed = parseEffortDraft(effortDraft.value)
    return parsed !== null && parsed !== 'invalid'
  }
  return resolveStoredEffortValue(task.value) !== null
})
const effortDetailDisplayText = computed(() => {
  if (activePopover.value === 'effort') {
    const parsed = parseEffortDraft(effortDraft.value)
    if (parsed === null || parsed === 'invalid') {
      return ''
    }
    const unit = resolveEffortUnit(null, orgEffortUnit.value)
    return `${formatEffortAmount(parsed)} ${effortUnitLabel(unit)}`
  }
  if (!task.value) {
    return ''
  }
  return formatEffortDisplayForTask(task.value)
})
const canClearCalendarDate = computed(() => !!pendingDate.value)
const canClearEffort = computed(() => {
  if (String(effortDraft.value ?? '').trim() !== '') {
    return true
  }
  if (!task.value) {
    return false
  }
  return resolveStoredEffortValue(task.value) !== null
})
const filteredOrgLabels = computed(() => {
  const query = labelSearchQuery.value.trim().toLowerCase()
  if (!query) return props.orgLabels
  return props.orgLabels.filter(label => label.name.toLowerCase().includes(query))
})
const filteredProjectMembers = computed(() => {
  const query = memberSearchQuery.value.trim().toLowerCase()
  if (!query) return props.workspaceMembers
  return props.workspaceMembers.filter((member) => {
    const name = memberDisplayName(member).toLowerCase()
    const email = (member.email ?? '').toLowerCase()
    return name.includes(query) || email.includes(query)
  })
})
const weekdayLabels = ['日', '月', '火', '水', '木', '金', '土']
const calendarMonthLabel = computed(() => {
  const y = calendarCursor.value.getFullYear()
  const m = calendarCursor.value.getMonth() + 1
  return `${y}年${m}月`
})
const calendarCells = computed((): CalendarCell[] => {
  const year = calendarCursor.value.getFullYear()
  const month = calendarCursor.value.getMonth()
  const first = new Date(year, month, 1)
  const startOffset = first.getDay()
  const todayIso = toDateInputValue(new Date())
  const cells: CalendarCell[] = []
  const gridStart = new Date(year, month, 1 - startOffset)
  for (let i = 0; i < 42; i++) {
    const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i)
    const iso = toDateInputValue(date)
    cells.push({
      key: `${iso}-${i}`,
      iso,
      day: date.getDate(),
      inMonth: date.getMonth() === month,
      isToday: iso === todayIso,
    })
  }
  return cells
})
function formatLocalDate (date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
function toDateInputValue (value: string | Date | null | undefined): string {
  if (!value) return ''
  if (value instanceof Date) {
    return formatLocalDate(value)
  }
  const trimmed = value.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed
  }
  const parsed = new Date(trimmed)
  if (!Number.isNaN(parsed.getTime())) {
    return formatLocalDate(parsed)
  }
  return trimmed.slice(0, 10)
}
function formatDateDisplay (iso: string | null | undefined): string {
  const value = toDateInputValue(iso)
  if (!value) return ''
  const [y, m, d] = value.split('-')
  if (!y || !m || !d) return value
  return `${y}/${m}/${d}`
}
function memberEmailLine (member: TaskDetailMember): string {
  const email = member.email?.trim()
  if (email) return email
  return `@user${member.id}`
}
function normalizeTaskDetail (detail: TaskDetail): TaskDetail {
  return {
    ...detail,
    labels: detail.labels ? resolveLabelColors(detail.labels) : [],
    assignees: detail.assignees ?? [],
    checklist: detail.checklist ?? null,
    parent_task: detail.parent_task ?? null,
    child_tasks: detail.child_tasks ?? [],
  }
}
function resetInteractionState () {
  saving.value = false
  dateSaving.value = false
  saveError.value = null
  dismissPopover()
  ignoreOverlayCloseUntil.value = 0
  popoverStyle.value = {}
  popoverAnchorEl.value = null
  calendarCursor.value = new Date()
  titleComposing.value = false
  titleSaving.value = false
  descriptionSaving.value = false
  labelSearchQuery.value = ''
  memberSearchQuery.value = ''
  effortDraft.value = ''
  effortSaving.value = false
  effortInputRef.value = null
  effortDetailAnchorRef.value = null
  parentTaskSaving.value = false
  pickerMutationPending.value = false
  checklistAddFormOpen.value = false
  checklistSaving.value = false
}
function applyLoadedTask (
  detail: TaskDetail,
  parentTasksList?: ParentTaskOption[] | null,
) {
  task.value = normalizeTaskDetail(detail)
  checklist.value = task.value.checklist ?? null
  lastPersistedChecklist = checklist.value
  titleDraft.value = task.value.title
  descriptionDraft.value = task.value.description ?? ''
  if (parentTasksList != null) {
    parentTasks.value = parentTasksList
    parentTasksLoading.value = false
  }
  loading.value = false
  loadError.value = null
  nextTick(() => {
    adjustTitleTextareaHeight()
    adjustDescriptionTextareaHeight()
  })
}
function resetState () {
  clearChecklistSaveTimer()
  task.value = null
  checklist.value = null
  lastPersistedChecklist = null
  loading.value = false
  saving.value = false
  dateSaving.value = false
  loadError.value = null
  saveError.value = null
  dismissPopover()
  ignoreOverlayCloseUntil.value = 0
  popoverStyle.value = {}
  popoverAnchorEl.value = null
  calendarCursor.value = new Date()
  titleDraft.value = ''
  titleComposing.value = false
  titleSaving.value = false
  titleTextareaRef.value = null
  descriptionTextareaRef.value = null
  descriptionDraft.value = ''
  descriptionSaving.value = false
  labelSearchQuery.value = ''
  memberSearchQuery.value = ''
  effortDraft.value = ''
  effortSaving.value = false
  effortInputRef.value = null
  effortDetailAnchorRef.value = null
  parentTasks.value = []
  parentTasksLoading.value = false
  parentTaskSaving.value = false
  pickerMutationPending.value = false
  checklistAddFormOpen.value = false
  checklistSaving.value = false
}
function normalizeEffortUnit (value: EffortUnit | string | null | undefined): EffortUnit {
  if (value === 'minute' || value === 'hour' || value === 'day') {
    return value
  }
  return 'hour'
}
function hoursToUnitValue (hours: number, unit: EffortUnit): number {
  if (unit === 'minute') {
    return hours * 60
  }
  if (unit === 'day') {
    return hours / 24
  }
  return hours
}
function unitValueToHours (value: number, unit: EffortUnit): number {
  if (unit === 'minute') {
    return value / 60
  }
  if (unit === 'day') {
    return value * 24
  }
  return value
}
function normalizeEffortHours (value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') {
    return null
  }
  const num = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(num) || num < 0) {
    return null
  }
  return Math.round(num * 1000000) / 1000000
}
function normalizeEffortValue (value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') {
    return null
  }
  const num = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(num) || num < 0) {
    return null
  }
  return Math.round(num * 10000) / 10000
}
function resolveStoredEffortValue (detail: TaskDetail): number | null {
  const stored = normalizeEffortValue(detail.effort_value)
  if (stored !== null) {
    return stored
  }
  const hours = normalizeEffortHours(detail.effort_hours)
  if (hours === null) {
    return null
  }
  return normalizeEffortValue(
    hoursToUnitValue(hours, resolveEffortUnit(detail.effort_unit, orgEffortUnit.value)),
  )
}
function formatEffortAmount (value: number): string {
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(2).replace(/\.?0+$/, '')
}
function effortValueToDraftFromTask (detail: TaskDetail): string {
  const value = resolveStoredEffortValue(detail)
  if (value === null) {
    return ''
  }
  return formatEffortAmount(value)
}
function formatEffortDisplayForTask (detail: TaskDetail): string {
  const value = resolveStoredEffortValue(detail)
  if (value === null) {
    return ''
  }
  const unit = resolveEffortUnit(detail.effort_unit, orgEffortUnit.value)
  return `${formatEffortAmount(value)} ${effortUnitLabel(unit)}`
}
function resolveEffortPopoverAnchor (event?: Event): HTMLElement | null {
  const clicked = event?.currentTarget
  const detailAnchor = effortDetailAnchorRef.value
  if (
    detailAnchor
    && clicked instanceof Node
    && detailAnchor.contains(clicked)
  ) {
    return getEffortDisplayButton() ?? detailAnchor
  }
  return capturePopoverAnchor(event)
}
function openEffortPicker (event?: Event) {
  if (!task.value || saving.value || effortSaving.value) return
  if (activePopover.value === 'effort') {
    void closePopover()
    return
  }
  popoverAnchorEl.value = resolveEffortPopoverAnchor(event)
  activePopover.value = 'effort'
  popoverError.value = null
  effortDraft.value = effortValueToDraftFromTask(task.value)
  updatePopoverPosition()
  nextTick(() => {
    effortInputRef.value?.focus()
    effortInputRef.value?.select()
  })
}
function updateEffortDraft (raw: string | number) {
  const sanitized = sanitizeEffortDraftInput(String(raw ?? ''))
  effortDraft.value = sanitized
  const inputEl = effortInputRef.value
  if (inputEl && inputEl.value !== sanitized) {
    inputEl.value = sanitized
  }
}
/** 入力ありなら保存してから閉じる。未入力なら保存せず閉じる。不正値なら開いたまま。 */
async function finalizeEffortPopover () {
  if (activePopover.value !== 'effort') return
  const parsed = parseEffortDraft(effortDraft.value)
  if (parsed === 'invalid') {
    popoverError.value = '工数は0以上の数値で入力してください'
    return
  }
  popoverError.value = null
  if (parsed !== null) {
    await saveEffort()
  }
  dismissPopover()
}
async function clearEffort () {
  if (activePopover.value !== 'effort' || effortSaving.value || saving.value) {
    return
  }
  effortDraft.value = ''
  const currentValue = task.value ? resolveStoredEffortValue(task.value) : null
  if (currentValue === null) {
    dismissPopover()
    return
  }
  await saveEffort()
  dismissPopover()
}
function getEffortDisplayButton (): HTMLButtonElement | null {
  const section = effortDetailAnchorRef.value
  return section?.querySelector('.detail-value-btn') ?? null
}
function shouldIgnorePopoverOutsideClose (target: Node): boolean {
  const anchor = popoverAnchorEl.value
  if (!anchor?.contains(target)) {
    return false
  }
  // 工数: アンカーボタン（アクションバー or 詳細の値ボタン）再クリックはトグル用。
  // 詳細セクション内の余白・ラベルは外側クリックとして閉じる。
  if (activePopover.value === 'effort') {
    const detailAnchor = effortDetailAnchorRef.value
    if (detailAnchor?.contains(target)) {
      const displayButton = getEffortDisplayButton()
      return !!displayButton && displayButton.contains(target)
    }
    return true
  }
  return true
}
function handlePopoverOutsidePointerDown (event: MouseEvent) {
  if (!activePopover.value || event.button !== 0) return
  const target = event.target
  if (!(target instanceof Node)) return
  if (resolvePopoverElement()?.contains(target)) return
  if (shouldIgnorePopoverOutsideClose(target)) return
  dismissPopoverFromOutsidePointer(target, closePopover)
}
async function saveEffort () {
  if (!task.value || effortSaving.value) return
  const parsed = parseEffortDraft(effortDraft.value)
  if (parsed === 'invalid') {
    popoverError.value = '工数は0以上の数値で入力してください'
    effortDraft.value = effortValueToDraftFromTask(task.value)
    return
  }
  const unit = resolveEffortUnit(null, orgEffortUnit.value)
  const effortValue = parsed === null ? null : normalizeEffortValue(parsed)
  const effortUnit = effortValue === null ? null : unit
  const currentValue = resolveStoredEffortValue(task.value)
  const currentUnit = currentValue === null
    ? null
    : resolveEffortUnit(task.value.effort_unit, orgEffortUnit.value)
  if (effortValue === currentValue && effortUnit === currentUnit) {
    popoverError.value = null
    return
  }
  const previousValue = task.value.effort_value ?? null
  const previousHours = task.value.effort_hours ?? null
  const previousUnit = task.value.effort_unit ?? null
  task.value = {
    ...task.value,
    effort_value: effortValue,
    effort_hours: effortValue === null ? null : unitValueToHours(effortValue, unit),
    effort_unit: effortUnit,
  }
  effortSaving.value = true
  popoverError.value = null
  saveError.value = null
  try {
    const updated = await api<TaskDetail>(
      `/orgs/${props.orgSlug}/workspaces/${props.workspaceId}/tasks/${task.value.id}`,
      { method: 'PATCH', body: { effort_value: effortValue, effort_unit: effortUnit } },
    )
    task.value = normalizeTaskDetail(updated)
    effortDraft.value = effortValueToDraftFromTask(task.value)
    emit('updated', task.value)
  } catch (e: unknown) {
    task.value = {
      ...task.value,
      effort_value: previousValue,
      effort_hours: previousHours,
      effort_unit: previousUnit,
    }
    effortDraft.value = effortValueToDraftFromTask(task.value)
    saveError.value = e instanceof Error ? e.message : '工数の更新に失敗しました'
  } finally {
    effortSaving.value = false
  }
}
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
  }
}
async function loadTask () {
  if (props.taskId === null) return
  loading.value = true
  loadError.value = null
  try {
    await fetchAndApplyTaskDetail()
  } catch (e: unknown) {
    loadError.value = e instanceof Error ? e.message : '読み込みに失敗しました'
    loading.value = false
  }
}
async function fetchAndApplyTaskDetail () {
  if (props.taskId === null) return
  const detail = await api<TaskDetail>(
    `/orgs/${props.orgSlug}/workspaces/${props.workspaceId}/tasks/${props.taskId}`,
  )
  if (props.taskId !== detail.id) return
  if (props.initialParentTasks == null) {
    await fetchParentTasks()
  }
  applyLoadedTask(detail, props.initialParentTasks)
}
async function refreshTaskDetailSilently () {
  if (props.taskId === null) return
  try {
    await fetchAndApplyTaskDetail()
  } catch {
    // ボードの初期表示を維持する
  }
}
async function reload () {
  await loadTask()
}
function applyRemoteTaskPatch (patch: TaskDetailRemotePatch) {
  if (!task.value || patch.id !== task.value.id) {
    return
  }
  if (loading.value || titleSaving.value || descriptionSaving.value || saving.value || dateSaving.value || effortSaving.value || parentTaskSaving.value || checklistSaving.value || activePopover.value === 'effort') {
    return
  }
  const current = task.value
  const merged = normalizeTaskDetail({
    ...current,
    ...patch,
    labels: patch.labels ?? current.labels,
    assignees: patch.assignees ?? current.assignees,
  })
  const unchanged = (
    merged.title === current.title
    && (merged.description ?? null) === (current.description ?? null)
    && merged.status === current.status
    && merged.list_id === current.list_id
    && (merged.start_date ?? null) === (current.start_date ?? null)
    && (merged.due_date ?? null) === (current.due_date ?? null)
    && (merged.effort_hours ?? null) === (current.effort_hours ?? null)
    && (merged.effort_value ?? null) === (current.effort_value ?? null)
    && (merged.effort_unit ?? null) === (current.effort_unit ?? null)
    && (merged.parent_task_id ?? null) === (current.parent_task_id ?? null)
    && Boolean(merged.is_parent_task) === Boolean(current.is_parent_task)
    && JSON.stringify(merged.labels) === JSON.stringify(current.labels)
    && JSON.stringify(merged.assignees) === JSON.stringify(current.assignees)
    && patch.checklist === undefined
  )
  if (unchanged) {
    return
  }
  const titleDirty = titleDraft.value.trim() !== (current.title ?? '').trim()
  const descDirty = descriptionDraft.value !== (current.description ?? '')
  task.value = merged
  if (patch.checklist !== undefined) {
    checklist.value = patch.checklist
  }
  if (!titleDirty) {
    titleDraft.value = task.value.title
  }
  if (!descDirty) {
    descriptionDraft.value = task.value.description ?? ''
    nextTick(() => adjustDescriptionTextareaHeight())
  }
}
watch(
  () => props.remoteUpdateRev,
  () => {
    const patch = props.remoteUpdate
    if (!patch || !props.modelValue) {
      return
    }
    applyRemoteTaskPatch(patch)
  },
)
watch(titleDraft, () => {
  nextTick(() => adjustTitleTextareaHeight())
})
watch(
  () => [props.modelValue, props.taskId] as const,
  async ([open, id], prev) => {
    const prevOpen = prev?.[0] ?? false
    const prevId = prev?.[1] ?? null
    if (!open) {
      if (prevOpen) resetState()
      return
    }
    if (id === null) return
    void ensureOrgEffortUnit()
    if (prevOpen && prevId === id) return
    const initial = props.initialTaskDetail
    if (initial && initial.id === id) {
      resetInteractionState()
      applyLoadedTask(initial, props.initialParentTasks)
      void refreshTaskDetailSilently()
      return
    }
    resetState()
    await loadTask()
  },
  { immediate: true },
)
function armOverlayCloseGuard (ms = 400) {
  ignoreOverlayCloseUntil.value = Date.now() + ms
}
function isOverlayCloseBlocked (): boolean {
  return Date.now() < ignoreOverlayCloseUntil.value
}
function close () {
  if (isOverlayCloseBlocked() || saving.value || titleSaving.value || descriptionSaving.value || effortSaving.value || parentTaskSaving.value) return
  if (activePopover.value) {
    void closePopover()
    return
  }
  emit('update:modelValue', false)
}
function onDocumentEscape (event: KeyboardEvent) {
  if (event.key !== 'Escape' || !props.modelValue) {
    return
  }
  if (getTopmostModalOverlay() !== overlayRef.value) {
    return
  }
  event.preventDefault()
  event.stopPropagation()
  void close()
}
watch(() => props.modelValue, (open) => {
  if (!import.meta.client) {
    return
  }
  if (open) {
    document.addEventListener('keydown', onDocumentEscape, true)
  } else {
    document.removeEventListener('keydown', onDocumentEscape, true)
  }
}, { immediate: true })
const {
  onOverlayMouseDown,
  resetOverlayBackdropClose,
} = createOverlayBackdropClose({
  onClose: close,
  canClose: () => !isOverlayCloseBlocked()
    && !saving.value
    && !titleSaving.value
    && !descriptionSaving.value
    && !effortSaving.value
    && !parentTaskSaving.value,
})
function dismissPopover () {
  activePopover.value = null
  selectedMember.value = null
  popoverError.value = null
  pendingDate.value = null
  popoverStyle.value = {}
}
async function closePopover () {
  if (activePopover.value === 'effort') {
    await finalizeEffortPopover()
    return
  }
  dismissPopover()
}
const POPOVER_VIEWPORT_PAD = 12
const POPOVER_ANCHOR_GAP = 6
const POPOVER_MIN_HEIGHT = 120
/** レイアウト前の幅推定（19.5rem） */
const POPOVER_DEFAULT_WIDTH_PX = 312
let removePopoverResizeListener: (() => void) | null = null
/** await 後は event.currentTarget が null になるため、同期的に要素を保持する */
function capturePopoverAnchor (event?: Event): HTMLElement | null {
  const fromEvent = event?.currentTarget
  if (fromEvent instanceof HTMLElement) {
    return fromEvent
  }
  return actionButtonsRef.value
}
function updatePopoverPosition () {
  nextTick(() => {
    requestAnimationFrame(() => {
      positionPopover()
      if (!popoverElRef.value) {
        requestAnimationFrame(() => positionPopover())
      }
    })
  })
}
function positionPopover () {
  const anchor = popoverAnchorEl.value
  const popover = resolvePopoverElement()
  if (!anchor || !popover) return
  const pad = POPOVER_VIEWPORT_PAD
  const gap = POPOVER_ANCHOR_GAP
  const anchorRect = anchor.getBoundingClientRect()
  const measuredWidth = popover.offsetWidth || popover.getBoundingClientRect().width
  const popoverWidth = measuredWidth > 0 ? measuredWidth : POPOVER_DEFAULT_WIDTH_PX
  // ボタン左端に揃え、画面右端にはみ出すときだけ右端揃え（モーダル幅ではクランプしない）
  let left = anchorRect.left
  if (left + popoverWidth > window.innerWidth - pad) {
    left = anchorRect.right - popoverWidth
  }
  const spaceBelow = window.innerHeight - anchorRect.bottom - pad
  const spaceAbove = anchorRect.top - pad
  let top: number
  let maxHeight: number
  if (spaceBelow >= POPOVER_MIN_HEIGHT) {
    top = anchorRect.bottom + gap
    maxHeight = Math.max(POPOVER_MIN_HEIGHT, Math.floor(spaceBelow - gap))
  } else {
    maxHeight = Math.max(POPOVER_MIN_HEIGHT, Math.floor(spaceAbove - gap))
    top = Math.max(pad, anchorRect.top - gap - maxHeight)
  }
  popoverStyle.value = {
    position: 'fixed',
    top: `${Math.round(top)}px`,
    left: `${Math.round(left)}px`,
    maxHeight: `${maxHeight}px`,
    zIndex: '75',
  }
}
function openDatePicker (target: DatePickerTarget, event?: Event) {
  if (!task.value) return
  const next: PopoverType = target === 'start' ? 'start-date' : 'due-date'
  if (activePopover.value === next) {
    closePopover()
    return
  }
  popoverAnchorEl.value = capturePopoverAnchor(event)
  activePopover.value = next
  popoverError.value = null
  const existing = target === 'start' ? task.value.start_date : task.value.due_date
  pendingDate.value = toDateInputValue(existing) || null
  const base = pendingDate.value
    ? new Date(`${pendingDate.value}T12:00:00`)
    : new Date()
  calendarCursor.value = new Date(base.getFullYear(), base.getMonth(), 1)
  updatePopoverPosition()
}
function shiftCalendarMonth (delta: number) {
  const next = new Date(calendarCursor.value)
  next.setMonth(next.getMonth() + delta, 1)
  calendarCursor.value = next
}
async function pickCalendarDay (iso: string) {
  if (!task.value || !activePopover.value || dateSaving.value) return
  const field = activePopover.value === 'start-date' ? 'start_date' : 'due_date'
  const current = field === 'start_date' ? task.value.start_date : task.value.due_date
  pendingDate.value = iso
  if (toDateInputValue(current) === iso) return
  const previousDate = current
  patchTaskDateField(field, iso)
  saveError.value = null
  popoverError.value = null
  dateSaving.value = true
  try {
    const updated = await api<TaskDetail>(
      `/orgs/${props.orgSlug}/workspaces/${props.workspaceId}/tasks/${task.value.id}`,
      { method: 'PATCH', body: { [field]: iso } },
    )
    task.value = normalizeTaskDetail(updated)
    const saved = field === 'start_date' ? task.value.start_date : task.value.due_date
    pendingDate.value = toDateInputValue(saved) || iso
    emit('updated', task.value)
  } catch (e: unknown) {
    patchTaskDateField(field, previousDate)
    pendingDate.value = toDateInputValue(previousDate) || null
    popoverError.value = e instanceof Error ? e.message : '日付の更新に失敗しました'
  } finally {
    dateSaving.value = false
  }
}
async function clearCalendarDate () {
  if (!task.value || !activePopover.value || dateSaving.value || saving.value) return
  if (activePopover.value !== 'start-date' && activePopover.value !== 'due-date') {
    return
  }
  const field = activePopover.value === 'start-date' ? 'start_date' : 'due_date'
  const current = field === 'start_date' ? task.value.start_date : task.value.due_date
  pendingDate.value = null
  if (!current) {
    return
  }
  const previousDate = current
  patchTaskDateField(field, null)
  saveError.value = null
  popoverError.value = null
  dateSaving.value = true
  try {
    const updated = await api<TaskDetail>(
      `/orgs/${props.orgSlug}/workspaces/${props.workspaceId}/tasks/${task.value.id}`,
      { method: 'PATCH', body: { [field]: null } },
    )
    task.value = normalizeTaskDetail(updated)
    emit('updated', task.value)
  } catch (e: unknown) {
    patchTaskDateField(field, previousDate)
    pendingDate.value = toDateInputValue(previousDate) || null
    popoverError.value = e instanceof Error ? e.message : '日付の更新に失敗しました'
  } finally {
    dateSaving.value = false
  }
}
function patchTaskDateField (field: 'start_date' | 'due_date', value: string | null) {
  if (!task.value) return
  task.value = { ...task.value, [field]: value }
}
function openMemberPicker (event?: Event) {
  if (!task.value) return
  if (activePopover.value === 'members') {
    closePopover()
    return
  }
  selectedMember.value = null
  popoverAnchorEl.value = capturePopoverAnchor(event)
  activePopover.value = 'members'
  popoverError.value = null
  updatePopoverPosition()
}
function openMemberDetail (member: TaskDetailMember, event: Event) {
  if (!task.value) return
  if (activePopover.value === 'member-detail' && selectedMember.value?.id === member.id) {
    closePopover()
    return
  }
  selectedMember.value = member
  popoverAnchorEl.value = event.currentTarget as HTMLElement
  activePopover.value = 'member-detail'
  popoverError.value = null
  updatePopoverPosition()
}
async function removeMemberFromTask (member: TaskDetailMember) {
  if (!task.value || !isMemberAssigned(member.id)) return
  armOverlayCloseGuard()
  await toggleMember(member)
  if (!isMemberAssigned(member.id)) {
    closePopover()
  }
}
function isMemberAssigned (memberId: number): boolean {
  return (task.value?.assignees ?? []).some(member => member.id === memberId)
}
async function toggleMember (member: TaskDetailMember) {
  if (!task.value || pickerMutationPending.value) return
  armOverlayCloseGuard()
  pickerMutationPending.value = true
  const previousAssignees = [...task.value.assignees]
  const currentIds = previousAssignees.map(m => m.id)
  const isAssigned = currentIds.includes(member.id)
  const assignee_ids = isAssigned
    ? currentIds.filter(id => id !== member.id)
    : [...currentIds, member.id]
  task.value = {
    ...task.value,
    assignees: isAssigned
      ? previousAssignees.filter(m => m.id !== member.id)
      : [...previousAssignees, member],
  }
  popoverError.value = null
  try {
    const updated = await api<TaskDetail>(
      `/orgs/${props.orgSlug}/workspaces/${props.workspaceId}/tasks/${task.value.id}`,
      { method: 'PATCH', body: { assignee_ids } },
    )
    task.value = normalizeTaskDetail(updated)
    emit('updated', task.value)
  } catch (e: unknown) {
    task.value = { ...task.value, assignees: previousAssignees }
    popoverError.value = e instanceof Error ? e.message : '担当者の更新に失敗しました'
  } finally {
    pickerMutationPending.value = false
  }
}
function onPopoverEscape (event: KeyboardEvent) {
  if (event.key !== 'Escape' || !activePopover.value) return
  event.stopPropagation()
  closePopover()
}
watch(activePopover, (open) => {
  if (open === 'checklist-create') {
    nextTick(() => checklistTitleInputRef.value?.focus())
  }
  if (open) {
    document.addEventListener('keydown', onPopoverEscape)
    document.addEventListener('mousedown', handlePopoverOutsidePointerDown, true)
    const onResize = () => updatePopoverPosition()
    window.addEventListener('resize', onResize)
    removePopoverResizeListener = () => window.removeEventListener('resize', onResize)
    updatePopoverPosition()
  } else {
    document.removeEventListener('keydown', onPopoverEscape)
    document.removeEventListener('mousedown', handlePopoverOutsidePointerDown, true)
    removePopoverResizeListener?.()
    removePopoverResizeListener = null
  }
})
watch(
  () => task.value?.id,
  () => {
    checklistAddFormOpen.value = false
  },
)
watch(labelSearchQuery, () => {
  if (activePopover.value === 'labels') {
    updatePopoverPosition()
  }
})
watch(memberSearchQuery, () => {
  if (activePopover.value === 'members') {
    updatePopoverPosition()
  }
})
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onDocumentEscape, true)
  resetOverlayBackdropClose()
  document.removeEventListener('keydown', onPopoverEscape)
  document.removeEventListener('mousedown', handlePopoverOutsidePointerDown, true)
  removePopoverResizeListener?.()
  removePopoverResizeListener = null
})
function revertTitleDraft () {
  if (!task.value) return
  titleDraft.value = task.value.title
  nextTick(() => adjustTitleTextareaHeight())
}
function onTitleEnter () {
  titleDraft.value = titleDraft.value.replace(/\r?\n/g, '').trim()
  titleTextareaRef.value?.blur()
}
function adjustTitleTextareaHeight () {
  const el = titleTextareaRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}
function adjustDescriptionTextareaHeight () {
  const el = descriptionTextareaRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}
async function onTitleBlur () {
  await saveTitle()
}
async function saveTitle () {
  if (!task.value || titleSaving.value) return
  const title = titleDraft.value.trim()
  if (!title) {
    titleDraft.value = task.value.title
    return
  }
  if (title === task.value.title) return
  titleSaving.value = true
  saveError.value = null
  try {
    const updated = await api<TaskDetail>(
      `/orgs/${props.orgSlug}/workspaces/${props.workspaceId}/tasks/${task.value.id}`,
      { method: 'PATCH', body: { title } },
    )
    task.value = normalizeTaskDetail(updated)
    titleDraft.value = task.value.title
    nextTick(() => adjustTitleTextareaHeight())
    emit('updated', task.value)
  } catch (e: unknown) {
    saveError.value = e instanceof Error ? e.message : 'タスク名の更新に失敗しました'
  } finally {
    titleSaving.value = false
  }
}
function labelBarTextColor (color: string): string {
  const hex = color.replace('#', '').trim()
  if (hex.length !== 6) return '#172b4d'
  const r = Number.parseInt(hex.slice(0, 2), 16)
  const g = Number.parseInt(hex.slice(2, 4), 16)
  const b = Number.parseInt(hex.slice(4, 6), 16)
  if ([r, g, b].some(Number.isNaN)) return '#172b4d'
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.62 ? '#172b4d' : '#ffffff'
}
function isLabelSelected (labelId: number): boolean {
  return (task.value?.labels ?? []).some(label => label.id === labelId)
}
async function openParentTaskPicker (event?: Event) {
  if (!task.value || task.value.is_parent_task) return
  if (activePopover.value === 'parent-task') {
    closePopover()
    return
  }
  popoverAnchorEl.value = capturePopoverAnchor(event)
  activePopover.value = 'parent-task'
  popoverError.value = null
  if (!parentTasks.value.length) {
    await fetchParentTasks()
  }
  updatePopoverPosition()
}
async function selectParentTask (parentTaskId: number | null) {
  if (!task.value || parentTaskSaving.value) return
  armOverlayCloseGuard()
  await saveParentTask(parentTaskId)
}
async function saveParentTask (parentTaskId: number | null) {
  if (!task.value || parentTaskSaving.value) return
  if ((task.value.parent_task_id ?? null) === parentTaskId) return
  const previousParentTaskId = task.value.parent_task_id ?? null
  parentTaskSaving.value = true
  popoverError.value = null
  task.value = { ...task.value, parent_task_id: parentTaskId }
  try {
    const updated = await api<TaskDetail>(
      `/orgs/${props.orgSlug}/workspaces/${props.workspaceId}/tasks/${task.value.id}`,
      { method: 'PATCH', body: { parent_task_id: parentTaskId } },
    )
    task.value = normalizeTaskDetail(updated)
    emit('updated', task.value)
  } catch (e: unknown) {
    task.value = { ...task.value, parent_task_id: previousParentTaskId }
    popoverError.value = e instanceof Error ? e.message : '親タスクの更新に失敗しました'
  } finally {
    parentTaskSaving.value = false
  }
}
function openLabelPicker (event?: Event) {
  if (!task.value) return
  if (activePopover.value === 'labels') {
    closePopover()
    return
  }
  labelSearchQuery.value = ''
  popoverAnchorEl.value = capturePopoverAnchor(event)
  activePopover.value = 'labels'
  popoverError.value = null
  updatePopoverPosition()
}
function openChecklistPicker (event?: Event) {
  if (!task.value) return
  if (checklist.value) {
    checklistAddFormOpen.value = true
    nextTick(() => {
      checklistBlockRef.value?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
    return
  }
  if (activePopover.value === 'checklist-create') {
    closePopover()
    return
  }
  checklistTitleDraft.value = ''
  popoverAnchorEl.value = capturePopoverAnchor(event)
  activePopover.value = 'checklist-create'
  popoverError.value = null
  updatePopoverPosition()
}
function submitChecklistCreate () {
  if (!task.value || checklistSaving.value) return
  const title = checklistTitleDraft.value.trim() || 'チェックリスト'
  void saveChecklist({ title, items: [] })
  checklistAddFormOpen.value = true
  dismissPopover()
  nextTick(() => {
    checklistBlockRef.value?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  })
}
function updateCurrentChecklist (next: TaskChecklist) {
  if (!task.value || checklistSaving.value) return
  void saveChecklist(next)
}
function deleteCurrentChecklist () {
  if (!task.value || checklistSaving.value) return
  void saveChecklist(null)
  checklistAddFormOpen.value = false
}
async function saveChecklist (next: TaskChecklist | null) {
  if (!task.value) return
  checklist.value = next
  clearChecklistSaveTimer()
  checklistSaveTimer = setTimeout(() => {
    checklistSaveTimer = null
    void persistChecklist(checklist.value)
  }, 300)
}
async function persistChecklist (next: TaskChecklist | null) {
  if (!task.value) return
  const rollback = lastPersistedChecklist
  const seq = ++checklistSaveSeq
  checklistSaving.value = true
  saveError.value = null
  try {
    const updated = await api<TaskDetail>(
      `/orgs/${props.orgSlug}/workspaces/${props.workspaceId}/tasks/${task.value.id}`,
      { method: 'PATCH', body: { checklist: next } },
    )
    if (seq !== checklistSaveSeq || !task.value) return
    checklist.value = updated.checklist ?? null
    lastPersistedChecklist = checklist.value
    emit('updated', { ...task.value, checklist: checklist.value })
  } catch (e: unknown) {
    if (seq !== checklistSaveSeq) return
    checklist.value = rollback
    saveError.value = e instanceof Error ? e.message : 'チェックリストの保存に失敗しました'
  } finally {
    if (seq === checklistSaveSeq) {
      checklistSaving.value = false
    }
  }
}
async function toggleLabel (label: TaskDetailLabel) {
  if (!task.value || pickerMutationPending.value) return
  armOverlayCloseGuard()
  pickerMutationPending.value = true
  const previousLabels = [...task.value.labels]
  const currentIds = previousLabels.map(item => item.id)
  const isSelected = currentIds.includes(label.id)
  const label_ids = isSelected
    ? currentIds.filter(id => id !== label.id)
    : [...currentIds, label.id]
  task.value = {
    ...task.value,
    labels: isSelected
      ? previousLabels.filter(item => item.id !== label.id)
      : [...previousLabels, label],
  }
  popoverError.value = null
  try {
    const updated = await api<TaskDetail>(
      `/orgs/${props.orgSlug}/workspaces/${props.workspaceId}/tasks/${task.value.id}`,
      { method: 'PATCH', body: { label_ids } },
    )
    task.value = normalizeTaskDetail(updated)
    emit('updated', task.value)
  } catch (e: unknown) {
    task.value = { ...task.value, labels: previousLabels }
    popoverError.value = e instanceof Error ? e.message : 'ラベルの更新に失敗しました'
  } finally {
    pickerMutationPending.value = false
  }
}
async function onDescriptionBlur () {
  await saveDescription()
}
async function saveDescription () {
  if (!task.value || descriptionSaving.value) return
  const description = descriptionDraft.value
  const normalized = description.trim() === '' ? null : description
  if ((normalized ?? '') === (task.value.description ?? '')) return
  descriptionSaving.value = true
  saveError.value = null
  try {
    const updated = await api<TaskDetail>(
      `/orgs/${props.orgSlug}/workspaces/${props.workspaceId}/tasks/${task.value.id}`,
      { method: 'PATCH', body: { description: normalized } },
    )
    task.value = normalizeTaskDetail(updated)
    descriptionDraft.value = task.value.description ?? ''
    nextTick(() => adjustDescriptionTextareaHeight())
    emit('updated', task.value)
  } catch (e: unknown) {
    saveError.value = e instanceof Error ? e.message : '説明の更新に失敗しました'
  } finally {
    descriptionSaving.value = false
  }
}
</script>
<style lang="scss" scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 4rem 1rem;
  z-index: 70;
  overflow: hidden;
}
.modal-overlay--popover-open {
  overflow: hidden;
}
.modal-card {
  position: relative;
  width: min(calc(40rem + 22rem), 100%);
  max-height: calc(100vh - 8rem);
  border-radius: 12px;
  overflow: hidden;
  background: #fff;
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.18);
  display: flex;
  flex-direction: column;
}
.modal-header {
  @include mixin.modal-header-bar;
  border-radius: 12px 12px 0 0;
}
.modal-header h3 {
  margin: 0;
  font-size: 1.05rem;
  line-height: 1;
}
.icon-close {
  @include mixin.modal-close-hit-area;
  background: transparent;
  border: none;
  color: #fff;
  font-size: 1.4rem;
  line-height: 1;
  cursor: pointer;
}
.modal-body {
  position: relative;
  padding: 1.2rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  overflow: visible;
}
.modal-split {
  display: flex;
  align-items: stretch;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
}
.modal-pane--detail {
  position: relative;
  flex: 0 0 40rem;
  width: 40rem;
  max-width: 40rem;
  min-height: 0;
  padding: 1.2rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  overflow-x: visible;
  overflow-y: auto;
  scrollbar-gutter: stable;
  scrollbar-width: thin;
  scrollbar-color: #0f172a1a transparent;
}
.modal-pane--detail::-webkit-scrollbar {
  width: 3px;
}
.modal-pane--detail::-webkit-scrollbar-track {
  background: transparent;
}
.modal-pane--detail::-webkit-scrollbar-thumb {
  background: rgba(15, 23, 42, 0.08);
  border-radius: 999px;
}
.modal-pane--detail::-webkit-scrollbar-thumb:hover {
  background: rgba(15, 23, 42, 0.14);
}
@media (max-width: 62rem) {
  .modal-split {
    flex-direction: column;
  }
  .modal-pane--detail {
    flex: 1 1 45%;
    width: 100%;
    max-width: 100%;
  }
}
.modal-body--state {
  align-items: center;
  justify-content: center;
  min-height: 8rem;
}
.state-message {
  margin: 0;
  color: mixin.$text-sub;
  font-weight: 600;
}
.field-block {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}
.field-label {
  font-size: 0.82rem;
  font-weight: 700;
  color: mixin.$text-sub;
}
.title-block {
  margin-bottom: 0.1rem;
  gap: 0.2rem;
}
.task-detail-parent-task {
  align-self: flex-start;
  max-width: 100%;
  margin: 0 0 0.1rem 0.6rem;
  padding: 0;
  border: none;
  background: transparent;
  font-size: 0.82rem;
  font-weight: 700;
  line-height: 1.3;
  color: mixin.$text;
  text-align: left;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.task-detail-parent-task--placeholder {
  color: #94a3b8;
}
.task-detail-parent-task:disabled {
  cursor: default;
  opacity: 0.65;
}
.title-input-wrap {
  position: relative;
  width: 100%;
}
.title-input {
  border: 1px solid transparent;
  border-radius: 8px;
  padding: 0.5rem 0.6rem;
  font-size: 1.8rem;
  font-weight: 800;
  color: #0f172a;
  background: transparent;
  width: 100%;
  box-sizing: border-box;
  resize: none;
  overflow: hidden;
  line-height: 1.25;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
  display: block;
  outline: none;
  box-shadow: none;
}
.title-input-placeholder {
  position: absolute;
  top: 50%;
  left: 0.6rem;
  right: 0.6rem;
  transform: translateY(-50%);
  font-size: 1.8rem;
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
  gap: 0.4rem;
}
.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  border: 1px solid mixin.$border;
  border-radius: 8px;
  padding: 0.38rem 0.7rem;
  font-size: 0.84rem;
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
.popover--members .member-picker-list {
  padding: 0.65rem 0.5rem 0.65rem;
}
.popover--members .empty-text,
.popover--members .err {
  margin-left: 0.65rem;
  margin-right: 0.65rem;
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
.popover-header--labels .popover-close {
  position: absolute;
  right: 0.45rem;
  top: 50%;
  transform: translateY(-50%);
}
.popover--parent-task {
  width: min(19.5rem, calc(100vw - 1.5rem));
  padding: 0;
  gap: 0;
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
.popover-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}
.popover-title {
  margin: 0;
  font-size: 0.92rem;
  font-weight: 800;
  color: #0f172a;
}
.popover-close {
  border: none;
  background: transparent;
  color: #64748b;
  font-size: 1.1rem;
  line-height: 1;
  cursor: pointer;
  padding: 0.15rem 0.35rem;
  border-radius: 6px;
}
.popover-close:hover:not(:disabled) {
  background: #f1f5f9;
  color: #0f172a;
}
.popover-fade-enter-active,
.popover-fade-leave-active {
  transition: opacity 0.22s ease;
}
.popover-fade-enter-from,
.popover-fade-leave-to {
  opacity: 0;
}
.detail-reveal-enter-active {
  transition: opacity 0.22s ease, transform 0.22s ease;
}
.detail-reveal-leave-active {
  transition: opacity 0.16s ease, transform 0.16s ease;
}
.detail-reveal-enter-from,
.detail-reveal-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
.action-btn-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  line-height: 0;
}
.detail-meta-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 1rem 1.25rem;
}
.detail-meta-row--schedule .detail-item--date,
.detail-meta-row--schedule .detail-item--effort {
  flex: 1 1 0;
  min-width: 5.5rem;
}
.detail-meta-row--people .detail-item--members,
.detail-meta-row--people .detail-item--labels {
  flex: 1 1 0;
  min-width: min(100%, 10rem);
}
.detail-chip-wrap {
  align-content: flex-start;
  box-sizing: border-box;
  padding: 3px;
  max-height: calc(2 * 2rem + 0.35rem + 6px);
  overflow: hidden;
}
.member-avatar-list.detail-chip-wrap {
  gap: 0.45rem;
}
.detail-item--date {
  min-width: 0;
}
.detail-item--date .detail-value-btn {
  font-size: 1.2rem;
  padding: 0.45rem 0.7rem;
}
.detail-item--effort .detail-value-btn {
  align-self: flex-start;
  box-sizing: border-box;
  font-size: 1.2rem;
  line-height: 1.3;
  padding: 0.45rem 0.7rem;
  min-height: calc(1.2rem * 1.3 + 0.9rem);
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
.detail-item {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.detail-item-label {
  font-size: 0.78rem;
  font-weight: 700;
  color: #64748b;
}
.detail-value-btn {
  align-self: flex-start;
  border: none;
  border-radius: 6px;
  padding: 0.35rem 0.55rem;
  font-size: 0.92rem;
  font-weight: 700;
  color: #0f172a;
  background: #fff;
  cursor: pointer;
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
.edit-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}
.label-chip-list {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
}
.label-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 2rem;
  box-sizing: border-box;
  padding: 0 0.55rem;
  border: none;
  border-radius: 6px;
  font-size: 0.78rem;
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
  width: 2rem;
  height: 2rem;
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
  font-size: 1.15rem;
  font-weight: 400;
  line-height: 1;
}
.empty-text {
  margin: 0;
  font-size: 0.84rem;
  color: #94a3b8;
}
.description-block {
  flex-shrink: 0;
}
.task-hierarchy-wrap {
  flex-shrink: 0;
}
.task-checklist-wrap {
  flex-shrink: 0;
}
.popover--checklist-create {
  width: min(18rem, calc(100vw - 1.5rem));
}
.checklist-create-input {
  display: block;
  width: 90%;
  max-width: 100%;
  margin-left: auto;
  margin-right: auto;
  border: 1px solid mixin.$border;
  border-radius: 8px;
  padding: 0.5rem 0.65rem;
  font: inherit;
  font-size: 0.88rem;
  color: #0f172a;
}
.checklist-create-input:focus,
.checklist-create-input:focus-visible {
  @include mixin.input-focus-ring;
}
.checklist-create-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 0.55rem;
}
.checklist-create-submit {
  border: none;
  border-radius: 8px;
  padding: 0.42rem 0.95rem;
  font: inherit;
  font-size: 0.84rem;
  font-weight: 700;
  color: #fff;
  background: mixin.$main;
  cursor: pointer;
}
.checklist-create-submit:hover {
  background: mixin.$main-hover;
}
.description-input {
  @include mixin.description-textarea;
  resize: none;
  overflow: hidden;
}
.primary-btn,
.ghost-btn {
  border-radius: 999px;
  border: 1px solid transparent;
  padding: 0.5rem 1.1rem;
  font-weight: 800;
  cursor: pointer;
  font-size: 0.86rem;
}
.primary-btn.small,
.ghost-btn.small {
  padding: 0.35rem 0.75rem;
  font-size: 0.8rem;
  font-weight: 700;
}
.primary-btn {
  background: mixin.$main;
  color: mixin.$white;
}
.ghost-btn {
  border-color: #cbd5e1;
  color: mixin.$text-sub;
  background: #f1f5f9;
}
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.8rem;
}
.err {
  margin: 0;
  color: #b91c1c;
  font-weight: 700;
  font-size: 0.86rem;
}
button:disabled:not(.label-picker-row):not(.parent-task-picker-row):not(.member-picker-row) {
  opacity: 0.55;
  cursor: not-allowed;
}
.member-avatar-list {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
}
.member-avatar-btn {
  width: 2rem;
  height: 2rem;
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
  font-size: 1.2rem;
  font-weight: 400;
  line-height: 1;
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
  font-size: 0.78rem;
  font-weight: 800;
  border-radius: 999px;
}
</style>
