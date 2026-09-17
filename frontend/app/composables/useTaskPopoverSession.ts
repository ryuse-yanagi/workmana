import type { Ref } from 'vue'
import type { LabelCategoryGroup } from './useLabelCategories'
import {
  filterLabelCategories,
  labelCategoriesFromFlat,
} from './useLabelCategories'
import { isInsideFloatingPopover } from '../utils/uiInteraction'
import { popoverPositionVisibilityStyle } from '../utils/popoverScrollbar'
import { useExclusivePopover } from './useExclusivePopover'
import type { TaskFormLabel } from './useTaskFormHelpers'

export type TaskPopoverLeaveCloseContext = {
  leaveDone: Promise<void>
  resolveLeaveWait: () => void
  dismiss: () => void
}

/**
 * effort / progress-rate など、finalize が成功時に dismiss する閉じ方の共通処理。
 * finalize 後も開いたままなら leave wait を解除して true。閉じ切ったら leave 完了を待って true。
 */
export async function runPopoverFinalizeClose (
  finalize: () => Promise<void>,
  isStillOpen: () => boolean,
  ctx: TaskPopoverLeaveCloseContext,
): Promise<true> {
  await finalize()
  if (isStillOpen()) {
    ctx.resolveLeaveWait()
    return true
  }
  await ctx.leaveDone
  return true
}

export function useFilteredTaskLabels (options: {
  orgLabels: Ref<TaskFormLabel[]>
  labelCategories?: Ref<LabelCategoryGroup[]>
  labelSearchQuery: Ref<string>
}) {
  const filteredOrgLabels = computed(() => {
    const query = options.labelSearchQuery.value.trim().toLowerCase()
    if (!query) return options.orgLabels.value
    return options.orgLabels.value.filter(label => label.name.toLowerCase().includes(query))
  })
  const filteredLabelCategories = computed(() => {
    return filterLabelCategories(
      labelCategoriesFromFlat(options.labelCategories?.value, options.orgLabels.value),
      options.labelSearchQuery.value,
    )
  })
  return { filteredOrgLabels, filteredLabelCategories }
}

type UseTaskPopoverSessionOptions<T extends string> = {
  activePopover: Ref<T | null>
  popoverStyle: Ref<Record<string, string>>
  selectedMember: Ref<unknown | null>
  popoverError: Ref<string | null>
  pendingDate: Ref<string | null>
  /** dismiss 時の追加クリーンアップ（mutation lock 解除など） */
  onDismiss?: () => void
  /**
   * 型固有の閉じ処理。true なら leave wait まで含めて処理済み。
   * false ならデフォルトの dismiss → leave 待ちへ進む。
   */
  tryFinalizeClose?: (active: T, ctx: TaskPopoverLeaveCloseContext) => Promise<boolean>
  shouldIgnoreOutsideClose: (target: Node) => boolean
  /**
   * 共有の外側クリックガード通過後。
   * close / dismiss のどちらかで dismissPopoverFromOutsidePointer を呼ぶ。
   */
  handleOutsideClose: (
    target: Node,
    close: () => void,
    dismiss: () => void,
  ) => void
  resolvePopoverElement: () => HTMLElement | null
  updatePopoverPosition: () => void
}

/**
 * タスク系ポップオーバーの共有ライフサイクルのみ。
 * 配置（position）はエディタ／フォームで異なるためここには含めない。
 */
export function useTaskPopoverSession<T extends string> (
  options: UseTaskPopoverSessionOptions<T>,
) {
  let removePopoverResizeListener: (() => void) | null = null
  let popoverLeaveResolve: (() => void) | null = null

  function dismissPopover () {
    options.activePopover.value = null
    options.selectedMember.value = null
    options.popoverError.value = null
    options.pendingDate.value = null
    // popoverStyle は leave 完了後に消す（フェードアウトを維持）
    options.onDismiss?.()
  }

  function resolvePopoverLeaveWait () {
    popoverLeaveResolve?.()
    popoverLeaveResolve = null
  }

  function notifyPopoverAfterLeave () {
    if (options.activePopover.value == null) {
      options.popoverStyle.value = popoverPositionVisibilityStyle(false)
    }
    resolvePopoverLeaveWait()
  }

  function armPopoverLeaveWait (): Promise<void> {
    return new Promise((resolve) => {
      const previous = popoverLeaveResolve
      popoverLeaveResolve = resolve
      previous?.()
    })
  }

  async function closePopover () {
    const active = options.activePopover.value
    if (active == null) {
      return
    }
    const leaveDone = armPopoverLeaveWait()
    const ctx: TaskPopoverLeaveCloseContext = {
      leaveDone,
      resolveLeaveWait: resolvePopoverLeaveWait,
      dismiss: dismissPopover,
    }
    if (options.tryFinalizeClose) {
      const handled = await options.tryFinalizeClose(active, ctx)
      if (handled) return
    }
    dismissPopover()
    await leaveDone
  }

  /**
   * 別ポップオーバーへ切り替える前に現在のものを閉じる。
   * 同種トグルなら閉じただけで false。不正入力で閉じられなかった場合も false。
   */
  async function beginPopoverOpen (next: T): Promise<boolean> {
    const current = options.activePopover.value
    if (current === next) {
      await closePopover()
      return false
    }
    if (current != null) {
      await closePopover()
      if (options.activePopover.value != null) return false
    }
    return true
  }

  useExclusivePopover(
    () => options.activePopover.value != null,
    () => { void closePopover() },
  )

  function handlePopoverOutsidePointerUp (event: MouseEvent) {
    if (!options.activePopover.value || event.button !== 0) return
    const target = event.target
    if (!(target instanceof Node)) return
    if (isInsideFloatingPopover(target)) return
    if (options.resolvePopoverElement()?.contains(target)) return
    if (options.shouldIgnoreOutsideClose(target)) return
    options.handleOutsideClose(target, closePopover, dismissPopover)
  }

  function onPopoverEscape (event: KeyboardEvent) {
    if (event.key !== 'Escape' || !options.activePopover.value) return
    event.preventDefault()
    event.stopPropagation()
    void closePopover()
  }

  function bindPopoverListeners () {
    document.addEventListener('keydown', onPopoverEscape)
    document.addEventListener('mouseup', handlePopoverOutsidePointerUp, true)
    const onResize = () => options.updatePopoverPosition()
    window.addEventListener('resize', onResize)
    removePopoverResizeListener = () => window.removeEventListener('resize', onResize)
  }

  function unbindPopoverListeners () {
    document.removeEventListener('keydown', onPopoverEscape)
    document.removeEventListener('mouseup', handlePopoverOutsidePointerUp, true)
    removePopoverResizeListener?.()
    removePopoverResizeListener = null
  }

  watch(options.activePopover, (next, prev) => {
    if (next && !prev) {
      bindPopoverListeners()
      return
    }
    if (!next && prev) {
      unbindPopoverListeners()
    }
  })

  onBeforeUnmount(() => {
    unbindPopoverListeners()
  })

  return {
    dismissPopover,
    closePopover,
    beginPopoverOpen,
    notifyPopoverAfterLeave,
    resolvePopoverLeaveWait,
    armPopoverLeaveWait,
  }
}
