export function useApi () {
  const config = useRuntimeConfig()

  function getToken (): string {
    if (!import.meta.client) {
      return ''
    }
    return localStorage.getItem('id_token')?.trim() ?? ''
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
    return await $fetch<T>(url, {
      ...opts,
      headers,
    })
  }

  return { api, getToken }
}
