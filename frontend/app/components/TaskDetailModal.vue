<template>
  <Teleport to="body">
    <Transition name="tm-fade">
      <div
        v-if="modelValue"
        class="modal-overlay"
        :class="{ 'modal-overlay--popover-open': !!activePopover }"
        role="presentation"
        @mousedown="onOverlayMouseDown"
        @click.self="onOverlayBackdropClick"
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

          <div v-else ref="modalBodyRef" class="modal-body">
            <section class="field-block title-block">
              <button
                v-if="task?.heading"
                type="button"
                class="task-detail-heading"
                :disabled="saving || headingSaving"
                @click="openHeadingPicker($event)"
              >
                {{ task.heading.name }}
              </button>
              <div class="title-input-wrap">
                <textarea
                  ref="titleTextareaRef"
                  v-model.trim="titleDraft"
                  maxlength="500"
                  class="title-input"
                  aria-label="タスク名"
                  :disabled="saving || titleSaving"
                  rows="1"
                  @input="adjustTitleTextareaHeight"
                  @blur="onTitleBlur"
                  @keydown.enter.prevent="onTitleEnter"
                  @keydown.escape.prevent="revertTitleDraft"
                />
                <span
                  v-if="!titleDraft"
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
                <span class="action-btn-icon" aria-hidden="true">🗓</span>
                開始日
              </button>
              <button
                type="button"
                class="action-btn"
                :class="{ 'action-btn--active': activePopover === 'due-date' }"
                :disabled="saving"
                @click="openDatePicker('due', $event)"
              >
                <span class="action-btn-icon" aria-hidden="true">⏱</span>
                終了日
              </button>
              <button
                type="button"
                class="action-btn"
                :class="{ 'action-btn--active': activePopover === 'members' }"
                :disabled="saving"
                @click="openMemberPicker($event)"
              >
                <span class="action-btn-icon" aria-hidden="true">👤</span>
                メンバー
              </button>
              <button
                type="button"
                class="action-btn"
                :class="{ 'action-btn--active': activePopover === 'labels' }"
                :disabled="saving"
                @click="openLabelPicker($event)"
              >
                <span class="action-btn-icon" aria-hidden="true">🏷</span>
                ラベル
              </button>
              <button
                type="button"
                class="action-btn"
                :class="{ 'action-btn--active': activePopover === 'heading' }"
                :disabled="saving"
                @click="openHeadingPicker($event)"
              >
                <span class="action-btn-icon" aria-hidden="true">§</span>
                親タスク
              </button>
            </div>

            <div
              v-if="task?.start_date || task?.due_date"
              class="detail-dates-row"
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
            </div>

            <section
              v-if="(task?.assignees ?? []).length"
              class="detail-item"
            >
              <span class="detail-item-label">メンバー</span>
              <div class="member-avatar-list">
                <button
                  v-for="member in task?.assignees ?? []"
                  :key="member.id"
                  type="button"
                  class="member-avatar-btn"
                  :class="{
                    'member-avatar-btn--active':
                      activePopover === 'member-detail' && selectedMember?.id === member.id,
                  }"
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
                  :class="{ 'member-avatar-btn--active': activePopover === 'members' }"
                  :disabled="saving"
                  aria-label="メンバーを追加"
                  @click="openMemberPicker($event)"
                >
                  <span class="member-avatar-btn-plus" aria-hidden="true">+</span>
                </button>
              </div>
            </section>

            <section
              v-if="(task?.labels ?? []).length"
              class="detail-item"
            >
              <span class="detail-item-label">ラベル</span>
              <div class="label-chip-list">
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

            <section class="field-block description-block">
              <span class="field-label">説明</span>
              <textarea
                ref="descriptionTextareaRef"
                v-model="descriptionDraft"
                rows="6"
                maxlength="10000"
                class="description-textarea"
                placeholder="Add a more detailed description..."
                :disabled="saving || descriptionSaving"
                @blur="onDescriptionBlur"
              />
            </section>

            <p v-if="saveError" class="err">{{ saveError }}</p>

            <Teleport to="body">
              <Transition name="popover-fade" @after-enter="updatePopoverPosition">
                <div
                  v-if="modelValue && activePopover"
                  :key="activePopover === 'member-detail' ? `member-detail-${selectedMember?.id}` : activePopover"
                  class="popover-layer popover-layer--portal"
                >
                <div
                  class="popover-backdrop"
                  aria-hidden="true"
                  @click="closePopover"
                />

                <div
                  v-if="activePopover === 'start-date' || activePopover === 'due-date'"
                  ref="popoverElRef"
                  class="popover popover--date"
                :style="popoverStyle"
                role="dialog"
                :aria-label="activePopover === 'start-date' ? '開始日' : '終了日'"
                @click.stop
              >
                <header class="popover-header">
                  <h4 class="popover-title">
                    {{ activePopover === 'start-date' ? '開始日' : '終了日' }}
                  </h4>
                  <button
                    type="button"
                    class="popover-close"
                    :disabled="saving"
                    aria-label="閉じる"
                    @click="closePopover"
                  >✕</button>
                </header>

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
                      :disabled="dateSaving"
                      @click.stop="pickCalendarDay(cell.iso)"
                    >
                      {{ cell.day }}
                    </button>
                  </div>
                </div>

                <p v-if="popoverError" class="err">{{ popoverError }}</p>
              </div>

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
                      タスクから解除
                    </button>
                  </div>
                </div>
                <p v-if="popoverError" class="err member-detail-error">{{ popoverError }}</p>
              </div>

              <div
                v-else-if="activePopover === 'members'"
                ref="popoverElRef"
                class="popover popover--members"
                :style="popoverStyle"
                role="dialog"
                aria-label="メンバー"
                @click.stop
              >
                <header class="popover-header popover-header--labels">
                  <h4 class="popover-title">メンバー</h4>
                  <button
                    type="button"
                    class="popover-close"
                    :disabled="saving"
                    aria-label="閉じる"
                    @click="closePopover"
                  >✕</button>
                </header>

                <div class="popover-scroll">
                  <ul class="member-picker-list">
                    <li v-for="member in projectMembers" :key="member.id">
                      <button
                        type="button"
                        class="member-picker-row"
                        :class="{ 'member-picker-row--selected': isMemberAssigned(member.id) }"
                        :disabled="saving"
                        @click.stop="toggleMember(member)"
                      >
                        <img
                          v-if="member.avatar_url"
                          :src="member.avatar_url"
                          alt=""
                          class="member-picker-avatar"
                        />
                        <span v-else class="member-picker-initial">{{ memberInitial(member) }}</span>
                        <span class="member-picker-name">{{ memberDisplayName(member) }}</span>
                        <span v-if="isMemberAssigned(member.id)" class="member-picker-check">✓</span>
                      </button>
                    </li>
                  </ul>
                  <p v-if="!projectMembers.length" class="empty-text">プロジェクトメンバーがいません。</p>

                  <p v-if="popoverError" class="err">{{ popoverError }}</p>
                </div>
              </div>

              <div
                v-else-if="activePopover === 'labels'"
                ref="popoverElRef"
                class="popover popover--labels"
                :style="popoverStyle"
                role="dialog"
                aria-label="ラベル"
                @click.stop
              >
                <header class="popover-header popover-header--labels">
                  <h4 class="popover-title">ラベル</h4>
                  <button
                    type="button"
                    class="popover-close"
                    :disabled="saving"
                    aria-label="閉じる"
                    @click="closePopover"
                  >✕</button>
                </header>

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
                        :disabled="saving"
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
              </div>

              <div
                v-else-if="activePopover === 'heading'"
                ref="popoverElRef"
                class="popover popover--labels"
                :style="popoverStyle"
                role="dialog"
                aria-label="親タスク"
                @click.stop
              >
                <header class="popover-header popover-header--labels">
                  <h4 class="popover-title">親タスク</h4>
                  <button
                    type="button"
                    class="popover-close"
                    :disabled="saving"
                    aria-label="閉じる"
                    @click="closePopover"
                  >✕</button>
                </header>

                <input
                  v-model="headingSearchQuery"
                  type="search"
                  class="label-search-input"
                  placeholder="親タスク..."
                  :disabled="saving"
                  @click.stop
                />

                <div class="popover-scroll">
                  <ul class="label-picker-list">
                    <li>
                      <button
                        type="button"
                        class="label-picker-row"
                        :disabled="saving"
                        @click.stop="selectHeading(null)"
                      >
                        <span
                          class="label-picker-checkbox heading-picker-checkbox"
                          :class="{ 'label-picker-checkbox--checked': !task?.heading }"
                          aria-hidden="true"
                        >
                          <span v-if="!task?.heading">✓</span>
                        </span>
                        <span class="heading-picker-label heading-picker-label--none">
                          なし
                        </span>
                      </button>
                    </li>
                    <li v-for="heading in filteredProjectHeadings" :key="heading.id">
                      <button
                        type="button"
                        class="label-picker-row"
                        :disabled="saving"
                        @click.stop="selectHeading(heading)"
                      >
                        <span
                          class="label-picker-checkbox heading-picker-checkbox"
                          :class="{ 'label-picker-checkbox--checked': isHeadingSelected(heading.id) }"
                          aria-hidden="true"
                        >
                          <span v-if="isHeadingSelected(heading.id)">✓</span>
                        </span>
                        <span class="heading-picker-label">
                          {{ heading.name }}
                        </span>
                      </button>
                    </li>
                  </ul>
                  <p v-if="!filteredProjectHeadings.length" class="empty-text label-picker-empty">
                    該当する親タスクがありません。
                  </p>

                  <p v-if="popoverError" class="err">{{ popoverError }}</p>
                </div>

                <div class="heading-picker-footer">
                  <template v-if="!headingCreateOpen">
                    <button
                      type="button"
                      class="heading-create-trigger"
                      :disabled="saving || headingCreatePending"
                      @click.stop="openHeadingCreateInline"
                    >
                      <span>＋</span>親タスクの作成
                    </button>
                  </template>
                  <template v-else>
                    <input
                      ref="headingCreateInputRef"
                      v-model.trim="headingCreateDraft"
                      type="text"
                      maxlength="80"
                      class="heading-create-input"
                      placeholder="親タスク名"
                      :disabled="headingCreatePending"
                      @keydown.enter.prevent="submitHeadingCreateInline"
                      @keydown.escape.prevent="cancelHeadingCreateInline"
                      @click.stop
                    />
                    <div class="heading-create-actions">
                      <button
                        type="button"
                        class="heading-create-submit"
                        :disabled="headingCreatePending"
                        @click.stop="submitHeadingCreateInline"
                      >
                        {{ headingCreatePending ? '作成中...' : '作成' }}
                      </button>
                      <button
                        type="button"
                        class="heading-create-cancel"
                        aria-label="キャンセル"
                        :disabled="headingCreatePending"
                        @click.stop="cancelHeadingCreateInline"
                      >
                        ✕
                      </button>
                    </div>
                  </template>
                </div>
              </div>
              </div>
              </Transition>
            </Teleport>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { useApi } from '../composables/useApi'

