import type { Ref } from 'vue'
import {
  sortLabelsByCatalogOrder,
} from './useLabelCategories'
import { sortMembersByDisplayName } from './useMemberDisplay'
import {
  type TaskFormCategory,
  type TaskFormDraft,
  type TaskFormLabel,
  type TaskFormMember,
  normalizeEffortHours,
  normalizeProgressRate,
  parseEffortDraft,
  parseProgressRateDraft,
  resolveTaskDateRangePick,
  sanitizeEffortDraftInput,
  sanitizeProgressRateDraftInput,
  toDateInputValue,
} from './useTaskFormHelpers'
import type { TaskFormPopoverType } from './useTaskFormPane'

type UseTaskFormPaneDraftsOptions = {
  draft: Ref<TaskFormDraft>
  orgLabels: Ref<TaskFormLabel[]>
  disabled: Ref<boolean>
  activePopover: Ref<TaskFormPopoverType | null>
  pendingDate: Ref<string | null>
  popoverError: Ref<string | null>
  effortDraft: Ref<string | number>
  progressRateDraft: Ref<string | number>
  resolveEffortInputEl: () => HTMLInputElement | null
  resolveProgressRateInputEl: () => HTMLInputElement | null
  dismissPopover: () => void
}

/**
 * TaskFormPane のドラフト更新（期間・工数・進捗・担当・ラベル・ステータス・カテゴリ）。
 * ポップオーバーの開閉・配置とは分離する。
 */
