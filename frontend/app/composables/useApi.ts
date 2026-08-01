import { extractApiErrorMessage } from '../utils/apiError'
import { deepNormalizeColorIndexedPayload } from '../utils/colorPresetResolution'
import { ensureXsrfToken, readXsrfToken } from '../utils/csrf'

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export function useApi () {
  const config = useRuntimeConfig()
  const apiBase = String(config.public.apiBaseUrl || '/api').replace(/\/$/, '')
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
  async function api<T> (path: string, opts: Record<string, unknown> = {}): Promise<T> {
    const url = path.startsWith('http') ? path : `${apiBase}/${path.replace(/^\//, '')}`
    const method = String(opts.method || 'GET').toUpperCase()
    const headers: Record<string, string> = {
      Accept: 'application/json',
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
      })
      return deepNormalizeColorIndexedPayload(result)
    } catch (error: unknown) {
      throw new Error(extractApiErrorMessage(error))
    }
  }
  return { api, apiBase }
}