export type TaskDetailLabel = { id: number; name: string; color: string }
export type TaskDetailHeading = { id: number; name: string }
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
  task_heading_id?: number | null
  heading?: TaskDetailHeading | null
  start_date: string | null
  due_date: string | null
  assignees: TaskDetailMember[]
  labels: TaskDetailLabel[]
}

type PopoverType = 'start-date' | 'due-date' | 'members' | 'member-detail' | 'labels' | 'heading'
type DatePickerTarget = 'start' | 'due'

type CalendarCell = {
  key: string
  iso: string
  day: number
  inMonth: boolean
  isToday: boolean
}

export type TaskDetailRemotePatch = Pick<TaskDetail, 'id'> & Partial<Omit<TaskDetail, 'id'>>

const props = withDefaults(defineProps<{
  modelValue: boolean
  orgSlug: string
  projectId: string
  taskId: number | null
  orgLabels: TaskDetailLabel[]
  projectHeadings?: TaskDetailHeading[]
  projectMembers: TaskDetailMember[]
  /** 他クライアントからの TaskUpdated など（rev が変わるたびに適用） */
  remoteUpdate?: TaskDetailRemotePatch | null
  remoteUpdateRev?: number
}>(), {
  projectHeadings: () => [],
})

const emit = defineEmits<{
  'update:modelValue': [boolean]
  updated: [TaskDetail]
  'heading-created': [TaskDetailHeading]
}>()

