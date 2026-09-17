import { extractApiErrorMessage } from '../utils/apiError'
import { deepNormalizeColorIndexedPayload } from '../utils/colorPresetResolution'
import { resolveAvatarUrl } from '../utils/resolveAvatarUrl'
import { ensureXsrfToken, readXsrfToken } from '../utils/csrf'

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/** 開発時に Laravel が固まっても無限スピナーにしない */
const API_TIMEOUT_MS = 15_000

function isRecord (value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** API レスポンス内の avatar_url / icon_url をフロントから読める URL に解決する */
function deepNormalizeAvatarUrls<T> (payload: T, apiBaseUrl: string): T {
  if (payload === null || payload === undefined) {
    return payload
  }
  if (Array.isArray(payload)) {
    return payload.map(item => deepNormalizeAvatarUrls(item, apiBaseUrl)) as T
  }
  if (!isRecord(payload)) {
    return payload
  }
  const normalized: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(payload)) {
    if (key === 'avatar_url' || key === 'icon_url') {
      if (typeof value === 'string' || value === null) {
        normalized[key] = resolveAvatarUrl(value, apiBaseUrl)
        continue
      }
    }
    normalized[key] = deepNormalizeAvatarUrls(value, apiBaseUrl)
  }
  return normalized as T
}

function readHttpStatus (error: unknown): number | null {
  if (!error || typeof error !== 'object') {
    return null
  }
  const record = error as { statusCode?: unknown; status?: unknown; response?: { status?: unknown } }
  if (typeof record.statusCode === 'number') {
    return record.statusCode
  }
  if (typeof record.status === 'number') {
    return record.status
  }
  if (typeof record.response?.status === 'number') {
    return record.response.status
  }
  return null
}

type ApiRequestOptions = Record<string, unknown> & {
  __csrfRetried?: boolean
}

export function useApi () {
  const config = useRuntimeConfig()
  const publicBase = String(config.public.apiBaseUrl || '/api').replace(/\/$/, '')
  const internalBase = String(
    (config as { apiInternalBase?: string }).apiInternalBase
    || process.env.NUXT_DEV_API_PROXY_TARGET
    || 'http://127.0.0.1:8000',
  ).replace(/\/$/, '')
  // SSR の相対 `/api` は Nitro 内で止まり Vite プロキシを通らないため、Laravel へ直接向ける
  const apiBase = import.meta.server && publicBase.startsWith('/')
    ? `${internalBase}${publicBase}`
    : publicBase
  function getSocketId (): string {
    if (!import.meta.client) {
      return ''
    }
    try {
      const nuxtApp = useNuxtApp()
      const echo = (nuxtApp as unknown as { $echo?: { socketId?: () => string | undefined } }).$echo
      return echo?.socketId?.() ?? ''
    } catch {
      return ''
    }
  }
  async function api<T> (path: string, opts: ApiRequestOptions = {}): Promise<T> {
    const url = path.startsWith('http') ? path : `${apiBase}/${path.replace(/^\//, '')}`
    const method = String(opts.method || 'GET').toUpperCase()
    const headers: Record<string, string> = {
      Accept: opts.responseType === 'blob' ? '*/*' : 'application/json',
      ...(opts.headers as Record<string, string> | undefined),
    }
    const xsrfToken = READ_METHODS.has(method)
      ? readXsrfToken()
      : await ensureXsrfToken(apiBase)
    if (xsrfToken) {
      headers['X-XSRF-TOKEN'] = xsrfToken
    }
    const socketId = getSocketId()
    if (socketId) {
      headers['X-Socket-ID'] = socketId
    }
    try {
      const result = await $fetch<T>(url, {
        ...opts,
        headers,
        // 認証は HttpOnly のセッション Cookie で行うため、必ず Cookie を送る
        credentials: 'include',
        // Laravel 単一スレッドが固まっても遷移画面で無限待ちしない
        timeout: typeof opts.timeout === 'number' ? opts.timeout : API_TIMEOUT_MS,
      })
      if (typeof Blob !== 'undefined' && result instanceof Blob) {
        return result
      }
      return deepNormalizeAvatarUrls(
        deepNormalizeColorIndexedPayload(result),
        apiBase || '/api',
      )
    } catch (error: unknown) {
      // セッションと CSRF Cookie の不整合時は一度だけトークンを取り直して再試行する
      if (
        !READ_METHODS.has(method)
        && readHttpStatus(error) === 419
        && !opts.__csrfRetried
      ) {
        await ensureXsrfToken(apiBase, { force: true })
        return api<T>(path, { ...opts, __csrfRetried: true })
      }
      throw new Error(extractApiErrorMessage(error))
    }
  }
  return { api, apiBase }
}