export function useTaskFormPaneDrafts (options: UseTaskFormPaneDraftsOptions) {
  const canClearCalendarDate = computed(() => (
    !!(toDateInputValue(options.draft.value.start_date) || toDateInputValue(options.draft.value.due_date))
  ))
  const periodRangeStartIso = computed(() => toDateInputValue(options.draft.value.start_date) || null)
  const periodRangeEndIso = computed(() => toDateInputValue(options.draft.value.due_date) || null)
  const canClearEffort = computed(() => String(options.effortDraft.value ?? '').trim() !== '')
  const canClearProgressRate = computed(() => String(options.progressRateDraft.value ?? '').trim() !== '')
  const canClearAssignees = computed(() => options.draft.value.assignees.length > 0)
  const canClearLabels = computed(() => options.draft.value.labels.length > 0)
  const canClearStatus = computed(() => options.draft.value.status != null)
  const canClearCategory = computed(() => options.draft.value.category != null)

  function applyPeriodRange (nextRange: { start_date: string; due_date: string }) {
    options.pendingDate.value = nextRange.start_date
    options.popoverError.value = null
    options.draft.value = {
      ...options.draft.value,
      start_date: nextRange.start_date,
      due_date: nextRange.due_date,
    }
  }

  function pickCalendarDay (iso: string) {
    if (options.activePopover.value !== 'period') return
    const nextRange = resolveTaskDateRangePick(
      iso,
      options.draft.value.start_date,
      options.draft.value.due_date,
    )
    if (!nextRange) {
      options.popoverError.value = null
      return
    }
    applyPeriodRange(nextRange)
  }

  function pickCalendarRange (range: { start_date: string; due_date: string }) {
    if (options.activePopover.value !== 'period') return
    applyPeriodRange(range)
  }

  function clearCalendarDate () {
    if (options.activePopover.value !== 'period') return
    options.pendingDate.value = null
    options.popoverError.value = null
    options.draft.value = {
      ...options.draft.value,
      start_date: null,
      due_date: null,
    }
  }

  function clearEffortDraft () {
    if (options.disabled.value) return
    options.effortDraft.value = ''
    options.popoverError.value = null
    const inputEl = options.resolveEffortInputEl()
    if (inputEl) {
      inputEl.value = ''
    }
    options.draft.value = {
      ...options.draft.value,
      effort_hours: null,
    }
  }

  function clearProgressRateDraft () {
    if (options.disabled.value) return
    options.progressRateDraft.value = ''
    options.popoverError.value = null
    const inputEl = options.resolveProgressRateInputEl()
    if (inputEl) {
      inputEl.value = ''
    }
    options.draft.value = {
      ...options.draft.value,
      progress_rate: null,
    }
  }

  function clearAssignees () {
    if (options.disabled.value) return
    if (!options.draft.value.assignees.length) return
    options.draft.value = {
      ...options.draft.value,
      assignees: [],
    }
    options.popoverError.value = null
  }

  function clearLabels () {
    if (options.disabled.value) return
    if (!options.draft.value.labels.length) return
    options.draft.value = {
      ...options.draft.value,
      labels: [],
    }
    options.popoverError.value = null
  }

  function clearStatus () {
    if (options.disabled.value) return
    if (!options.draft.value.status) return
    options.draft.value = {
      ...options.draft.value,
      status: null,
    }
    options.popoverError.value = null
  }

  function clearCategory () {
    if (options.disabled.value) return
    if (!options.draft.value.category) return
    options.draft.value = {
      ...options.draft.value,
      category: null,
    }
    options.popoverError.value = null
  }

  function updateEffortDraft (raw: string | number) {
    const sanitized = sanitizeEffortDraftInput(String(raw ?? ''))
    options.effortDraft.value = sanitized
    const inputEl = options.resolveEffortInputEl()
    if (inputEl && inputEl.value !== sanitized) {
      inputEl.value = sanitized
    }
  }

  function updateProgressRateDraft (raw: string | number) {
    const sanitized = sanitizeProgressRateDraftInput(String(raw ?? ''))
    options.progressRateDraft.value = sanitized
    const inputEl = options.resolveProgressRateInputEl()
    if (inputEl && inputEl.value !== sanitized) {
      inputEl.value = sanitized
    }
  }

  async function finalizeEffortPopover () {
    const closing = options.activePopover.value
    if (closing !== 'effort') return
    const parsed = parseEffortDraft(options.effortDraft.value)
    if (parsed === 'invalid') {
      options.popoverError.value = '工数は0以上の数値で入力してください'
      return
    }
    options.popoverError.value = null
    if (parsed !== null) {
      const effortHours = normalizeEffortHours(parsed)
      options.draft.value = {
        ...options.draft.value,
        effort_hours: effortHours,
      }
    } else {
      options.draft.value = {
        ...options.draft.value,
        effort_hours: null,
      }
    }
    if (options.activePopover.value !== closing) return
    options.dismissPopover()
  }

  async function finalizeProgressRatePopover () {
    const closing = options.activePopover.value
    if (closing !== 'progress-rate') return
    const parsed = parseProgressRateDraft(options.progressRateDraft.value)
    if (parsed === 'invalid') {
      options.popoverError.value = '進捗率は0〜100の整数で入力してください'
      return
    }
    options.popoverError.value = null
    if (parsed !== null) {
      const progressRate = normalizeProgressRate(parsed)
      options.draft.value = {
        ...options.draft.value,
        progress_rate: progressRate,
      }
    } else {
      options.draft.value = {
        ...options.draft.value,
        progress_rate: null,
      }
    }
    if (options.activePopover.value !== closing) return
    options.dismissPopover()
  }

  function isMemberAssigned (memberId: number): boolean {
    return options.draft.value.assignees.some(member => member.id === memberId)
  }

  function isLabelSelected (labelId: number): boolean {
    return options.draft.value.labels.some(label => label.id === labelId)
  }

  function isCategorySelected (categoryName: string): boolean {
    return options.draft.value.category?.name === categoryName
  }

  function isStatusSelected (statusName: string): boolean {
    return options.draft.value.status?.name === statusName
  }

  function toggleMember (member: TaskFormMember) {
    if (options.disabled.value) return
    const current = options.draft.value.assignees
    const exists = current.some(item => item.id === member.id)
    options.draft.value = {
      ...options.draft.value,
      assignees: sortMembersByDisplayName(
        exists
          ? current.filter(item => item.id !== member.id)
          : [...current, member],
      ),
    }
    options.popoverError.value = null
  }

  function removeMember (member: TaskFormMember) {
    options.draft.value = {
      ...options.draft.value,
      assignees: options.draft.value.assignees.filter(item => item.id !== member.id),
    }
    options.dismissPopover()
  }

  function toggleLabel (label: TaskFormLabel) {
    if (options.disabled.value) return
    const current = options.draft.value.labels
    const exists = current.some(item => item.id === label.id)
    options.draft.value = {
      ...options.draft.value,
      labels: sortLabelsByCatalogOrder(
        exists
          ? current.filter(item => item.id !== label.id)
          : [...current, label],
        options.orgLabels.value,
      ),
    }
    options.popoverError.value = null
  }

  function selectCategory (category: TaskFormCategory) {
    if (options.disabled.value) return
    options.draft.value = {
      ...options.draft.value,
      category: isCategorySelected(category.name) ? null : category,
    }
    options.popoverError.value = null
  }

  function selectStatus (status: TaskFormCategory) {
    if (options.disabled.value) return
    options.draft.value = {
      ...options.draft.value,
      status: isStatusSelected(status.name) ? null : status,
    }
    options.popoverError.value = null
  }

  return {
    canClearCalendarDate,
    periodRangeStartIso,
    periodRangeEndIso,
    canClearEffort,
    canClearProgressRate,
    canClearAssignees,
    canClearLabels,
    canClearStatus,
    canClearCategory,
    pickCalendarDay,
    pickCalendarRange,
    clearCalendarDate,
    clearEffortDraft,
    clearProgressRateDraft,
    clearAssignees,
    clearLabels,
    clearStatus,
    clearCategory,
    updateEffortDraft,
    updateProgressRateDraft,
    finalizeEffortPopover,
    finalizeProgressRatePopover,
    isMemberAssigned,
    isLabelSelected,
    isCategorySelected,
    isStatusSelected,
    toggleMember,
    removeMember,
    toggleLabel,
    selectCategory,
    selectStatus,
  }
}