const { api } = useApi()

const task = ref<TaskDetail | null>(null)
const loading = ref(false)
const saving = ref(false)
const dateSaving = ref(false)
const loadError = ref<string | null>(null)
const saveError = ref<string | null>(null)

const ignoreOverlayCloseUntil = ref(0)
/** モーダル内で押し始めた操作（文字選択ドラッグなど）では外側で離しても閉じない */
const mouseDownInsideModal = ref(false)

const activePopover = ref<PopoverType | null>(null)
const selectedMember = ref<TaskDetailMember | null>(null)
const popoverError = ref<string | null>(null)
const popoverStyle = ref<Record<string, string>>({})
const modalCardRef = ref<HTMLElement | null>(null)
const modalBodyRef = ref<HTMLElement | null>(null)
const popoverElRef = ref<HTMLElement | null>(null)
const actionButtonsRef = ref<HTMLElement | null>(null)
const popoverAnchorEl = ref<HTMLElement | null>(null)
const calendarCursor = ref(new Date())
const pendingDate = ref<string | null>(null)

const titleDraft = ref('')
const titleSaving = ref(false)
const titleTextareaRef = ref<HTMLTextAreaElement | null>(null)

const descriptionDraft = ref('')
const descriptionSaving = ref(false)
const descriptionTextareaRef = ref<HTMLTextAreaElement | null>(null)

