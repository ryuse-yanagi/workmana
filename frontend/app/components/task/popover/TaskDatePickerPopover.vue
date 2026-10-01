<template>
  <PopoverShell
    ref="shellRef"
    shell-class="popover popover--date"
    :style="style"
    :title="title"
    :aria-label="ariaLabel ?? title"
    :close-disabled="disabled"
    :show-clear="canClear"
    :clear-disabled="disabled"
    @close="$emit('close')"
    @clear="$emit('clear')"
  >
    <div
      class="calendar"
      :class="{ 'calendar--dragging': !!dragSession }"
    >
      <div class="calendar-nav">
        <button
          type="button"
          class="calendar-nav-btn"
          :disabled="disabled || !!dragSession"
          aria-label="前の月"
          @click="$emit('shift-month', -1)"
        >‹</button>
        <span class="calendar-month-label">{{ calendarMonthLabel }}</span>
        <button
          type="button"
          class="calendar-nav-btn"
          :disabled="disabled || !!dragSession"
          aria-label="次の月"
          @click="$emit('shift-month', 1)"
        >›</button>
      </div>
      <div class="calendar-weekdays">
        <span
          v-for="day in resolvedWeekdayLabels"
          :key="day"
          class="calendar-weekday"
        >{{ day }}</span>
      </div>
      <div
        ref="gridRef"
        class="calendar-grid"
        @pointerdown="onGridPointerDown"
        @pointermove="onGridPointerMove"
        @pointerup="onGridPointerUp"
        @pointercancel="onGridPointerCancel"
      >
        <button
          v-for="cell in calendarCells"
          :key="cell.key"
          type="button"
          class="calendar-day"
          :class="dayClass(cell)"
          :data-iso="cell.iso"
          :aria-disabled="cell.disabled || undefined"
          @keydown.enter.prevent="onPickDay(cell)"
          @keydown.space.prevent="onPickDay(cell)"
        >
          {{ cell.day }}
        </button>
      </div>
    </div>
    <p v-if="error" class="err">{{ error }}</p>
  </PopoverShell>
</template>

<script setup lang="ts">
import PopoverShell from '../../ui/PopoverShell.vue'
import { orderTaskDateRange } from '../../../composables/task/useTaskFormHelpers'
import {
  TASK_POPOVER_WEEKDAY_LABELS,
  type TaskPopoverCalendarCell,
} from '../../../utils/task/taskPopoverTypes'

type DragMode = 'create' | 'resize-start' | 'resize-end' | 'click'
type DragSession = {
  mode: DragMode
  pointerId: number
  /** create: 起点 / resize-*: 動かしている端の初期値 / click: 押下日 */
  originIso: string
  /** resize 時の動かさない側 */
  fixedIso: string | null
  currentIso: string
  moved: boolean
}

const props = withDefaults(defineProps<{
  title: string
  ariaLabel?: string
  style?: Record<string, string>
  disabled?: boolean
  canClear?: boolean
  error?: string | null
  calendarMonthLabel: string
  calendarCells: TaskPopoverCalendarCell[]
  /** @deprecated 単日選択。期間モードでは rangeStartIso / rangeEndIso を使う */
  selectedIso?: string | null
  rangeStartIso?: string | null
  rangeEndIso?: string | null
  weekdayLabels?: readonly string[]
}>(), {
  disabled: false,
  canClear: false,
  error: null,
  selectedIso: null,
  rangeStartIso: null,
  rangeEndIso: null,
  weekdayLabels: undefined,
})

const emit = defineEmits<{
  close: []
  'shift-month': [delta: number]
  pick: [iso: string]
  'pick-range': [range: { start_date: string; due_date: string }]
  'invalid-pick': [iso: string]
  clear: []
}>()

const shellRef = ref<InstanceType<typeof PopoverShell> | null>(null)
const gridRef = ref<HTMLElement | null>(null)
const dragSession = ref<DragSession | null>(null)

const resolvedWeekdayLabels = computed(() => (
  props.weekdayLabels?.length
    ? props.weekdayLabels
    : TASK_POPOVER_WEEKDAY_LABELS
))

const committedRangeStart = computed(() => props.rangeStartIso || props.selectedIso || null)
const committedRangeEnd = computed(() => props.rangeEndIso || props.rangeStartIso || props.selectedIso || null)

const previewRange = computed(() => {
  const session = dragSession.value
  if (!session || session.mode === 'click' || !session.moved) return null
  if (session.mode === 'create') {
    return orderTaskDateRange(session.originIso, session.currentIso)
  }
  if (session.mode === 'resize-start' && session.fixedIso) {
    return orderTaskDateRange(session.currentIso, session.fixedIso)
  }
  if (session.mode === 'resize-end' && session.fixedIso) {
    return orderTaskDateRange(session.fixedIso, session.currentIso)
  }
  return null
})

const displayRangeStart = computed(() => previewRange.value?.start_date ?? committedRangeStart.value)
const displayRangeEnd = computed(() => previewRange.value?.due_date ?? committedRangeEnd.value)

