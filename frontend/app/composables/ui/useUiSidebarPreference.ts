import { useCurrentUser } from '../auth/useCurrentUser'
import { getCurrentUserIdState } from '../auth/currentUserIdState'

export type UiSidebarKind = 'workspace' | 'document'

const DEFAULT_OPEN = true

function storageKey (userId: number, kind: UiSidebarKind): string {
  return `tm:ui:${userId}:sidebar-open:${kind}`
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

function readStored (userId: number, kind: UiSidebarKind): boolean | null {
  if (!import.meta.client) {
    return null
  }
  try {
    return parseStored(localStorage.getItem(storageKey(userId, kind)))
  } catch {
    return null
  }
}

function writeStored (userId: number, kind: UiSidebarKind, open: boolean) {
  if (!import.meta.client) {
    return
  }
  try {
    localStorage.setItem(storageKey(userId, kind), open ? '1' : '0')
  } catch {
    // private mode 等で書けなくても UI 操作は続行
  }
}

/**
 * 画面別サイドバーの開閉をユーザー UI 設定として保持する。
 * （ブラウザ localStorage・ユーザー ID 単位。リロード後も復元）
 */
export function useUiSidebarPreference (kind: UiSidebarKind) {
  const { ensureCurrentUser } = useCurrentUser()
  const sidebarOpen = ref(DEFAULT_OPEN)
  let resolvedUserId: number | null = null

  function applyStoredForUser (userId: number) {
    resolvedUserId = userId
    const stored = readStored(userId, kind)
    if (stored != null) {
      sidebarOpen.value = stored
    }
  }

  function hydrateFromKnownUser () {
    const userId = getCurrentUserIdState().value
    if (userId == null) {
      return
    }
    applyStoredForUser(userId)
  }

  async function hydrateSidebarPreference () {
    if (!import.meta.client) {
      return
    }
    hydrateFromKnownUser()
    const userId = await ensureCurrentUser()
    if (userId == null) {
      return
    }
    applyStoredForUser(userId)
  }

  async function persistSidebarOpen (open: boolean) {
    if (!import.meta.client) {
      return
    }
    const userId = resolvedUserId ?? await ensureCurrentUser()
    if (userId == null) {
      return
    }
    resolvedUserId = userId
    writeStored(userId, kind, open)
  }

  function toggleSidebar () {
    sidebarOpen.value = !sidebarOpen.value
    void persistSidebarOpen(sidebarOpen.value)
  }

  // setup 時点でユーザー ID が分かっていれば同期復元（チラつき抑制）
  hydrateFromKnownUser()

  return {
    sidebarOpen,
    toggleSidebar,
    hydrateSidebarPreference,
  }
}