const labelSearchQuery = ref('')
const headingSearchQuery = ref('')
const projectHeadingsLocal = ref<TaskDetailHeading[]>([])
const headingSaving = ref(false)
let headingSaveRequestId = 0
const headingCreateOpen = ref(false)
const headingCreateDraft = ref('')
const headingCreatePending = ref(false)
const headingCreateInputRef = ref<HTMLInputElement | null>(null)

const effectiveProjectHeadings = computed(() => {
  if (projectHeadingsLocal.value.length) {
    return projectHeadingsLocal.value
  }
  return props.projectHeadings
})

const filteredOrgLabels = computed(() => {
  const query = labelSearchQuery.value.trim().toLowerCase()
  if (!query) return props.orgLabels
  return props.orgLabels.filter(label => label.name.toLowerCase().includes(query))
})

const filteredProjectHeadings = computed(() => {
  const query = headingSearchQuery.value.trim().toLowerCase()
  const source = effectiveProjectHeadings.value
  if (!query) return source
  return source.filter(heading => heading.name.toLowerCase().includes(query))
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

function memberDisplayName (member: TaskDetailMember): string {
  return (member.name || member.email || `ユーザー #${member.id}`).trim()
}

function memberInitial (member: TaskDetailMember): string {
  const source = memberDisplayName(member)
  return source.slice(0, 1).toUpperCase()
}

function memberEmailLine (member: TaskDetailMember): string {
  const email = member.email?.trim()
  if (email) return email
  return `@user${member.id}`
}

function resolveHeadingForDetail (detail: TaskDetail): TaskDetailHeading | null {
  if (detail.heading) {
    return detail.heading
  }
  const headingId = detail.task_heading_id
  if (headingId == null) {
    return null
  }
  return effectiveProjectHeadings.value.find(h => h.id === headingId) ?? null
}

function normalizeTaskDetail (detail: TaskDetail): TaskDetail {
  const heading = resolveHeadingForDetail(detail)
  return {
    ...detail,
    labels: detail.labels ?? [],
    assignees: detail.assignees ?? [],
    heading,
    task_heading_id: detail.task_heading_id ?? heading?.id ?? null,
  }
}

function resetState () {
  task.value = null
  loading.value = false
  saving.value = false
  dateSaving.value = false
  loadError.value = null
  saveError.value = null
  dismissPopover()
  ignoreOverlayCloseUntil.value = 0
  mouseDownInsideModal.value = false
  popoverStyle.value = {}
  popoverAnchorEl.value = null
  calendarCursor.value = new Date()
  titleDraft.value = ''
  titleSaving.value = false
  titleTextareaRef.value = null
  descriptionDraft.value = ''
  descriptionSaving.value = false
  labelSearchQuery.value = ''
  headingSearchQuery.value = ''
  projectHeadingsLocal.value = []
  headingSaving.value = false
  headingCreateOpen.value = false
  headingCreateDraft.value = ''
  headingCreatePending.value = false
  headingCreateInputRef.value = null
}

async function loadProjectHeadings () {
  try {
    const res = await api<{ data: TaskDetailHeading[] }>(
      `/orgs/${props.orgSlug}/projects/${props.projectId}/task-headings`,
    )
    projectHeadingsLocal.value = res.data ?? []
  } catch {
    projectHeadingsLocal.value = [...props.projectHeadings]
  }
}

async function loadTask () {
  if (props.taskId === null) return
  loading.value = true
  loadError.value = null
  try {
    await loadProjectHeadings()
    const detail = await api<TaskDetail>(
      `/orgs/${props.orgSlug}/projects/${props.projectId}/tasks/${props.taskId}`,
    )
    task.value = normalizeTaskDetail(detail)
    titleDraft.value = task.value.title
    nextTick(() => adjustTitleTextareaHeight())
    descriptionDraft.value = task.value.description ?? ''
  } catch (e: unknown) {
    loadError.value = e instanceof Error ? e.message : '読み込みに失敗しました'
  } finally {
    loading.value = false
  }
}

async function reload () {
  await loadTask()
}

function applyRemoteTaskPatch (patch: TaskDetailRemotePatch) {
  if (!task.value || patch.id !== task.value.id) {
    return
  }
  if (loading.value || titleSaving.value || descriptionSaving.value || saving.value || dateSaving.value || headingSaving.value) {
    return
  }

  const titleDirty = titleDraft.value.trim() !== (task.value.title ?? '').trim()
  const descDirty = descriptionDraft.value !== (task.value.description ?? '')

  task.value = normalizeTaskDetail({
    ...task.value,
    ...patch,
    labels: patch.labels ?? task.value.labels,
    assignees: patch.assignees ?? task.value.assignees,
    heading: patch.heading !== undefined ? patch.heading : task.value.heading,
    task_heading_id: patch.task_heading_id !== undefined
      ? patch.task_heading_id
      : task.value.task_heading_id,
  })

  if (!titleDirty) {
    titleDraft.value = task.value.title
  }
  if (!descDirty) {
    descriptionDraft.value = task.value.description ?? ''
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
    if (prevOpen && prevId === id) return

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

function onOverlayMouseDown (event: MouseEvent) {
  const card = modalCardRef.value
  const target = event.target
  mouseDownInsideModal.value = !!(
    card && target instanceof Node && card.contains(target)
  )
}

function hasActiveTextSelectionInModal (): boolean {
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed) return false
  const card = modalCardRef.value
  if (!card) return false
  const anchor = sel.anchorNode
  const focus = sel.focusNode
  return !!(
    (anchor && card.contains(anchor))
    || (focus && card.contains(focus))
  )
}

function onOverlayBackdropClick (event: MouseEvent) {
  const startedInside = mouseDownInsideModal.value
  mouseDownInsideModal.value = false
  if (startedInside || hasActiveTextSelectionInModal()) return
  if (event.target !== event.currentTarget) return
  close()
}

function close () {
  if (isOverlayCloseBlocked() || saving.value || titleSaving.value || descriptionSaving.value) return
  if (activePopover.value) {
    closePopover()
    return
  }
  emit('update:modelValue', false)
}

function dismissPopover () {
  activePopover.value = null
  selectedMember.value = null
  popoverError.value = null
  pendingDate.value = null
  popoverStyle.value = {}
  headingCreateOpen.value = false
  headingCreateDraft.value = ''
}

function closePopover () {
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
  const popover = popoverElRef.value
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
      `/orgs/${props.orgSlug}/projects/${props.projectId}/tasks/${task.value.id}`,
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
  if (!task.value) return
  armOverlayCloseGuard()
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
      `/orgs/${props.orgSlug}/projects/${props.projectId}/tasks/${task.value.id}`,
      { method: 'PATCH', body: { assignee_ids } },
    )
    task.value = normalizeTaskDetail(updated)
    emit('updated', task.value)
  } catch (e: unknown) {
    task.value = { ...task.value, assignees: previousAssignees }
    popoverError.value = e instanceof Error ? e.message : 'メンバーの更新に失敗しました'
  }
}

function onPopoverEscape (event: KeyboardEvent) {
  if (event.key !== 'Escape' || !activePopover.value) return
  event.stopPropagation()
  closePopover()
}

watch(activePopover, (open) => {
  if (open) {
    document.addEventListener('keydown', onPopoverEscape)
    const onResize = () => updatePopoverPosition()
    window.addEventListener('resize', onResize)
    removePopoverResizeListener = () => window.removeEventListener('resize', onResize)
    updatePopoverPosition()
  } else {
    document.removeEventListener('keydown', onPopoverEscape)
    removePopoverResizeListener?.()
    removePopoverResizeListener = null
  }
})

watch(labelSearchQuery, () => {
  if (activePopover.value === 'labels') {
    updatePopoverPosition()
  }
})

watch(headingSearchQuery, () => {
  if (activePopover.value === 'heading') {
    updatePopoverPosition()
  }
})

watch(headingCreateOpen, () => {
  if (activePopover.value === 'heading') {
    updatePopoverPosition()
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onPopoverEscape)
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
      `/orgs/${props.orgSlug}/projects/${props.projectId}/tasks/${task.value.id}`,
      { method: 'PATCH', body: { title } },
    )
    task.value = normalizeTaskDetail(updated)
    titleDraft.value = task.value.title
    nextTick(() => adjustTitleTextareaHeight())
    emit('updated', task.value)
  } catch (e: unknown) {
    saveError.value = e instanceof Error ? e.message : 'カード名の更新に失敗しました'
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

function isHeadingSelected (headingId: number): boolean {
  return task.value?.heading?.id === headingId
}

async function openHeadingPicker (event?: Event) {
  if (!task.value) return
  if (activePopover.value === 'heading') {
    closePopover()
    return
  }
  const anchorEl = capturePopoverAnchor(event)
  if (!anchorEl) return
  headingSearchQuery.value = ''
  popoverError.value = null
  headingCreateOpen.value = false
  headingCreateDraft.value = ''
  popoverAnchorEl.value = anchorEl
  activePopover.value = 'heading'
  updatePopoverPosition()
  await loadProjectHeadings()
  updatePopoverPosition()
}

function openHeadingCreateInline () {
  headingCreateOpen.value = true
  headingCreateDraft.value = ''
  popoverError.value = null
  nextTick(() => {
    headingCreateInputRef.value?.focus()
    updatePopoverPosition()
  })
}

function cancelHeadingCreateInline () {
  if (headingCreatePending.value) return
  headingCreateOpen.value = false
  headingCreateDraft.value = ''
  popoverError.value = null
  nextTick(() => updatePopoverPosition())
}

async function submitHeadingCreateInline () {
  const name = headingCreateDraft.value.trim()
  if (headingCreatePending.value) return
  if (!name) {
    cancelHeadingCreateInline()
    return
  }
  headingCreatePending.value = true
  popoverError.value = null
  try {
    const created = await api<TaskDetailHeading>(
      `/orgs/${props.orgSlug}/projects/${props.projectId}/task-headings`,
      { method: 'POST', body: { name } },
    )
    const exists = projectHeadingsLocal.value.some(h => h.id === created.id)
    if (!exists) {
      projectHeadingsLocal.value = [...projectHeadingsLocal.value, created]
        .sort((a, b) => a.name.localeCompare(b.name, 'ja'))
    }
    emit('heading-created', created)
    headingCreateOpen.value = false
    headingCreateDraft.value = ''
    nextTick(() => updatePopoverPosition())
  } catch (e: unknown) {
    popoverError.value = e instanceof Error ? e.message : '親タスクの作成に失敗しました'
  } finally {
    headingCreatePending.value = false
  }
}

async function selectHeading (heading: TaskDetailHeading | null) {
  if (!task.value) return
  armOverlayCloseGuard()

  const previousHeading = task.value.heading ?? null
  const previousId = task.value.task_heading_id ?? previousHeading?.id ?? null
  const nextId = heading?.id ?? null

  if (nextId === previousId) {
    return
  }

  const nextHeading = heading ?? (nextId != null
    ? effectiveProjectHeadings.value.find(h => h.id === nextId) ?? null
    : null)

  task.value = {
    ...task.value,
    heading: nextHeading,
    task_heading_id: nextId,
  }
  popoverError.value = null
  const requestId = ++headingSaveRequestId
  headingSaving.value = true
  try {
    const updated = await api<TaskDetail>(
      `/orgs/${props.orgSlug}/projects/${props.projectId}/tasks/${task.value.id}`,
      {
        method: 'PATCH',
        body: { task_heading_id: nextId },
        headers: { 'Content-Type': 'application/json' },
      },
    )
    if (requestId !== headingSaveRequestId) return
    task.value = normalizeTaskDetail({
      ...updated,
      heading: updated.heading ?? nextHeading,
      task_heading_id: updated.task_heading_id ?? nextId,
    })
    emit('updated', task.value)
  } catch (e: unknown) {
    if (requestId !== headingSaveRequestId) return
    task.value = {
      ...task.value,
      heading: previousHeading,
      task_heading_id: previousId,
    }
    const raw = e instanceof Error ? e.message : ''
    popoverError.value = raw.includes('task_heading_id')
      || raw.includes('task headings')
      || raw.toLowerCase().includes('column')
      ? '親タスクの保存に失敗しました。データベースのマイグレーション（php artisan migrate）が未実行の可能性があります。'
      : (raw || '親タスクの更新に失敗しました')
  } finally {
    if (requestId === headingSaveRequestId) {
      headingSaving.value = false
    }
  }
}

async function toggleLabel (label: TaskDetailLabel) {
  if (!task.value) return
  armOverlayCloseGuard()
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
      `/orgs/${props.orgSlug}/projects/${props.projectId}/tasks/${task.value.id}`,
      { method: 'PATCH', body: { label_ids } },
    )
    task.value = normalizeTaskDetail(updated)
    emit('updated', task.value)
  } catch (e: unknown) {
    task.value = { ...task.value, labels: previousLabels }
    popoverError.value = e instanceof Error ? e.message : 'ラベルの更新に失敗しました'
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
      `/orgs/${props.orgSlug}/projects/${props.projectId}/tasks/${task.value.id}`,
      { method: 'PATCH', body: { description: normalized } },
    )
    task.value = normalizeTaskDetail(updated)
    descriptionDraft.value = task.value.description ?? ''
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
  padding: 3rem 1rem 1rem;
  z-index: 70;
  overflow-y: auto;
}