function dayClass (cell: TaskPopoverCalendarCell) {
  const start = displayRangeStart.value
  const end = displayRangeEnd.value
  const inRange = !!(start && end && cell.iso > start && cell.iso < end)
  const isStart = !!(start && cell.iso === start)
  const isEnd = !!(end && cell.iso === end)
  const isEndpoint = !!(
    committedRangeStart.value
    && committedRangeEnd.value
    && (cell.iso === committedRangeStart.value || cell.iso === committedRangeEnd.value)
  )
  return {
    'calendar-day--outside': !cell.inMonth,
    'calendar-day--selected': isStart || isEnd,
    'calendar-day--range-start': isStart && !!end && start !== end,
    'calendar-day--range-end': isEnd && !!start && start !== end,
    'calendar-day--in-range': inRange,
    'calendar-day--today': cell.isToday,
    'calendar-day--disabled': cell.disabled,
    'calendar-day--endpoint': isEndpoint,
    'calendar-day--drag-origin': !!dragSession.value
      && dragSession.value.mode !== 'click'
      && cell.iso === dragSession.value.originIso,
  }
}

function resolveCellFromPoint (clientX: number, clientY: number): TaskPopoverCalendarCell | null {
  const el = document.elementFromPoint(clientX, clientY)
  if (!(el instanceof Element)) return null
  const dayEl = el.closest('.calendar-day')
  if (!(dayEl instanceof HTMLElement)) return null
  if (!gridRef.value?.contains(dayEl)) return null
  const iso = dayEl.dataset.iso
  if (!iso) return null
  return props.calendarCells.find(cell => cell.iso === iso) ?? null
}

function beginDrag (cell: TaskPopoverCalendarCell, pointerId: number) {
  const start = committedRangeStart.value
  const end = committedRangeEnd.value
  let mode: DragMode = 'click'
  let fixedIso: string | null = null

  if (!start || !end) {
    mode = 'create'
  } else if (start === end && cell.iso === start) {
    // 1日期間: ドラッグで伸ばす
    mode = 'create'
  } else if (cell.iso === start) {
    mode = 'resize-start'
    fixedIso = end
  } else if (cell.iso === end) {
    mode = 'resize-end'
    fixedIso = start
  }

  dragSession.value = {
    mode,
    pointerId,
    originIso: cell.iso,
    fixedIso,
    currentIso: cell.iso,
    moved: false,
  }
}

function onGridPointerDown (event: PointerEvent) {
  if (props.disabled || event.button !== 0) return
  const target = event.target
  if (!(target instanceof Element)) return
  const dayEl = target.closest('.calendar-day')
  if (!(dayEl instanceof HTMLElement) || !gridRef.value?.contains(dayEl)) return
  const iso = dayEl.dataset.iso
  if (!iso) return
  const cell = props.calendarCells.find(entry => entry.iso === iso)
  if (!cell || cell.disabled) {
    if (cell?.disabled) emit('invalid-pick', iso)
    return
  }
  event.preventDefault()
  beginDrag(cell, event.pointerId)
  gridRef.value?.setPointerCapture(event.pointerId)
}

function onGridPointerMove (event: PointerEvent) {
  const session = dragSession.value
  if (!session || session.pointerId !== event.pointerId) return
  if (session.mode === 'click') return
  const cell = resolveCellFromPoint(event.clientX, event.clientY)
  if (!cell || cell.disabled) return
  if (cell.iso === session.currentIso) return
  dragSession.value = {
    ...session,
    currentIso: cell.iso,
    moved: cell.iso !== session.originIso || session.moved,
  }
}

function finishDrag (event: PointerEvent) {
  const session = dragSession.value
  if (!session || session.pointerId !== event.pointerId) return

  const preview = (() => {
    if (session.mode === 'click' || !session.moved) return null
    if (session.mode === 'create') {
      return orderTaskDateRange(session.originIso, session.currentIso)
    }
    if (session.mode === 'resize-start' && session.fixedIso) {
      return orderTaskDateRange(session.currentIso, session.fixedIso)
    }
    if (session.mode === 'resize-end' && session.fixedIso) {
      return orderTaskDateRange(session.fixedIso, session.currentIso)
    }
    return null
  })()

  if (preview) {
    const committedStart = committedRangeStart.value
    const committedEnd = committedRangeEnd.value
    if (
      preview.start_date !== committedStart
      || preview.due_date !== committedEnd
    ) {
      emit('pick-range', preview)
    }
  } else {
    // pointerdown の preventDefault で click が来ないため、ここで単日選択を発火
    emit('pick', session.originIso)
  }

  if (gridRef.value?.hasPointerCapture(event.pointerId)) {
    gridRef.value.releasePointerCapture(event.pointerId)
  }
  dragSession.value = null
}

function onGridPointerUp (event: PointerEvent) {
  finishDrag(event)
}

function onGridPointerCancel (event: PointerEvent) {
  if (dragSession.value?.pointerId === event.pointerId) {
    if (gridRef.value?.hasPointerCapture(event.pointerId)) {
      gridRef.value.releasePointerCapture(event.pointerId)
    }
    dragSession.value = null
  }
}

function onPickDay (cell: TaskPopoverCalendarCell) {
  if (props.disabled) return
  if (cell.disabled) {
    emit('invalid-pick', cell.iso)
    return
  }
  emit('pick', cell.iso)
}

defineExpose({
  get rootRef () {
    return shellRef.value?.rootRef ?? null
  },
})
</script>

<style lang="scss" scoped src="~/assets/styles/components/task/popover/taskFieldPopovers.scss"></style>
