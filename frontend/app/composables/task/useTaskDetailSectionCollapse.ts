import { useCurrentUser } from '../auth/useCurrentUser'
import { getCurrentUserIdState } from '../auth/currentUserIdState'

export type TaskDetailSectionCollapseTarget =
  | { type: 'attachments'; taskId: number }
  | { type: 'checklist'; taskId: number; checklistId: number }

const DEFAULT_COLLAPSED = false

function storageKey (userId: number, target: TaskDetailSectionCollapseTarget): string {
  if (target.type === 'attachments') {
    return `tm:ui:${userId}:task-section-collapsed:attachments:${target.taskId}`
  }
  return `tm:ui:${userId}:task-section-collapsed:checklist:${target.taskId}:${target.checklistId}`
}

function parseStored (raw: string | null): boolean | null {
  if (raw === '1' || raw === 'true') {
    return true
  }
  if (raw === '0' || raw === 'false') {
    return false
  }
  return null
}

function readStored (userId: number, target: TaskDetailSectionCollapseTarget): boolean | null {
  if (!import.meta.client) {
    return null
  }
  try {
    return parseStored(localStorage.getItem(storageKey(userId, target)))
  } catch {
    return null
  }
}

function writeStored (
  userId: number,
  target: TaskDetailSectionCollapseTarget,
  collapsed: boolean,
) {
  if (!import.meta.client) {
    return
  }
  try {
    localStorage.setItem(storageKey(userId, target), collapsed ? '1' : '0')
  } catch {
    // private mode 等で書けなくても UI 操作は続行
  }
}

/**
 * タスク詳細の添付／チェックリスト折りたたみをユーザー UI 設定として保持する。
 * （ブラウザ localStorage・ユーザー ID + タスク ID 単位。リロード後も復元）
 */
export function useTaskDetailSectionCollapse (
  target: MaybeRefOrGetter<TaskDetailSectionCollapseTarget | null>,
) {
  const { ensureCurrentUser } = useCurrentUser()
  const collapsed = ref(DEFAULT_COLLAPSED)
  let resolvedUserId: number | null = null
  let suppressPersist = false

  function resolveTarget (): TaskDetailSectionCollapseTarget | null {
    return toValue(target)
  }

  function applyStoredForUser (userId: number, nextTarget: TaskDetailSectionCollapseTarget) {
    resolvedUserId = userId
    const stored = readStored(userId, nextTarget)
    suppressPersist = true
    collapsed.value = stored ?? DEFAULT_COLLAPSED
    suppressPersist = false
  }

  function resetCollapsed () {
    suppressPersist = true
    collapsed.value = DEFAULT_COLLAPSED
    suppressPersist = false
  }

  async function hydrateCollapsePreference () {
    if (!import.meta.client) {
      return
    }
    const nextTarget = resolveTarget()
    if (nextTarget == null) {
      resetCollapsed()
      return
    }
    const knownUserId = getCurrentUserIdState().value
    if (knownUserId != null) {
      applyStoredForUser(knownUserId, nextTarget)
    } else {
      resetCollapsed()
    }
    const userId = await ensureCurrentUser()
    if (userId == null) {
      return
    }
    applyStoredForUser(userId, nextTarget)
  }

  async function persistCollapsed (next: boolean) {
    if (!import.meta.client || suppressPersist) {
      return
    }
    const nextTarget = resolveTarget()
    if (nextTarget == null) {
      return
    }
    const userId = resolvedUserId ?? await ensureCurrentUser()
    if (userId == null) {
      return
    }
    resolvedUserId = userId
    writeStored(userId, nextTarget, next)
  }

  function setCollapsed (next: boolean) {
    if (collapsed.value === next) {
      return
    }
    collapsed.value = next
    void persistCollapsed(next)
  }

  function toggleCollapsed () {
    setCollapsed(!collapsed.value)
  }

  watch(
    () => {
      const next = resolveTarget()
      if (next == null) {
        return null
      }
      if (next.type === 'attachments') {
        return `attachments:${next.taskId}`
      }
      return `checklist:${next.taskId}:${next.checklistId}`
    },
    () => {
      void hydrateCollapsePreference()
    },
    { immediate: true },
  )

  return {
    collapsed,
    setCollapsed,
    toggleCollapsed,
    hydrateCollapsePreference,
  }
}