.modal-overlay--popover-open {
  overflow: hidden;
}

.modal-card {
  position: relative;
  width: min(40rem, 100%);
  border-radius: 12px;
  overflow: visible;
  background: #fff;
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.18);
}

.modal-header {
  background: #0b2bab;
  color: #fff;
  padding: 0.7rem 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.05rem;
}

.icon-close {
  background: transparent;
  border: none;
  color: #fff;
  font-size: 1.4rem;
  line-height: 1;
  cursor: pointer;
  padding: 0;
  margin: -0.2rem 0;
}

.modal-body {
  position: relative;
  padding: 1.2rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  overflow: visible;
}

.modal-body--state {
  align-items: center;
  justify-content: center;
  min-height: 8rem;
}

.state-message {
  margin: 0;
  color: #475569;
  font-weight: 600;
}

.picker-heading {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 800;
  color: #0f172a;
}

.field-block {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.field-label {
  font-size: 0.82rem;
  font-weight: 700;
  color: #475569;
}

.title-block {
  margin-bottom: 0.1rem;
  gap: 0;
}

.task-detail-heading {
  display: block;
  width: 100%;
  padding: 0;
  border: none;
  background: transparent;
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.3;
  color: #64748b;
  text-align: left;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-detail-heading:hover:not(:disabled) {
  color: #475569;
}

.task-detail-heading:disabled {
  cursor: default;
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

.title-input:focus {
  outline: none;
  border-color: #2563eb;
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
  border: 1px solid #cbd5e1;
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

.action-btn--active {
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

.popover-layer--portal .popover-backdrop {
  pointer-events: auto;
}

.popover-layer--portal .popover {
  position: fixed;
  margin: 0;
  pointer-events: auto;
}

.popover-backdrop {
  position: absolute;
  inset: 0;
  background: transparent;
}

.popover-layer--portal .popover-backdrop {
  position: fixed;
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

.label-search-input {
  display: block;
  width: calc(100% - 1.3rem);
  margin: 0.55rem 0.65rem 0.45rem;
  box-sizing: border-box;
  border: 2px solid mixin.$accent-border;
  border-radius: 6px;
  padding: 0.45rem 0.55rem;
  font-size: 0.88rem;
  color: #172b4d;
}

.label-search-input:focus {
  outline: none;
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
  display: flex;
  align-items: center;
  gap: 0.4rem;
  width: 100%;
  border: none;
  background: transparent;
  padding: 0.15rem 0;
  cursor: pointer;
  text-align: left;
}

.label-picker-row:hover:not(:disabled) .label-picker-bar {
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

.heading-picker-checkbox {
  border-radius: 999px;
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

.label-picker-empty {
  padding: 0 0.65rem 0.75rem;
}

.heading-picker-label {
  flex: 1;
  min-width: 0;
  padding: 0.35rem 0.55rem;
  border-radius: 6px;
  background: #fff;
  color: #0f172a;
  font-size: 0.88rem;
  font-weight: 700;
  text-align: left;
}

.heading-picker-label--none {
  color: #64748b;
  font-weight: 600;
}

.heading-picker-footer {
  flex-shrink: 0;
  padding: 0.6rem;
  border-top: 1px solid #dfe1e6;
}

.heading-create-trigger {
  width: 100%;
  border: none;
  border-radius: 8px;
  background: mixin.$gray;
  padding: 0.45rem 0.35rem;
  font-size: 0.88rem;
  font-weight: 700;
  color: mixin.$text;
  text-align: left;
  cursor: pointer;
}

.heading-create-input {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 0.5rem 0.6rem;
  font-size: 0.88rem;
  color: #0f172a;
  background: #fff;
}

.heading-create-input:focus {
  outline: none;
  border-color: #2563eb;
}

.heading-create-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 0.45rem;
}

.heading-create-submit {
  border: none;
  border-radius: 6px;
  background: mixin.$main;
  color: mixin.$white;
  padding: 0.45rem 0.85rem;
  font-size: 0.88rem;
  font-weight: 700;
  line-height: 1.2;
  cursor: pointer;
  flex-shrink: 0;
}

.heading-create-cancel {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: #44546f;
  font-size: 1.15rem;
  font-weight: 400;
  line-height: 1;
  padding: 0.2rem 0.35rem;
  cursor: pointer;
  flex-shrink: 0;
}

.heading-create-submit:disabled,
.heading-create-cancel:disabled,
.heading-create-trigger:disabled {
  opacity: 0.55;
  cursor: not-allowed;
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
  font-size: 0.9rem;
  line-height: 1;
}

.detail-dates-row {
  display: flex;
  gap: 1rem;
}

.detail-item--date {
  flex: 1;
  min-width: 0;
}

.detail-item--date .detail-value-btn {
  font-size: 1.2rem;
  padding: 0.45rem 0.7rem;
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
  border: 1px solid #cbd5e1;
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

.member-picker-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.member-picker-row {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  width: 100%;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 0.5rem 0.65rem;
  background: #fff;
  cursor: pointer;
  text-align: left;
}

.member-picker-row:hover:not(:disabled) {
  background: #f8fafc;
}

.member-picker-row--selected {
  border-color: mixin.$main;
  background: color-mix(in srgb, mixin.$main 8%, mixin.$white);
}

.member-picker-name {
  flex: 1;
  font-size: 0.9rem;
  font-weight: 700;
  color: #0f172a;
}

.member-picker-check {
  color: #0891b2;
  font-weight: 800;
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
  border: 1px solid #cbd5e1;
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
  margin-top: 0.15rem;
}

.description-textarea {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 0.6rem 0.7rem;
  font: inherit;
  font-size: 0.94rem;
  color: #0f172a;
  resize: vertical;
  min-height: 6rem;
}

.description-textarea:focus {
  outline: none;
  border-color: #2563eb;
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
  color: #475569;
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

button:disabled {
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
  border: 1px solid #cbd5e1;
  background: #fff;
  color: #64748b;
}

.member-avatar-btn-plus {
  font-size: 1.2rem;
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
  font-size: 0.78rem;
  font-weight: 800;
  border-radius: 999px;
}

.member-picker-avatar {
  width: 1.35rem;
  height: 1.35rem;
  border-radius: 999px;
  object-fit: cover;
}

.member-picker-initial {
  width: 1.35rem;
  height: 1.35rem;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #dbeafe;
  color: #1e3a8a;
  font-size: 0.72rem;
  font-weight: 800;
}
</style>
