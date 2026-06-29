import { deepNormalizeColorIndexedPayload } from '../utils/colorPresetResolution'
export function useApi () {
  const config = useRuntimeConfig()
  const { getToken } = useAuth()
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
    const base = config.public.apiBaseUrl as string
    const url = path.startsWith('http') ? path : `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(opts.headers as Record<string, string> | undefined),
    }
    const token = getToken()
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }
    const socketId = getSocketId()
    if (socketId) {
      headers['X-Socket-ID'] = socketId
    }
    const result = await $fetch<T>(url, {
      ...opts,
      headers,
    })
    return deepNormalizeColorIndexedPayload(result)
  }
  return { api, getToken }
}
